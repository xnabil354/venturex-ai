import { ReferenceRepository } from "../../../../../reference/repository";
import { getReferenceResponse } from "../response";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return getReferenceResponse(() => new ReferenceRepository().listActiveCustomerSegments());
}
