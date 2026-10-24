import { NextResponse } from "next/server";

import { getSequelize } from "@/db/sequelize";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };

  try {
    await getSequelize().authenticate();
    return NextResponse.json({ status: "ok" }, { headers });
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers },
    );
  }
}
