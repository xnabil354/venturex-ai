export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, milliseconds = 15_000): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init.signal?.removeEventListener("abort", abort); }
}
