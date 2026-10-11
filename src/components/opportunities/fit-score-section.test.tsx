// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: React.ComponentProps<"a">) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/opportunity/saved-actions", () => ({
  setOpportunitySavedAction: vi.fn(),
}));

import type { OpportunityDetailDto } from "@/opportunity/dto";
import type { OpportunityEvidenceState } from "@/opportunity/evidence-dto";
import type { OpportunitySaveState } from "@/opportunity/saved-dto";
import type { FitScoreApiDto } from "@/scoring/fit-score-api-dto";
import { OpportunityDetail } from "./opportunity-detail";
import { FitScoreSection } from "./fit-score-section";

const fetchMock = vi.fn<typeof fetch>();
const DISCLAIMER =
  "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis.";

function availableFitScore(
  modelType: "ENTREPRENEUR_FIT" | "BUSINESS_FIT" = "ENTREPRENEUR_FIT",
  value = 82.5,
): Extract<FitScoreApiDto, { status: "AVAILABLE" }> {
  return {
    status: "AVAILABLE",
    modelType,
    value,
    policyVersion: "FIT_MVP_HEURISTIC_V1",
    confidence: null,
    label: "MVP Heuristic Fit Score",
    disclaimer: DISCLAIMER,
    breakdown: [
      {
        component: modelType === "ENTREPRENEUR_FIT" ? "budgetFit" : "priceFit",
        value,
        weightedContribution: 32.5,
        interpretation: "Batas anggaran mencukupi.",
      },
    ],
  };
}

function insufficientFitScore(): Extract<FitScoreApiDto, { status: "INSUFFICIENT_DATA" }> {
  return {
    status: "INSUFFICIENT_DATA",
    modelType: "BUSINESS_FIT",
    value: null,
    policyVersion: "FIT_MVP_HEURISTIC_V1",
    confidence: null,
    label: "MVP Heuristic Fit Score",
    disclaimer: DISCLAIMER,
    missingComponents: ["priceFit", "channelFit"],
    reason: "ACTIVE_COMPONENTS_UNAVAILABLE",
  };
}

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function successEnvelope(fitScore: unknown): unknown {
  return { success: true, data: { fitScore } };
}

const opportunity: OpportunityDetailDto = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman berbasis tanaman",
  description: "Deskripsi tersimpan dari katalog peluang.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen minuman nabati.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Beberapa penawaran tercatat.",
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Tren minuman terpublikasi",
  },
};

