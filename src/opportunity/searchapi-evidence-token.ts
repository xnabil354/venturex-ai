import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

import { isSupportedGoogleTrendsGeo } from "@/trend/searchapi-google-trends-geography";

import { searchApiOpportunityEvidenceSchema, type SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";

const tokenPayloadSchema = z.object({
  version: z.literal(1),
  userId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  evidence: searchApiOpportunityEvidenceSchema,
}).strict();

const TOKEN_AAD = Buffer.from("venturex:opportunity-searchapi-evidence:v1", "utf8");
const TOKEN_SECRET_PLACEHOLDER = "replace-with-a-local-random-secret";

export class SearchApiEvidenceTokenError extends Error {
  override readonly name = "SearchApiEvidenceTokenError";

  constructor(readonly code: "CONFIGURATION_UNAVAILABLE" | "INVALID_TOKEN") {
    super(code);
  }
}

function encryptionKey(env: Readonly<Record<string, string | undefined>>): Buffer {
  const secret = env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === TOKEN_SECRET_PLACEHOLDER) {
    throw new SearchApiEvidenceTokenError("CONFIGURATION_UNAVAILABLE");
  }
  return createHmac("sha256", secret).update(TOKEN_AAD).digest();
}

export function isSearchApiEvidenceTokenConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    encryptionKey(env);
    return true;
  } catch {
    return false;
  }
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

export function sealSearchApiOpportunityEvidence(options: Readonly<{
  userId: string;
  evidence: SearchApiOpportunityEvidence;
  env?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}>): string {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const evidence = searchApiOpportunityEvidenceSchema.safeParse(options.evidence);
  if (!evidence.success
    || !isSupportedGoogleTrendsGeo(evidence.data.geo)
    || Date.parse(evidence.data.retrievedAt) > now.getTime()
    || Date.parse(evidence.data.expiresAt) <= now.getTime()) {
    throw new SearchApiEvidenceTokenError("INVALID_TOKEN");
  }

  const payload = tokenPayloadSchema.parse({
    version: 1,
    userId: options.userId,
    issuedAt: now.toISOString(),
    evidence: evidence.data,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`;
}

export function openSearchApiOpportunityEvidence(options: Readonly<{
  userId: string;
  token: string;
  env?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}>): SearchApiOpportunityEvidence | null {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const parts = options.token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || options.token.length > 8_192) return null;
  const iv = decode(parts[1]!);
  const tag = decode(parts[2]!);
  const ciphertext = decode(parts[3]!);
  if (!iv || iv.byteLength !== 12 || !tag || tag.byteLength !== 16 || !ciphertext || ciphertext.byteLength > 6_144) return null;

  let payloadValue: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), iv);
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(tag);
    payloadValue = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof SearchApiEvidenceTokenError) throw error;
    return null;
  }

  const parsed = tokenPayloadSchema.safeParse(payloadValue);
  if (!parsed.success
    || parsed.data.userId !== options.userId
    || !isSupportedGoogleTrendsGeo(parsed.data.evidence.geo)) return null;
  const issuedAt = Date.parse(parsed.data.issuedAt);
  const retrievedAt = Date.parse(parsed.data.evidence.retrievedAt);
  const expiresAt = Date.parse(parsed.data.evidence.expiresAt);
  if (issuedAt > now.getTime() + 60_000
    || issuedAt < retrievedAt
    || retrievedAt > now.getTime()
    || expiresAt <= now.getTime()
    || expiresAt <= retrievedAt
    || expiresAt - retrievedAt > 24 * 60 * 60 * 1_000) return null;
  return parsed.data.evidence;
}
