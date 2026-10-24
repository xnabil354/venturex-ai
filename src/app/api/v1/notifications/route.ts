import { notificationHttp } from "@/notifications/http";
export const runtime = "nodejs";
export function GET(request: Request) {
  return notificationHttp(request, "inbox");
}
