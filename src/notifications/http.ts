import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { isUserType } from "@/auth/user-types";
import {
  NOTIFICATION_CATEGORY,
  NOTIFICATION_SCHEDULE_LABEL,
  NOTIFICATION_SCOPE,
  endpointSchema,
  notificationPreferenceSchema,
  subscriptionSchema,
} from "./contract";
import { NotificationRepository } from "./repository";
import { pushConfig } from "./push";
import { hasTrustedApplicationOrigin } from "@/lib/http-request";

type NotificationSection = "inbox" | "preferences" | "push" | "context";

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
function assertSameOrigin(request: Request): void {
  // ASVS 3.5.1: state changes require an exact same-origin request.
  if (!hasTrustedApplicationOrigin(request)) {
    throw new HttpError(403, "Permintaan tidak diizinkan.");
  }
}
async function body(request: Request): Promise<unknown> {
  if (!request.body) throw new HttpError(400, "Data belum lengkap.");
  // ASVS 4.2.5: reject unexpected media types and cap request-body processing.
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json")
    throw new HttpError(415, "Format data tidak didukung.");
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
  section: NotificationSection,
): Promise<Response> {
  try {
    if (request.method !== "GET") assertSameOrigin(request);
    const user = await getCurrentUser();
    // ASVS 8.3.1: authorization is established server-side for every request.
    if (!user) throw new HttpError(401, "Silakan masuk kembali.");
    if (user.onboardingStatus !== "COMPLETED" || !isUserType(user.userType))
      throw new HttpError(403, "Lengkapi profil terlebih dahulu.");
    if (section === "context") {
      if (request.method !== "GET") throw new HttpError(405, "Metode tidak didukung.");
      return json({ userId: user.id });
    }
    const repository = new NotificationRepository();
    if (section === "preferences") {
      if (request.method === "PATCH") {
        // ASVS 2.2.1: reject every field except the server-owned toggle.
        const preference = notificationPreferenceSchema.parse(await body(request));
        await repository.setEnabled(user.id, preference.enabled);
      } else if (request.method !== "GET") throw new HttpError(405, "Metode tidak didukung.");
      const row = await repository.preferences(user.id);
      const config = pushConfig();
      return json({
        enabled: row?.enabled ?? false,
        status: row?.status ?? null,
        category: NOTIFICATION_CATEGORY,
        scope: NOTIFICATION_SCOPE,
        schedule: NOTIFICATION_SCHEDULE_LABEL,
        pushAvailable: Boolean(config),
        publicKey: config?.publicKey ?? null,
        userId: user.id,
      });
    }
    if (section === "inbox") {
      if (request.method !== "GET") throw new HttpError(405, "Metode tidak didukung.");
      const cursor = new URL(request.url).searchParams.get("before");
      if (cursor && !z.string().uuid().safeParse(cursor).success)
        throw new HttpError(400, "Halaman tidak valid.");
      return json({
        ...(await repository.inbox(user.id, cursor ?? undefined)),
        userId: user.id,
      });
    }
    if (request.method === "DELETE") {
      const { endpoint } = z
        .object({ endpoint: endpointSchema })
        .strict()
        .parse(await body(request));
      await repository.unsubscribe(user.id, endpoint);
      return json({ ok: true });
    }
    if (request.method !== "POST") throw new HttpError(405, "Metode tidak didukung.");
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
    // Keep operational diagnostics server-side; never return internal details to the client.
    console.error("venturex_notification_request_failed", {
      section,
      method: request.method,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return json(
      { error: { message: "Notifikasi belum dapat dimuat. Coba lagi nanti." } },
      503,
    );
  }
}
