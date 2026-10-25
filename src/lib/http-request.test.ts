import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTrustedApplicationOrigin } from "./http-request";

afterEach(() => vi.unstubAllEnvs());

describe("public application origin behind a reverse proxy", () => {
  const request = (origin?: string, headers: Record<string, string> = {}) =>
    new Request("https://0.0.0.0:3000/api/progress", {
      headers: { ...headers, ...(origin === undefined ? {} : { origin }) },
    });

  it("accepts the configured public HTTPS origin despite the internal host and port", () => {
    vi.stubEnv("APP_URL", "https://venturex.web.id");
    expect(hasTrustedApplicationOrigin(request("https://venturex.web.id"))).toBe(true);
  });

  it.each([
    undefined, "null", "invalid", "https://evil.test", "http://venturex.web.id",
    "https://venturex.web.id:444", "https://venturex.web.id.evil.test",
    "https://user@venturex.web.id", "https://venturex.web.id/other",
    "https://venturex.web.id?unexpected=1", "https://venturex.web.id#fragment",
    "https://0.0.0.0:3000",
  ])("rejects invalid or untrusted origin %s", origin => {
    vi.stubEnv("APP_URL", "https://venturex.web.id");
    expect(hasTrustedApplicationOrigin(request(origin))).toBe(false);
  });

  it("does not trust forged host or forwarding headers", () => {
    vi.stubEnv("APP_URL", "https://venturex.web.id");
    expect(hasTrustedApplicationOrigin(request("https://evil.test", {
      host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https",
    }))).toBe(false);
  });

  it("fails closed for invalid configured origins", () => {
    vi.stubEnv("APP_URL", "invalid");
    expect(hasTrustedApplicationOrigin(request("https://venturex.web.id"))).toBe(false);
  });

  it("uses the exact request origin when no public URL is configured locally", () => {
    vi.stubEnv("APP_URL", undefined);
    expect(hasTrustedApplicationOrigin(new Request("http://localhost:3000/api/progress", {
      headers: { origin: "http://localhost:3000" },
    }))).toBe(true);
    expect(hasTrustedApplicationOrigin(request("https://venturex.web.id"))).toBe(false);
  });
});
