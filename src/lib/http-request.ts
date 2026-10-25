/** Use the configured public origin rather than Next's internal container URL. */
export function hasTrustedApplicationOrigin(request: Request): boolean {
  const value = request.headers.get("origin");
  if (!value) return false;
  try {
    const origin = new URL(value);
    const expected = new URL(process.env.APP_URL ?? request.url);
    return (origin.protocol === "http:" || origin.protocol === "https:")
      && origin.pathname === "/"
      && !origin.username && !origin.password && !origin.search && !origin.hash
      && (expected.protocol === "http:" || expected.protocol === "https:")
      && !expected.username && !expected.password
      && origin.origin === expected.origin;
  } catch {
    return false;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const originValue = request.headers.get("origin");
  const hostValue = request.headers.get("host");
  if (!originValue || !hostValue) return false;
  try {
    const origin = new URL(originValue);
    // ASVS 3.5.1: state-changing requests must originate from this application.
    return (origin.protocol === "http:" || origin.protocol === "https:")
      && origin.host === hostValue
      && origin.pathname === "/"
      && !origin.username
      && !origin.password
      && !origin.search
      && !origin.hash;
  } catch {
    return false;
  }
}

export async function readBoundedRequestText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  // ASVS 2.2.1 and 4.2.1: reject malformed or oversized request framing.
  if (contentLength && (!/^\d+$/u.test(contentLength) || Number(contentLength) > maxBytes)) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
