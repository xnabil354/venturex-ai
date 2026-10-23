export const SYNTHETIC_DEMO_ENABLE_FLAG = "AI_ANALYSIS_SYNTHETIC_DEMO_ENABLED";
export const SYNTHETIC_DEMO_LAUNCHER_FLAG = "VENTUREX_SYNTHETIC_DEMO_LOOPBACK_LAUNCHER";
export const SYNTHETIC_DEMO_PORT_FLAG = "VENTUREX_SYNTHETIC_DEMO_PORT";

export type SyntheticDemoEnvironment = Readonly<Record<string, string | undefined>>;

export function isSyntheticDemoEnabled(env: SyntheticDemoEnvironment): boolean {
  return env.NODE_ENV === "development"
    && env[SYNTHETIC_DEMO_ENABLE_FLAG] === "true"
    && env[SYNTHETIC_DEMO_LAUNCHER_FLAG] === "127.0.0.1";
}

export function isSyntheticDemoHostAllowed(host: string | null, env: SyntheticDemoEnvironment): boolean {
  if (!isSyntheticDemoEnabled(env) || !host) return false;
  const expectedPort = env[SYNTHETIC_DEMO_PORT_FLAG];
  if (!expectedPort || !/^\d{4,5}$/u.test(expectedPort)) return false;

  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname === "127.0.0.1"
      && parsed.port === expectedPort
      && parsed.username === ""
      && parsed.password === ""
      && parsed.pathname === "/"
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}

export function isSyntheticDemoPostAllowed(request: Request, env: SyntheticDemoEnvironment): boolean {
  return getSyntheticDemoPostBlockReason(request, env) === null;
}

export type SyntheticDemoPostBlockReason = "DEMO_DISABLED" | "HOST_NOT_ALLOWED" | "ORIGIN_NOT_ALLOWED";

export function getSyntheticDemoPostBlockReason(request: Request, env: SyntheticDemoEnvironment): SyntheticDemoPostBlockReason | null {
  if (!isSyntheticDemoEnabled(env)) return "DEMO_DISABLED";
  if (!isSyntheticDemoHostAllowed(request.headers.get("host"), env)) return "HOST_NOT_ALLOWED";

  try {
    const originHeader = request.headers.get("origin");
    if (!originHeader) return "ORIGIN_NOT_ALLOWED";
    const origin = new URL(originHeader);
    const host = request.headers.get("host");
    const allowed = origin.protocol === "http:"
      && origin.hostname === "127.0.0.1"
      && origin.port === env[SYNTHETIC_DEMO_PORT_FLAG]
      && origin.host === host
      && origin.username === ""
      && origin.password === "";
    return allowed ? null : "ORIGIN_NOT_ALLOWED";
  } catch {
    return "ORIGIN_NOT_ALLOWED";
  }
}
