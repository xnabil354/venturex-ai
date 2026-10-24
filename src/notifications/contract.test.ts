import { describe, expect, it } from "vitest";
import {
  isPushEndpoint,
  isWeeklyDeliveryDay,
  monthlyDigestRequest,
  nextWeeklyRun,
  notificationPreferenceSchema,
  scheduledMonday,
  subscriptionSchema,
  usableRows,
  weekStart,
} from "./contract";

describe("weekly Food & Drink scheduling", () => {
  it("schedules the next Monday at 12.00 WIB", () => {
    expect(nextWeeklyRun(new Date("2026-10-22T01:00:00Z")).toISOString()).toBe("2026-10-26T05:00:00.000Z");
    expect(nextWeeklyRun(new Date("2026-10-26T05:00:00Z")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
  it("uses Monday and monthly worldwide defaults", () => {
    const now = new Date("2026-10-26T05:00:00Z");
    expect(weekStart(now)).toBe("2026-10-26");
    expect(scheduledMonday(now).toISOString()).toBe("2026-10-26T05:00:00.000Z");
    expect(isWeeklyDeliveryDay(now)).toBe(true);
    expect(isWeeklyDeliveryDay(new Date("2026-10-27T05:00:00Z"))).toBe(false);
    expect(monthlyDigestRequest(now)).toEqual({ period: "custom-date", startDate: "2026-10-01", endDate: "2026-10-26", geo: "", property: "web" });
  });
  it("accepts only the enabled toggle", () => {
    expect(notificationPreferenceSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(notificationPreferenceSchema.safeParse({ enabled: true, period: "month" }).success).toBe(false);
  });
});

describe("digest safety and push endpoints", () => {
  it("bounds results, deduplicates text and removes obvious harmful terms", () => {
    const rows = ["Bakso ayam", "bakso ayam", "berita mutilasi", "Bakso sapi", "Bakso ikan", "Bakso bakar"].map((query, index) => ({ query, position: index + 1, sourceUrl: null }));
    expect(usableRows(rows).map((row) => row.query)).toEqual(["Bakso ayam", "Bakso sapi", "Bakso ikan"]);
  });
  it.each(["https://fcm.googleapis.com/fcm/send/token", "https://updates.push.services.mozilla.com/wpush/v2/token", "https://web.push.apple.com/token", "https://wns2.notify.windows.com/token"])("accepts recognized service %s", (endpoint) => expect(isPushEndpoint(endpoint)).toBe(true));
  it.each(["http://fcm.googleapis.com/token", "https://127.0.0.1/token", "https://fcm.googleapis.com.attacker.test/token", "https://fcm.googleapis.com:444/token", "https://user@fcm.googleapis.com/token", "https://evil.test/token"])("rejects arbitrary outbound target %s", (endpoint) => expect(isPushEndpoint(endpoint)).toBe(false));
  it("requires bounded browser encryption keys", () => {
    expect(subscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/token", keys: { p256dh: "bad", auth: "bad" } }).success).toBe(false);
  });
});
