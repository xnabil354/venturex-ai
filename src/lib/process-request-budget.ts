export function consumeProcessRequestBudget(counterKey: string, maxRequests: number): boolean {
  const processState = globalThis as typeof globalThis & Record<string, unknown>;
  const stored = processState[counterKey];
  const current = typeof stored === "number" ? stored : 0;
  // ASVS 2.4.1: retain a strict process-level cap for costly external requests.
  if (current >= maxRequests) return false;
  processState[counterKey] = current + 1;
  return true;
}
