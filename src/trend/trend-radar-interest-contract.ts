import { z } from "zod";

import { trendRadarRequestSchema, type TrendRadarRequest, type TrendRadarResponse } from "./trend-radar-contract";

export type TrendTimePoint = {
  readonly timestamp: number;
  readonly label: string;
  readonly interestIndex: number | null;
};

export type TrendTimeSeries = {
  readonly query: string;
  readonly points: TrendTimePoint[];
  readonly averageInterest: number | null;
  readonly omittedInvalidPoints: number;
};

export type TrendRegion = {
  readonly position: number;
  readonly geoCode: string;
  readonly name: string;
  readonly interestIndex: number | null;
};

export type TrendRegionalInterest = {
  readonly query: string;
  readonly regions: TrendRegion[];
  readonly omittedInvalidRegions: number;
};

const timePointSchema = z.object({
  timestamp: z.number().int().positive(),
  label: z.string().min(1),
  interestIndex: z.number().finite().min(0).max(100).nullable(),
}).strict();

const timeSeriesSchema = z.object({
  query: z.string().min(1),
  points: z.array(timePointSchema),
  averageInterest: z.number().finite().min(0).max(100).nullable(),
  omittedInvalidPoints: z.number().int().nonnegative(),
}).strict();

const regionSchema = z.object({
  position: z.number().int().positive(),
  geoCode: z.string().min(2).max(9).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u),
  name: z.string().min(1),
  interestIndex: z.number().finite().min(0).max(100).nullable(),
}).strict();

const regionalInterestSchema = z.object({
  query: z.string().min(1),
  regions: z.array(regionSchema),
  omittedInvalidRegions: z.number().int().nonnegative(),
}).strict();

const availabilitySchema = z.enum(["available", "empty", "failed"]);
const datasetCacheSchema = z.object({
  status: z.enum(["NETWORK", "HIT", "COALESCED"]).nullable(),
  retrievedAt: z.string().datetime().nullable(),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).strict().nullable(),
}).strict();

export const trendRadarInterestResponseSchema = z.object({
  provider: z.literal("SearchApi.io"),
  productQuery: z.string().min(1),
  appliedFilters: z.object({
    period: z.string(),
    time: z.string(),
    property: z.enum(["web", "images", "news", "shopping", "youtube"]),
    geo: z.string().max(9),
    category: z.literal(0),
    timezoneOffsetMinutes: z.literal(-420),
    timezone: z.literal("Asia/Jakarta"),
  }).strict(),
  timeSeries: timeSeriesSchema.nullable(),
  regionalInterest: regionalInterestSchema.nullable(),
  availability: z.object({ timeSeries: availabilitySchema, regionalInterest: availabilitySchema }).strict(),
  datasets: z.object({ timeSeries: datasetCacheSchema, regionalInterest: datasetCacheSchema }).strict(),
  requestId: z.string().min(1),
}).strict();

export type TrendRadarInterestResponse = z.infer<typeof trendRadarInterestResponseSchema>;
export type TrendRadarInterestRequest = TrendRadarRequest;

export type TrendInterestAppliedFilters = TrendRadarResponse["appliedFilters"];

export const trendRadarInterestRequestSchema = trendRadarRequestSchema;
