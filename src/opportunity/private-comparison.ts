import { z } from "zod";
export const privateComparisonIdsSchema = z.array(z.string().uuid().transform(id => id.toLowerCase())).min(2).max(3).refine(ids => new Set(ids).size === ids.length);
