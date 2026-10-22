import { searchGoogleTrendsGeoOptions } from "@/trend/searchapi-google-trends-geography";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SEARCH_LENGTH = 80;

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > MAX_SEARCH_LENGTH) {
    return Response.json({ error: "Pencarian wilayah terlalu panjang." }, {
      status: 400,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  return Response.json({ options: searchGoogleTrendsGeoOptions(query) }, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
