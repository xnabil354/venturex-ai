import { z } from "zod";

const INDONESIA_REGIONS_API =
  "https://www.emsifa.com/api-wilayah-indonesia/v2";

const regionListEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
});

export type IndonesiaRegion = z.infer<
  typeof regionListEnvelopeSchema
>["data"][number];

export type IndonesiaRegionRequest =
  | { readonly level: "provinces" }
  | {
      readonly level: "regencies" | "districts" | "villages";
      readonly parentId: string;
    };

export async function fetchIndonesiaRegions(
  request: IndonesiaRegionRequest,
  signal: AbortSignal,
): Promise<readonly IndonesiaRegion[]> {
  const path =
    request.level === "provinces"
      ? "provinces.json"
      : `${request.level}/${encodeURIComponent(request.parentId)}.json`;
  const response = await fetch(`${INDONESIA_REGIONS_API}/${path}`, { signal });

  if (!response.ok) {
    throw new Error(`Wilayah API returned ${response.status}`);
  }

  const body: unknown = await response.json();
  const parsed = regionListEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Wilayah API returned an invalid response");
  }

  return parsed.data.data;
}
