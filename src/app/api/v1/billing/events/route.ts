import { getCurrentUser } from "@/auth/current-user";
import { subscribeBillingEvents } from "@/billing/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: { code: "UNAUTHORIZED", message: "Silakan masuk terlebih dahulu." } }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: "ready" | "changed" | "unavailable") => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`)); }
        catch { cleanup?.(); }
      };
      const unsubscribe = subscribeBillingEvents(user.id, send);
      const heartbeat = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(": heartbeat\n\n")); }
          catch { cleanup?.(); }
        }
      }, 25_000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* Already closed by the client. */ }
      };
      cleanup = close;
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close();
    },
    cancel() { cleanup?.(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
