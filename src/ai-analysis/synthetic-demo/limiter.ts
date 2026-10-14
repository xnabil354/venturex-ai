export type SyntheticDemoPermitResult =
  | { readonly allowed: true; readonly release: () => void }
  | { readonly allowed: false; readonly reason: "RATE_LIMITED" | "BUSY" };

export class SyntheticDemoRequestLimiter {
  private readonly windowMs: number;
  private readonly maximumRequests: number;
  private readonly maximumConcurrent: number;
  private timestamps: number[] = [];
  private active = 0;

  constructor(options: { windowMs?: number; maximumRequests?: number; maximumConcurrent?: number } = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.maximumRequests = options.maximumRequests ?? 6;
    this.maximumConcurrent = options.maximumConcurrent ?? 1;
  }

  acquire(now = Date.now()): SyntheticDemoPermitResult {
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
    if (this.active >= this.maximumConcurrent) return { allowed: false, reason: "BUSY" };
    if (this.timestamps.length >= this.maximumRequests) return { allowed: false, reason: "RATE_LIMITED" };

    this.active += 1;
    this.timestamps.push(now);
    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        this.active = Math.max(0, this.active - 1);
      },
    };
  }
}
