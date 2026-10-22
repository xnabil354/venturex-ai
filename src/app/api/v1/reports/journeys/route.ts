import { journeyHttp } from "@/reports/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => journeyHttp(request);
