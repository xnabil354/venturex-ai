import { journeyHttp } from "@/reports/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return journeyHttp(request, (await params).id);
}
