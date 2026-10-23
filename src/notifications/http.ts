import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { isUserType } from "@/auth/user-types";
import {
  defaultPreferences,
  endpointSchema,
  preferenceSchema,
} from "./contract";
import { NotificationRepository } from "./repository";
import { notificationTopics } from "./topics";
import { pushConfig, sendPush } from "./push";
import { subscriptionSchema } from "./contract";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(request: Request): Promise<unknown> {
  if (!request.body) throw new HttpError(400, "Data belum lengkap.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new HttpError(413, "Data terlalu besar.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Data tidak valid.");
  } finally {
    reader.releaseLock();
  }
}
export async function notificationHttp(
  request: Request,
  section: "inbox" | "preferences" | "push" | "test" | "context",
): Promise<Response> {
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (!origin || new URL(origin).origin !== new URL(request.url).origin)
        throw new HttpError(403, "Permintaan tidak diizinkan.");
    }
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Silakan masuk kembali.");
    if (user.onboardingStatus !== "COMPLETED" || !isUserType(user.userType))
      throw new HttpError(403, "Lengkapi profil terlebih dahulu.");
    if (section === "context") return json({ userId: user.id });
    const repository = new NotificationRepository();
    if (section === "preferences") {
      const options = await notificationTopics(user);
      if (request.method === "PATCH") {
        const preferences = preferenceSchema.parse(await body(request));
        const selected = options.find(
          (option) => option.key === preferences.queryKey,
        );
        if (!selected && preferences.enabled)
          throw new HttpError(422, "Pilih kembali topik dari profil Anda.");
        await repository.savePreferences(
          user.id,
          preferences,
          selected?.query ?? "",
        );
      }
      const row = await repository.preferences(user.id);
      const config = pushConfig();
      return json({
        preferences: row
          ? { ...row.settings, enabled: row.enabled }
          : {
              ...defaultPreferences,
              queryKey:
                options.find((option) => option.key.startsWith("product:"))
                  ?.key ??
                options[0]?.key ??
                "preferred",
            },
        topicQuery: row?.topic_query ?? null,
        status: row?.status ?? null,
        options,
        pushAvailable: Boolean(config),
        publicKey: config?.publicKey ?? null,
        userId: user.id,
      });
    }
    if (section === "inbox") {
      if (request.method === "PATCH") {
        const { id } = z
          .object({ id: z.string().uuid() })
          .strict()
          .parse(await body(request));
        if (!(await repository.markRead(user.id, id)))
          throw new HttpError(404, "Notifikasi tidak ditemukan.");
        return json({ ok: true });
      }
      const cursor = new URL(request.url).searchParams.get("before");
      if (cursor && !z.string().uuid().safeParse(cursor).success)
        throw new HttpError(400, "Halaman tidak valid.");
      return json({
        ...(await repository.inbox(user.id, cursor ?? undefined)),
        userId: user.id,
      });
    }
    if (section === "test") {
      const { endpoint } = z
        .object({ endpoint: endpointSchema })
        .strict()
        .parse(await body(request));
      if (!pushConfig())
        throw new HttpError(503, "Notifikasi perangkat belum tersedia.");
      const subscription = await repository.claimTest(user.id, endpoint);
      if (!subscription)
        throw new HttpError(
          429,
          "Aktifkan perangkat atau tunggu satu menit sebelum mencoba lagi.",
        );
      try {
        await sendPush(subscription, {
          userId: user.id,
          id: randomUUID(),
          test: true,
        });
      } catch (error) {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (status === 404 || status === 410)
          await repository.unsubscribe(user.id, endpoint);
        throw new HttpError(
          503,
          "Notifikasi belum terkirim. Coba aktifkan ulang perangkat.",
        );
      }
      return json({ ok: true });
    }
    if (request.method === "DELETE") {
      const { endpoint } = z
        .object({ endpoint: endpointSchema })
        .strict()
        .parse(await body(request));
      await repository.unsubscribe(user.id, endpoint);
      return json({ ok: true });
    }
    if (!pushConfig())
      throw new HttpError(503, "Notifikasi perangkat belum tersedia.");
    const subscription = subscriptionSchema.parse(await body(request));
    if (!(await repository.subscribe(user.id, subscription)))
      throw new HttpError(
        409,
        "Perangkat belum dapat diaktifkan. Nonaktifkan langganan lama terlebih dahulu.",
      );
    return json({ ok: true }, 201);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: { message: error.message } }, error.status);
    if (error instanceof z.ZodError || error instanceof TypeError)
      return json(
        { error: { message: "Periksa kembali pengaturan Anda." } },
        400,
      );
    return json(
      { error: { message: "Notifikasi belum dapat dimuat. Coba lagi nanti." } },
      503,
    );
  }
}
