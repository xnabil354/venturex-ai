// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DashboardRadarPreview } from "./dashboard-radar-preview";
import { radarSnapshotKey } from "@/dashboard/radar-preview";
import { recordRadarHistory } from "@/trend/trend-radar-history";
import { trendRadarResponseSchema } from "@/trend/trend-radar-contract";

const result = {
  provider: "SearchApi.io", retrievedAt: "2026-10-20T07:00:00.000Z", cacheStatus: "NETWORK", requestId: "test", productQuery: "Kopi",
  appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "US", category: 0, timezoneOffsetMinutes: -420, timezone: "Asia/Jakarta" },
  top: [{ position: 1, query: "Kopi lokal A", interestIndex: 72, sourceUrl: null }], rising: [], omittedInvalidRows: { top: 0, rising: 0 },
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("DashboardRadarPreview", () => {
  it("shows explicitly opened history even after the profile product changes", () => {
    recordRadarHistory("account-a", trendRadarResponseSchema.parse(result), null, { period: "24h", property: "web", geo: "US" }, "Amerika Serikat");
    render(<DashboardRadarPreview userId="account-a" productQuery="Teh" state={{ status: "EMPTY", preview: [], observedAt: "2026-10-21T00:00:00.000Z" }} />);
    expect(screen.getByText("Kopi lokal A")).toBeTruthy();
    expect(screen.queryByText(/Riwayat terakhir dibuka/)).toBeNull();
  });
  it("shows only this account's matching product snapshot without provider requests", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    localStorage.setItem(radarSnapshotKey("account-a"), JSON.stringify(result));
    const view = render(<DashboardRadarPreview userId="account-a" productQuery="Kopi" state={{ status: "EMPTY", preview: [] }} />);
    expect(screen.getByText("Kopi lokal A")).toBeTruthy();
    expect(screen.getByText("Indeks minat 72/100")).toBeTruthy();
    view.rerender(<DashboardRadarPreview userId="account-b" productQuery="Kopi" state={{ status: "EMPTY", preview: [] }} />);
    expect(screen.queryByText("Kopi lokal A")).toBeNull();
    view.rerender(<DashboardRadarPreview userId="account-a" productQuery="Soto" state={{ status: "EMPTY", preview: [] }} />);
    expect(screen.queryByText("Kopi lokal A")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("retains the newer server observation when the browser snapshot is older", () => {
    localStorage.setItem(radarSnapshotKey("account-a"), JSON.stringify(result));
    render(<DashboardRadarPreview userId="account-a" productQuery="Kopi" state={{ status: "AVAILABLE", observedAt: "2026-10-21T07:00:00.000Z", preview: [{ id: "new", title: "Sinyal terbaru", categoryName: "Kueri populer", summary: "Indeks minat 90/100", href: "/trends" }] }} />);
    expect(screen.getByText("Sinyal terbaru")).toBeTruthy();
    expect(screen.queryByText("Kopi lokal A")).toBeNull();
  });

  it("keeps the dashboard usable when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage denied"); });
    render(<DashboardRadarPreview userId="account-a" productQuery="Kopi" state={{ status: "EMPTY", preview: [] }} />);
    expect(screen.getByText("Muat data di Trend Radar untuk melihat preview di sini.")).toBeTruthy();
  });
});
