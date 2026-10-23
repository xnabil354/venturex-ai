import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sequelize } from "sequelize";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  topics: vi.fn(),
  related: vi.fn(),
  send: vi.fn(),
}));
vi.mock("./topics", () => ({ notificationTopics: mocks.topics }));
vi.mock("./push", () => ({
  pushConfig: () => ({ publicKey: "public" }),
  sendPush: mocks.send,
}));
vi.mock("@/trend/trend-radar-service", () => ({
  getTrendRadarService: vi.fn(),
  TrendRadarService: class {
    getRelatedQueries = mocks.related;
  },
}));
import { processDigest, processPush } from "./worker";
import { NotificationRepository } from "./repository";
import { defaultPreferences } from "./contract";

const now = new Date("2026-10-22T01:00:00Z");
const id = "00000000-0000-4000-8000-000000000001";
function fixture(
  options: {
    attempts?: number;
    existing?: boolean;
    expired?: boolean;
    enabled?: boolean;
  } = {},
) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FOR UPDATE OF p"))
      return [
        {
          user_id: id,
          enabled: true,
          settings: { ...defaultPreferences, enabled: true },
          topic_query: "Bakso",
          attempts: options.attempts ?? 0,
          user_type: "ENTREPRENEUR",
          email: "qa@example.test",
        },
      ];
    if (sql.includes("FOR UPDATE OF d"))
      return [
        {
          id: "subscription",
          user_id: id,
          subscription_id: "subscription",
          notification_id: "notification",
          endpoint: "https://fcm.googleapis.com/token",
          keys: { p256dh: "public", auth: "auth" },
          enabled: options.enabled ?? true,
        },
      ];
    if (sql.includes("created_at>"))
      return options.expired ? [] : [{ id: "notification" }];
    if (sql.startsWith("SELECT id FROM trend_notifications"))
      return options.existing ? [{ id: "existing" }] : [];
    return [];
  });
  const transaction = vi.fn(
    async (fn: (transaction: object) => Promise<unknown>) => fn({}),
  );
  return {
    repository: new NotificationRepository({
      query,
      transaction,
    } as unknown as Sequelize),
    query,
  };
}
describe("durable daily digest worker", () => {
  it("waits for today's clock after recovering yesterday's overdue job", async () => {
    const { repository, query } = fixture();
    await processDigest(repository, new Date("2026-10-22T00:00:00Z"));
    expect(mocks.related).not.toHaveBeenCalled();
    const update = (query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]) => sql.startsWith("UPDATE notification_preferences SET attempts"),
    );
    expect(update?.[1].replacements.next.toISOString()).toBe(
      "2026-10-22T01:00:00.000Z",
    );
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.topics.mockResolvedValue([{ key: "preferred", query: "Bakso" }]);
    mocks.related.mockResolvedValue({
      top: [{ query: "Bakso ayam", position: 1, sourceUrl: null }],
      rising: [],
      retrievedAt: now.toISOString(),
    });
    mocks.send.mockResolvedValue(undefined);
  });
  it("claims rows with skip-locked, persists a snapshot and creates the push outbox", async () => {
    const { repository, query } = fixture();
    await processDigest(repository, now);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE OF p SKIP LOCKED");
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO trend_notifications"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO notification_push_deliveries"),
      ),
    ).toBe(true);
  });
  it("does not fetch source data twice on the same local day", async () => {
    const { repository } = fixture({ existing: true });
    await processDigest(repository, now);
    expect(mocks.related).not.toHaveBeenCalled();
  });
  it("pauses changed or removed topics before generating content", async () => {
    mocks.topics.mockResolvedValue([{ key: "preferred", query: "Kopi" }]);
    const { repository, query } = fixture();
    await processDigest(repository, now);
    expect(mocks.related).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("enabled=false,status='PROFILE_CHANGED'"),
      ),
    ).toBe(true);
  });
  it("does not publish empty results", async () => {
    mocks.related.mockResolvedValue({ top: [], rising: [] });
    const { repository, query } = fixture();
    await processDigest(repository, now);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO trend_notifications"),
      ),
    ).toBe(false);
  });
  it("bounds retries and resets the next-day attempt budget", async () => {
    mocks.related.mockRejectedValue(new Error("source unavailable"));
    const { repository, query } = fixture({ attempts: 2 });
    await processDigest(repository, now);
    const update = query.mock.calls.find(([sql]) =>
      sql.startsWith("UPDATE notification_preferences SET attempts"),
    );
    expect(update).toBeDefined();
    const args = (query as ReturnType<typeof vi.fn>).mock.calls.find(([sql]) =>
      sql.startsWith("UPDATE notification_preferences SET attempts"),
    )?.[1];
    expect(args.replacements).toMatchObject({
      attempts: 0,
      status: "UNAVAILABLE",
    });
    expect(args.replacements.next.toISOString()).toBe(
      "2026-10-23T01:00:00.000Z",
    );
  });
  it("records remote acceptance in the durable outbox", async () => {
    const { repository, query } = fixture();
    await processPush(repository, now);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(
      query.mock.calls.some(([sql]) => sql.includes("SET delivered_at=:now")),
    ).toBe(true);
  });
  it.each([{ expired: true }, { enabled: false }])(
    "discards stale or opted-out deliveries %j",
    async (options) => {
      const { repository, query } = fixture(options);
      await processPush(repository, now);
      expect(mocks.send).not.toHaveBeenCalled();
      expect(
        query.mock.calls.some(([sql]) => sql.includes("SET attempts=3")),
      ).toBe(true);
    },
  );
  it("deletes expired push subscriptions", async () => {
    mocks.send.mockRejectedValue({ statusCode: 410 });
    const { repository, query } = fixture();
    await processPush(repository, now);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("DELETE FROM push_subscriptions"),
      ),
    ).toBe(true);
  });
  it("retries transient push failures without deleting the subscription", async () => {
    mocks.send.mockRejectedValue({ statusCode: 503 });
    const { repository, query } = fixture();
    await processPush(repository, now);
    expect(
      query.mock.calls.some(([sql]) => sql.includes("next_attempt_at=:retry")),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("DELETE FROM push_subscriptions"),
      ),
    ).toBe(false);
  });
});
