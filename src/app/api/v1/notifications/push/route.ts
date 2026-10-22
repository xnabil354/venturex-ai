import { notificationHttp } from "@/notifications/http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return notificationHttp(request, "push");
}
export function DELETE(request: Request) {
  return notificationHttp(request, "push");
}
