import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ related: vi.fn(), send: vi.fn() }));
vi.mock("@/trend/searchapi-google-trends", () => ({
  getSearchApiGoogleTrendsAdapter: () => ({ foodAndDrinkRelatedQueries: mocks.related }),
}));
vi.mock("./push", () => ({ pushConfig: () => ({ publicKey: "public" }), sendPush: mocks.send }));

import { processDigest, processPush } from "./worker";
import { NotificationRepository } from "./repository";

const now = new Date("2026-10-26T05:00:00Z");
const id = "00000000-0000-4000-8000-000000000001";

function fixture(options: { attempts?: number; existing?: boolean; expired?: boolean; enabled?: boolean } = {}) {
  const query = vi.fn(async (sql: string, _options?: unknown) => {
    if (sql.includes("FOR UPDATE OF p")) return [{ user_id: id, enabled: true, attempts: options.attempts ?? 0, status: null, next_run_at: now }];
    if (sql.includes("FOR UPDATE OF d")) return [{ id: "subscription", user_id: id, subscription_id: "subscription", notification_id: "notification", endpoint: "https://fcm.googleapis.com/token", keys: { p256dh: "public", auth: "auth" }, enabled: options.enabled ?? true }];
    if (sql.includes("created_at>")) return options.expired ? [] : [{ id: "notification" }];
    if (sql.startsWith("SELECT id FROM trend_notifications")) return options.existing ? [{ id: "existing" }] : [];
    return [];
  });
  const transaction = vi.fn(async (fn: (transaction: object) => Promise<unknown>) => fn({}));
  return { repository: new NotificationRepository({ query, transaction } as unknown as Sequelize), query };
}

describe("durable weekly digest worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.related.mockResolvedValue({ top: [{ query: "Coffee", position: 1, sourceUrl: null }], rising: [], retrievedAt: now.toISOString() });
    mocks.send.mockResolvedValue(undefined);
  });
  it("advances an overdue job rather than delivering it on Tuesday", async () => {
    const { repository, query } = fixture();
    await processDigest(repository, new Date("2026-10-27T05:00:00Z"));
    expect(mocks.related).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE notification_preferences SET attempts"))).toBe(true);
  });
  it("claims rows with skip-locked, stores one weekly snapshot, and creates push outbox rows", async () => {
    const { repository, query } = fixture();
    await processDigest(repository, now);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE OF p SKIP LOCKED");
    expect(query.mock.calls.some(([sql]) => sql.includes("week_start"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO notification_push_deliveries"))).toBe(true);
  });
  it("uses the provider category flow without any profile query", async () => {
    const { repository } = fixture();
    await processDigest(repository, now);
    expect(mocks.related).toHaveBeenCalledWith({ period: "custom-date", startDate: "2026-10-01", endDate: "2026-10-26", geo: "", property: "web" });
  });
  it("does not fetch source data twice in the same week", async () => {
    const { repository } = fixture({ existing: true });
    await processDigest(repository, now);
    expect(mocks.related).not.toHaveBeenCalled();
  });
  it("does not publish empty results", async () => {
    mocks.related.mockResolvedValue({ top: [], rising: [] });
    const { repository, query } = fixture();
    await processDigest(repository, now);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO trend_notifications"))).toBe(false);
  });
  it("bounds retries and resets the next-week attempt budget", async () => {
    mocks.related.mockRejectedValue(new Error("source unavailable"));
    const { repository, query } = fixture({ attempts: 2 });
    await processDigest(repository, now);
    const options = query.mock.calls.find(([sql]) => sql.startsWith("UPDATE notification_preferences SET attempts"))?.[1] as { replacements: { attempts: number; status: string; next: Date } } | undefined;
    expect(options?.replacements).toMatchObject({ attempts: 0, status: "UNAVAILABLE" });
    expect(options?.replacements.next.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
  it("records remote acceptance in the durable outbox", async () => {
    const { repository, query } = fixture();
    await processPush(repository, now);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(query.mock.calls.some(([sql]) => sql.includes("SET delivered_at=:now"))).toBe(true);
  });
  it.each([{ expired: true }, { enabled: false }])("discards stale or opted-out deliveries %j", async (options) => {
    const { repository, query } = fixture(options);
    await processPush(repository, now);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => sql.includes("SET attempts=3"))).toBe(true);
  });
});
