// Read-only connectivity probe. Never print credentials or provider response text.
import { lookup } from "node:dns/promises";

try {
  const base = new URL(process.env.NINEROUTER_BASE_URL ?? "");
  if (base.protocol !== "https:" || base.pathname.replace(/\/$/u, "") !== "/v1"
    || base.username || base.password || base.search || base.hash) {
    throw new Error("INVALID_CONTAINER_GATEWAY");
  }
  if (!process.env.NINEROUTER_API_KEY || !process.env.NINEROUTER_MODEL) {
    throw new Error("MISSING_AI_CONFIGURATION");
  }
  const addresses = await lookup(base.hostname, { all: true });
  const start = Date.now();
  const response = await fetch(`${base.href.replace(/\/$/u, "")}/models`, {
    headers: { Authorization: `Bearer ${process.env.NINEROUTER_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GATEWAY_HTTP_${response.status}`);
  const body = await response.json();
  const found = Array.isArray(body.data)
    && body.data.some(model => model.id === process.env.NINEROUTER_MODEL);
  if (!found) throw new Error("CONFIGURED_MODEL_NOT_FOUND");
  console.log(JSON.stringify({ gateway: base.origin, addresses: addresses.map(row => row.address),
    status: response.status, modelFound: found, durationMs: Date.now() - start }));
} catch (error) {
  const safeCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT",
    "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);
  console.error(JSON.stringify({ check: "AI_GATEWAY_FAILED", errorName: error.name,
    code: safeCodes.has(error.cause?.code) ? error.cause.code : undefined,
    configurationError: /^(INVALID_CONTAINER_GATEWAY|MISSING_AI_CONFIGURATION|CONFIGURED_MODEL_NOT_FOUND|GATEWAY_HTTP_\d+)$/u.test(error.message) ? error.message : undefined }));
  process.exitCode = 1;
}
