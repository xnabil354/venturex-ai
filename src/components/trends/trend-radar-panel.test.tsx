// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TrendRadarPanel } from "./trend-radar-panel";
import { activateRadarHistory, getRadarHistoryRaw, readRadarHistory, recordRadarHistory } from "@/trend/trend-radar-history";

const data = {
  provider: "SearchApi.io" as const,
  retrievedAt: "2026-10-17T12:00:00.000Z",
  cacheStatus: "NETWORK" as const,
  appliedFilters: {
    period: "24h",
    time: "now 1-d",
    property: "web" as const,
    geo: "" as const,
    category: 0 as const,
    timezoneOffsetMinutes: -420 as const,
    timezone: "Asia/Jakarta" as const,
  },
  productQuery: "Kopi",
  top: [{ position: 1, query: "kopi susu", interestIndex: 100, sourceUrl: "https://trends.google.com/trends/explore?q=kopi" }],
  rising: [{ position: 1, query: "kopi gula aren", growthLabel: "Breakout", growthPercent: null, isBreakout: true, sourceUrl: null }],
  omittedInvalidRows: { top: 0, rising: 0 },
  requestId: "req_test",
};

function success(body: unknown = data): Response {
  return new Response(JSON.stringify({ success: true, data: body, requestId: "req_test" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("TrendRadarPanel", () => {
  it("restores previous results and selected filters after leaving the page without fetching again", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => success());
    vi.stubGlobal("fetch", fetcher);
    const first = render(<TrendRadarPanel viewerId="account-a" productQuery="Kopi" />);
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));
    await screen.findByRole("heading", { name: "Riwayat tren (1)" });
    first.unmount();
    fetcher.mockClear();
    render(<TrendRadarPanel viewerId="account-a" productQuery="Kopi" />);
    expect(screen.getByText("kopi susu")).toBeTruthy();
    expect(screen.getByText("kopi gula aren")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("opens earlier products from history without a new provider request", () => {
    recordRadarHistory("account-a", data, null, { period: "24h", property: "web" }, "Seluruh dunia");
    recordRadarHistory("account-a", { ...data, requestId: "req_tea", productQuery: "Teh", top: [], rising: [] }, null, { period: "24h", property: "web" }, "Seluruh dunia");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel viewerId="account-a" productQuery="Teh" />);
    fireEvent.click(screen.getByRole("button", { name: /Kopi/ }));
    expect(screen.getByText("kopi susu")).toBeTruthy();
    expect(screen.queryByText("Riwayat: Kopi")).toBeNull();
    expect(readRadarHistory(getRadarHistoryRaw("account-a"))?.activeId).toBe("req_test");
    expect(fetcher).not.toHaveBeenCalled();
    expect(activateRadarHistory("account-b", "req_test")).toBe(false);
  });
  it("does not fetch on render, shows the read-only profile query, and renders Top/Rising results", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => success());
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel viewerId="account-a" currentYear={2026} productQuery="Kopi" today="2026-10-17" />);

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Produk usaha dari profil").textContent).toBe("Kopi");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    expect(await screen.findByRole("heading", { name: "Kueri Terpopuler" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Kueri yang Makin Populer" })).toBeTruthy();
    expect(screen.getByText("kopi susu")).toBeTruthy();
    expect(screen.getByText("kopi gula aren")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("venturex:radar-preview:v1:account-a") ?? "null")).toEqual(data);
    expect(localStorage.getItem("venturex:radar-preview:v1:account-b")).toBeNull();
    expect(screen.getAllByText("Google Trends")[0]).toBeTruthy();
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toEqual({ period: "24h", property: "web", geo: "" });
    expect(request).not.toHaveProperty("q");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/trend-radar/related-queries",
      "/api/v1/trend-radar/interest",
    ]);
  });

  it("applies a selected international geography to every dataset and keeps its regional table", async () => {
    const interest = {
      provider: "SearchApi.io",
      productQuery: "Kopi",
      appliedFilters: { ...data.appliedFilters, geo: "US" },
      timeSeries: null,
      regionalInterest: { query: "Kopi", regions: [{ position: 1, geoCode: "US", name: "Amerika Serikat", interestIndex: 42 }], omittedInvalidRegions: 0 },
      availability: { timeSeries: "empty", regionalInterest: "available" },
      datasets: {
        timeSeries: { status: "NETWORK", retrievedAt: data.retrievedAt, error: null },
        regionalInterest: { status: "NETWORK", retrievedAt: data.retrievedAt, error: null },
      },
      requestId: "req_interest_us",
    };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("/api/v1/trend-radar/geographies")) {
        return Response.json({ options: [{ geo: "US", label: "Amerika Serikat" }] });
      }
      if (input === "/api/v1/trend-radar/interest") return success(interest);
      return success({ ...data, appliedFilters: { ...data.appliedFilters, geo: "US" } });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel productQuery="Kopi" />);

    const geographyInput = screen.getByRole("combobox", { name: "Wilayah" });
    fireEvent.focus(geographyInput);
    fireEvent.change(geographyInput, { target: { value: "Amerika Serikat" } });
    fireEvent.click(await screen.findByRole("option", { name: "Amerika Serikat" }));
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    expect(await screen.findByRole("heading", { name: "Minat Menurut Wilayah" })).toBeTruthy();
    expect(screen.getByText("Amerika Serikat")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalledWith("/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson", expect.any(Object));
    const providerRequests = fetcher.mock.calls.filter(([input]) => String(input).includes("/api/v1/trend-radar/related-queries") || String(input).includes("/api/v1/trend-radar/interest"));
    expect(providerRequests).toHaveLength(2);
    expect(providerRequests.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { period: "24h", property: "web", geo: "US" },
      { period: "24h", property: "web", geo: "US" },
    ]);
  });

  it("shows an explicit empty state when SearchApi returns empty arrays", async () => {
    const empty = { ...data, top: [], rising: [] };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => success(empty)));
    render(<TrendRadarPanel productQuery="Kopi" />);

    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));
    expect(await screen.findByText(/^Belum ada kueri teratas untuk filter ini\./u)).toBeTruthy();
    expect(screen.getByText(/^Belum ada kueri meningkat untuk filter ini\./u)).toBeTruthy();
  });

  it("renders a safe error state and does not expose provider details", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      success: false,
      error: { code: "PROVIDER_UNAVAILABLE", message: "SearchApi sementara tidak dapat melayani permintaan." },
      requestId: "req_test",
    }), { status: 503 })));
    render(<TrendRadarPanel productQuery="Kopi" />);

    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));
    expect(await screen.findByText("SearchApi sementara tidak dapat melayani permintaan.")).toBeTruthy();
  });

  it("shows loading state and prevents a duplicate request while one is active", async () => {
    const completions: Array<(response: Response) => void> = [];
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { completions.push(resolve); }));
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel productQuery="Kopi" />);
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    const button = screen.getByRole("button", { name: "Memuat tren..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Memuat kueri terkait...")).toBeTruthy();
    fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const complete of completions) complete(success());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Kueri Terpopuler" })).toBeTruthy());
  });

  it("renders available time series even when regional data fails", async () => {
    const interest = {
      provider: "SearchApi.io",
      productQuery: "Kopi",
      appliedFilters: { ...data.appliedFilters, geo: "ID" },
      timeSeries: { query: "Kopi", points: [{ timestamp: 1792353600, label: "18 Okt 2026, 12.00", interestIndex: 42 }], averageInterest: 42, omittedInvalidPoints: 0 },
      regionalInterest: null,
      availability: { timeSeries: "available", regionalInterest: "failed" },
      datasets: {
        timeSeries: { status: "NETWORK", retrievedAt: data.retrievedAt, error: null },
        regionalInterest: { status: null, retrievedAt: null, error: { code: "PROVIDER_UNAVAILABLE", message: "Data wilayah belum tersedia." } },
      },
      requestId: "req_interest",
    };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("/api/v1/trend-radar/geographies")) return Response.json({ options: [{ geo: "ID", label: "Indonesia" }] });
      if (input === "/api/v1/trend-radar/interest") return success(interest);
      if (input === "/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson") {
        return new Response(JSON.stringify({ type: "FeatureCollection", features: [{
          type: "Feature",
          properties: { shapeISO: "ID-JI", shapeName: "Jawa Timur" },
          geometry: { type: "Polygon", coordinates: [[[110, -6], [112, -6], [112, -8], [110, -6]]] },
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return success({ ...data, appliedFilters: { ...data.appliedFilters, geo: "ID" } });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel productQuery="Kopi" />);
    const geographyInput = screen.getByRole("combobox", { name: "Wilayah" });
    fireEvent.focus(geographyInput);
    fireEvent.change(geographyInput, { target: { value: "Indonesia" } });
    fireEvent.click(await screen.findByRole("option", { name: "Indonesia" }));
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    expect(await screen.findByRole("heading", { name: "Minat Seiring Waktu" })).toBeTruthy();
    expect(screen.getByLabelText(/Grafik minat penelusuran untuk Kopi/u)).toBeTruthy();
    expect(screen.getByText("Data wilayah belum tersedia.")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalledWith("/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson", expect.any(Object));
  });

  it.each([31, null])("renders map, keyboard chart and average with provider mean %s", async (averageInterest) => {
    const interest = {
      provider: "SearchApi.io",
      productQuery: "Kopi",
      appliedFilters: { ...data.appliedFilters, geo: "ID" },
      timeSeries: { query: "Kopi", points: [
        { timestamp: 1792267200, label: "17 Okt 2026, 12.00", interestIndex: 20 },
        { timestamp: 1792353600, label: "18 Okt 2026, 12.00", interestIndex: 42 },
      ], averageInterest, omittedInvalidPoints: 0 },
      regionalInterest: { query: "Kopi", regions: [{ position: 1, geoCode: "ID-JI", name: "Jawa Timur", interestIndex: 42 }], omittedInvalidRegions: 0 },
      availability: { timeSeries: "available", regionalInterest: "available" },
      datasets: {
        timeSeries: { status: "NETWORK", retrievedAt: data.retrievedAt, error: null },
        regionalInterest: { status: "NETWORK", retrievedAt: data.retrievedAt, error: null },
      },
      requestId: "req_interest",
    };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("/api/v1/trend-radar/geographies")) return Response.json({ options: [{ geo: "ID", label: "Indonesia" }] });
      if (input === "/api/v1/trend-radar/interest") return success(interest);
      if (input === "/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson") {
        return new Response(JSON.stringify({ type: "FeatureCollection", features: [{
          type: "Feature",
          properties: { shapeISO: "ID-JI", shapeName: "Jawa Timur" },
          geometry: { type: "Polygon", coordinates: [[[110, -6], [112, -6], [112, -8], [110, -6]]] },
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return success({ ...data, appliedFilters: { ...data.appliedFilters, geo: "ID" } });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel productQuery="Kopi" />);
    const geographyInput = screen.getByRole("combobox", { name: "Wilayah" });
    fireEvent.focus(geographyInput);
    fireEvent.change(geographyInput, { target: { value: "Indonesia" } });
    fireEvent.click(await screen.findByRole("option", { name: "Indonesia" }));
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    const chart = await screen.findByLabelText(/Grafik minat penelusuran untuk Kopi/u);
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText(/Indeks 42 · Label sumber: 18 Okt 2026, 12\.00/u)).toBeTruthy();
    expect(screen.getByText(averageInterest === null ? "Rata-rata pengamatan: 31" : "Rata-rata sumber: 31")).toBeTruthy();
    expect(await screen.findByLabelText("Jawa Timur, indeks 42")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Peringkat minat wilayah" })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledWith("/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson", expect.any(Object));
  });

  it("supports dynamic year options and sends custom Jakarta hour ranges", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => success({
      ...data,
      appliedFilters: { ...data.appliedFilters, period: "custom-hour", time: "2026-10-16T10 2026-10-16T12" },
    }));
    vi.stubGlobal("fetch", fetcher);
    render(<TrendRadarPanel currentYear={2026} productQuery="Kopi" today="2026-10-17" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Rentang waktu" }), { target: { value: "year" } });
    expect(screen.getByRole("option", { name: "2004" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "2026" })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Rentang waktu" }), { target: { value: "custom-hour" } });
    fireEvent.change(screen.getByLabelText(/Jam mulai/u), { target: { value: "2026-10-16T10:00" } });
    fireEvent.change(screen.getByLabelText(/Jam akhir/u), { target: { value: "2026-10-16T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Tren Saat Ini" }));

    await screen.findAllByText("Google Trends");
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toEqual({
      period: "custom-hour",
      property: "web",
      geo: "",
      startDateTime: "2026-10-16T10",
      endDateTime: "2026-10-16T12",
    });
    expect(request).not.toHaveProperty("q");
  });
});