const emptyEvidence: OpportunityEvidenceState = { status: "EMPTY", items: [], limited: false };
const unsaved: OpportunitySaveState = { status: "AVAILABLE", saved: false };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FitScoreSection", () => {
  it.each([
    ["Entrepreneur", "ENTREPRENEUR_FIT" as const, "Entrepreneur Fit", "Kecukupan modal"],
    ["UMKM", "BUSINESS_FIT" as const, "Business Fit", "Rentang harga"],
  ] as const)("renders the actual AVAILABLE result for %s", async (_userType, modelType, modelLabel, componentLabel) => {
    fetchMock.mockResolvedValue(apiResponse(successEnvelope(availableFitScore(modelType))));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect(await screen.findByText("MVP Heuristic Fit Score")).toBeTruthy();
    expect(screen.getByText(/Versi kebijakan: FIT_MVP_HEURISTIC_V1/u)).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && (element.textContent?.includes(`Model: ${modelLabel}`) ?? false),
    )).toBeTruthy();
    expect(screen.getByText(componentLabel)).toBeTruthy();
    expect(screen.getByText("Batas anggaran mencukupi.")).toBeTruthy();
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/opportunities/${opportunity.id}/fit-score`,
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });

  it("preserves zero as a valid AVAILABLE score", async () => {
    fetchMock.mockResolvedValue(apiResponse(successEnvelope(availableFitScore("BUSINESS_FIT", 0))));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect(await screen.findByLabelText("Fit Score 0")).toBeTruthy();
    expect(screen.queryByText("Data belum cukup untuk menghitung Fit Score.")).toBeNull();
  });

  it("shows INSUFFICIENT_DATA without a numeric placeholder", async () => {
    fetchMock.mockResolvedValue(apiResponse(successEnvelope(insufficientFitScore())));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect(await screen.findByText("Data belum cukup untuk menghitung Fit Score.")).toBeTruthy();
    expect(screen.getByText("Komponen yang belum tersedia: Rentang harga, Kanal penjualan.")).toBeTruthy();
    expect(screen.queryByText("0 / 100")).toBeNull();
    expect(screen.queryByText("50 / 100")).toBeNull();
  });

  it("shows an accessible loading state while the request is pending", () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect(screen.getByRole("status").textContent).toContain("Memuat Fit Score");
    expect(screen.getByRole("status").closest("div")?.getAttribute("aria-busy")).toBe("true");
  });

  it.each([
    [400, "Permintaan Fit Score tidak valid.", null, false],
    [401, "Sesi Anda tidak dapat digunakan", "/login", false],
    [404, "Fit Score tidak tersedia untuk Opportunity ini.", null, false],
    [422, "Lengkapi profil", "/profile", false],
    [500, "Fit Score belum dapat dimuat.", null, true],
  ] as const)("maps HTTP %i to a safe, non-sensitive state", async (status, message, link, retry) => {
    fetchMock.mockResolvedValue(apiResponse({ success: false, error: { message: "private raw detail" } }, status));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(screen.queryByText("private raw detail")).toBeNull();
    if (link) expect(screen.getByRole("link").getAttribute("href")).toBe(link);
    if (retry) expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    else expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("retries a temporary network failure without exposing exception text", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("private database exception"))
      .mockResolvedValueOnce(apiResponse(successEnvelope(availableFitScore())));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Detail Opportunity tetap tersedia.");
    expect(screen.queryByText("private database exception")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("MVP Heuristic Fit Score")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores out-of-order results after Opportunity ID changes and aborts the old request", async () => {
    const pending: { readonly resolve: (response: Response) => void; readonly signal: AbortSignal | null }[] = [];
    fetchMock.mockImplementation((_input, init) => new Promise<Response>((resolve) => {
      pending.push({ resolve, signal: (init?.signal as AbortSignal | undefined) ?? null });
    }));
    const { rerender } = render(<FitScoreSection opportunityId="opportunity-old" />);
    await waitFor(() => expect(pending).toHaveLength(1));

    rerender(<FitScoreSection opportunityId="opportunity-new" />);
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal?.aborted).toBe(true);

    pending[1]?.resolve(apiResponse(successEnvelope(availableFitScore("BUSINESS_FIT", 73))));
    expect(await screen.findByLabelText("Fit Score 73")).toBeTruthy();
    pending[0]?.resolve(apiResponse(successEnvelope(availableFitScore("ENTREPRENEUR_FIT", 11))));
    await waitFor(() => expect(screen.getByLabelText("Fit Score 73")).toBeTruthy());
    expect(screen.queryByLabelText("Fit Score 11")).toBeNull();
  });

  it("aborts the active request when unmounted", async () => {
    const request: { signal?: AbortSignal } = {};
    fetchMock.mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal) request.signal = signal;
      return new Promise<Response>(() => undefined);
    });
    const { unmount } = render(<FitScoreSection opportunityId={opportunity.id} />);
    await waitFor(() => expect(request.signal).toBeDefined());

    unmount();

    expect(request.signal?.aborted).toBe(true);
  });

  it("does not render unexpected private fields from the response", async () => {
    const exposedResult = {
      ...availableFitScore(),
      privateProfile: "private profile payload",
      userId: "private user identifier",
    };
    fetchMock.mockResolvedValue(apiResponse(successEnvelope(exposedResult)));

    render(<FitScoreSection opportunityId={opportunity.id} />);

    expect(await screen.findByText("MVP Heuristic Fit Score")).toBeTruthy();
    expect(screen.queryByText("private profile payload")).toBeNull();
    expect(screen.queryByText("private user identifier")).toBeNull();
  });
});

describe("OpportunityDetail Fit Score integration", () => {
  it("keeps existing Opportunity content visible when Fit Score fails", async () => {
    fetchMock.mockRejectedValue(new Error("sensitive infrastructure details"));

    render(<OpportunityDetail evidence={emptyEvidence} item={opportunity} opportunityScore={{ status: "ERROR" }} riskAssessment={{ status: "ERROR" }} saveState={unsaved} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Detail Opportunity tetap tersedia.");
    expect(screen.getByRole("heading", { name: opportunity.name })).toBeTruthy();
    expect(screen.getByText(opportunity.description)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Evidence" })).toBeTruthy();
    expect(screen.getByText("Belum ada evidence tersimpan untuk Opportunity ini.")).toBeTruthy();
    expect(screen.getByRole("link", { name: opportunity.relatedTrend.title })).toBeTruthy();
    expect(screen.queryByText("sensitive infrastructure details")).toBeNull();
  });
});
