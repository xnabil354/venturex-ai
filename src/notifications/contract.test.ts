import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  digestRequest,
  isPushEndpoint,
  localDate,
  nextRun,
  preferenceSchema,
  subscriptionSchema,
  usableRows,
} from "./contract";

describe("daily trend scheduling", () => {
  it.each([
    ["Asia/Jakarta", "2026-10-22T00:59:00Z", "2026-10-22T01:00:00.000Z"],
    ["Asia/Makassar", "2026-10-22T00:00:00Z", "2026-10-23T00:00:00.000Z"],
    ["Asia/Jayapura", "2026-10-21T22:59:00Z", "2026-10-21T23:00:00.000Z"],
    ["Asia/Jakarta", "2026-12-31T23:00:00Z", "2027-01-01T01:00:00.000Z"],
  ] as const)("schedules a future occurrence in %s", (zone, now, expected) => {
    expect(nextRun(new Date(now), "08:00", zone).toISOString()).toBe(expected);
  });
  it("uses local calendar dates across UTC midnight", () => {
    expect(localDate(new Date("2026-10-21T16:30:00Z"), "Asia/Jakarta")).toBe(
      "2026-10-21",
    );
    expect(localDate(new Date("2026-10-21T16:30:00Z"), "Asia/Jayapura")).toBe(
      "2026-10-22",
    );
  });
  it("uses calendar month boundaries and existing observation timezone", () => {
    expect(
      digestRequest(
        { ...defaultPreferences, period: "month", timezone: "Asia/Jayapura" },
        new Date("2027-01-01T02:00:00Z"),
      ),
    ).toEqual({
      period: "custom-date",
      startDate: "2027-01-01",
      endDate: "2027-01-01",
      geo: "ID",
      property: "web",
    });
  });
  it("preserves explicit Existing topic selection", () => {
    expect(
      digestRequest(
        { ...defaultPreferences, queryKey: "product:2", period: "7d" },
        new Date(),
      ).queryKey,
    ).toBe("product:2");
  });
  it.each(["24:00", "8:00", "12:60", "-1:00"])(
    "rejects invalid clock %s",
    (time) => {
      expect(
        preferenceSchema.safeParse({ ...defaultPreferences, time }).success,
      ).toBe(false);
    },
  );
  it("rejects unknown settings and arbitrary query text", () => {
    expect(
      preferenceSchema.safeParse({ ...defaultPreferences, queryKey: "bakso" })
        .success,
    ).toBe(false);
    expect(
      preferenceSchema.safeParse({ ...defaultPreferences, userId: "another" })
        .success,
    ).toBe(false);
  });
});
describe("digest safety and push endpoints", () => {
  it("bounds results, deduplicates text and removes obvious unrelated harmful terms", () => {
    const rows = [
      "Bakso ayam",
      "bakso ayam",
      "berita mutilasi",
      "Bakso sapi",
      "Bakso ikan",
      "Bakso bakar",
    ].map((query, index) => ({ query, position: index + 1, sourceUrl: null }));
    expect(usableRows(rows).map((row) => row.query)).toEqual([
      "Bakso ayam",
      "Bakso sapi",
      "Bakso ikan",
    ]);
  });
  it.each([
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/token",
    "https://wns2.notify.windows.com/token",
  ])("accepts recognized service %s", (endpoint) =>
    expect(isPushEndpoint(endpoint)).toBe(true),
  );
  it.each([
    "http://fcm.googleapis.com/token",
    "https://127.0.0.1/token",
    "https://fcm.googleapis.com.attacker.test/token",
    "https://fcm.googleapis.com:444/token",
    "https://user@fcm.googleapis.com/token",
    "https://evil.test/token",
  ])("rejects arbitrary outbound target %s", (endpoint) =>
    expect(isPushEndpoint(endpoint)).toBe(false),
  );
  it("requires bounded browser encryption keys", () => {
    expect(
      subscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/token",
        keys: { p256dh: "bad", auth: "bad" },
      }).success,
    ).toBe(false);
  });
});
