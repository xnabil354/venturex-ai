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

import { PrivateOpportunityFinder } from "./private-opportunity-finder";

if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (typeof HTMLDialogElement.prototype.close !== "function") {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
}

const timeoutMessage = "Permintaan belum berhasil. Coba lagi.";
const retrievedAt = "2026-10-18T04:00:00.000Z";
const signalOption = {
  id: "90000000-0000-4000-8000-000000000001",
  sourceToken: "v1." + "x".repeat(100),
  sourceType: "RELATED_QUERY_TOP" as const,
  productQuery: "kopi",
  query: "kopi susu viral",
  position: 1,
  interestIndex: 50,
  growthLabel: null,
  growthPercent: null,
  isBreakout: false,
  geo: "" as const,
  period: "24 jam terakhir",
  providerTime: "now 1-d",
  searchProperty: "web" as const,
  retrievedAt,
  expiresAt: "2026-10-18T04:05:00.000Z",
  publisher: "Google Trends" as const,
  provider: "SearchApi.io" as const,
  url: "https://trends.google.com/trends/explore?geo=&q=kopi",
  providerSourceUrl: null,
};
const generatedItem = {
  id: "90000000-0000-4000-8000-000000000002",
  hypothesis: {
    title: "Uji kemasan soto",
    opportunityType: "NEW_VARIANT" as const,
    concept: "Uji dua varian soto kemasan yang praktis untuk dibawa.",
    targetCustomer: "Calon pelanggan lokal yang membutuhkan kemasan praktis.",
    validationSteps: [
      "Wawancarai 10 calon pelanggan tentang pilihan kemasan.",
      "Lakukan pengujian selama 7 hari dan catat tanggapan.",
    ],
    assumptions: ["Calon pelanggan mungkin menyukai kemasan yang praktis."],
    profileAlignment: ["Sesuai dengan produk dan kanal usaha yang tercatat."],
    profileReferences: ["profile.products"],
    evidenceInterpretation: "Kueri terkait menunjukkan minat pencarian, bukan pembelian.",
    evidenceReferences: ["searchapi_test_source"],
    evidenceGaps: ["Data transaksi 30 hari masih perlu dikumpulkan."],
    limitations: ["Google Trends tidak mengukur transaksi atau pembelian."],
  },
  source: {
    sourceType: signalOption.sourceType,
    productQuery: signalOption.productQuery,
    query: signalOption.query,
    position: signalOption.position,
    interestIndex: signalOption.interestIndex,
    growthLabel: signalOption.growthLabel,
    growthPercent: signalOption.growthPercent,
    isBreakout: signalOption.isBreakout,
    geo: signalOption.geo,
    period: signalOption.period,
    providerTime: signalOption.providerTime,
    searchProperty: signalOption.searchProperty,
    retrievedAt: signalOption.retrievedAt,
    expiresAt: signalOption.expiresAt,
    publisher: signalOption.publisher,
    provider: signalOption.provider,
    url: signalOption.url,
    providerSourceUrl: signalOption.providerSourceUrl,
    transport: "SearchApi.io" as const,
    sourceId: "searchapi_test_source",
    promptVersion: "opportunity-profile-searchapi-v4",
  },
  provider: "ninerouter" as const,
  model: "cx/gpt-6-luna-xhigh" as const,
  generatedAt: retrievedAt,
  saved: false,
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input) => {
    if (String(input).endsWith("/signals")) {
      return Response.json({
        data: {
          provider: "SearchApi.io",
          productQuery: "kopi",
          retrievedAt,
          appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "" },
          top: [signalOption],
          rising: [],
        },
      });
    }
    return Response.json({
      error: { code: "AI_UPSTREAM_UNAVAILABLE", message: timeoutMessage },
    }, { status: 503 });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PrivateOpportunityFinder timeout state", () => {
  it("keeps the selected SearchApi signal visible and shows the accurate timeout message", async () => {
    render(
      <PrivateOpportunityFinder
        initialItems={[]}
        profileContextCategories={["Kategori usaha"]}
        profileContextAvailable
        providerAvailable
        evidenceSigningAvailable
        searchApiAvailable
        sourceProcessingApproved
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal" }));
    const selectedSignal = await screen.findByRole("radio", { name: /kopi susu viral/u });
    expect(selectedSignal).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Hipotesis dengan AI" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(timeoutMessage));

    expect(screen.getByRole("radio", { name: /kopi susu viral/u })).toHaveProperty("checked", true);
    expect(screen.getByText("kopi susu viral", { selector: "strong" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a clear Indonesian status while AI analysis is in progress", async () => {
    let finishGeneration: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith("/signals")) {
        return Response.json({
          data: {
            provider: "SearchApi.io",
            productQuery: "kopi",
            retrievedAt,
            appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "" },
            top: [signalOption],
            rising: [],
          },
        });
      }
      return await new Promise<Response>((resolve) => { finishGeneration = resolve; });
    });
    render(
      <PrivateOpportunityFinder
        initialItems={[]}
        profileContextCategories={["Kategori usaha"]}
        profileContextAvailable
        providerAvailable
        evidenceSigningAvailable
        searchApiAvailable
        sourceProcessingApproved
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal" }));
    fireEvent.click(await screen.findByRole("radio", { name: /kopi susu viral/u }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Hipotesis dengan AI" }));

    const progressButton = await screen.findByRole("button", { name: "AI sedang menganalisis..." });
    expect(progressButton.hasAttribute("disabled")).toBe(true);
    finishGeneration?.(Response.json({ error: { code: "AI_UPSTREAM_UNAVAILABLE", message: timeoutMessage } }, { status: 503 }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(timeoutMessage));
  });

  it("requests and displays signals for the selected international region", async () => {
    const americanSignal = { ...signalOption, geo: "US", url: "https://trends.google.com/trends/explore?geo=US&q=kopi" };
    fetchMock.mockImplementation(async (input) => {
      if (String(input).startsWith("/api/v1/trend-radar/geographies")) {
        return Response.json({ options: [{ geo: "US", label: "Amerika Serikat" }] });
      }
      if (String(input).endsWith("/signals")) {
        return Response.json({
          data: {
            provider: "SearchApi.io",
            productQuery: "kopi",
            retrievedAt,
            appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "US" },
            top: [americanSignal],
            rising: [],
          },
        });
      }
      return Response.json({ error: { code: "UNEXPECTED_REQUEST" } }, { status: 500 });
    });

    render(
      <PrivateOpportunityFinder
        initialItems={[]}
        profileContextCategories={["Kategori usaha"]}
        profileContextAvailable
        providerAvailable
        evidenceSigningAvailable
        searchApiAvailable
        sourceProcessingApproved
      />,
    );

    const geographyInput = screen.getByRole("combobox", { name: "Wilayah" });
    fireEvent.focus(geographyInput);
    fireEvent.change(geographyInput, { target: { value: "Amerika Serikat" } });
    fireEvent.click(await screen.findByRole("option", { name: "Amerika Serikat" }));
    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal" }));

    expect(await screen.findByRole("radio", { name: /kopi susu viral/u })).toBeTruthy();
    const signalsCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/signals"));
    expect(JSON.parse(String(signalsCall?.[1]?.body))).toEqual({ period: "24h", property: "web", geo: "US" });
    expect(screen.getAllByText(/Amerika Serikat/u).length).toBeGreaterThan(0);
  });

  it("displays a successfully generated hypothesis with proposed numeric validation steps", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith("/signals")) {
        return Response.json({
          data: {
            provider: "SearchApi.io",
            productQuery: "kopi",
            retrievedAt,
            appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "" },
            top: [signalOption],
            rising: [],
          },
        });
      }
      return Response.json({ outcome: "HYPOTHESES", data: [generatedItem] });
    });

    render(
      <PrivateOpportunityFinder
        initialItems={[]}
        profileContextCategories={["Kategori usaha"]}
        profileContextAvailable
        providerAvailable
        evidenceSigningAvailable
        searchApiAvailable
        sourceProcessingApproved
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal" }));
    fireEvent.click(await screen.findByRole("radio", { name: /kopi susu viral/u }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Hipotesis dengan AI" }));

    expect(await screen.findByText("Uji dua varian soto kemasan yang praktis untuk dibawa.")).toBeTruthy();
    expect(screen.getByText("Wawancarai 10 calon pelanggan tentang pilihan kemasan.")).toBeTruthy();
    expect(screen.getByText("Lakukan pengujian selama 7 hari dan catat tanggapan.")).toBeTruthy();
    expect(screen.getByText("Data transaksi 30 hari masih perlu dikumpulkan.")).toBeTruthy();
  });

  it("asks before deleting a hypothesis and removes it from the account after success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const savedItem = { ...generatedItem, saved: true };

    render(<PrivateOpportunityFinder initialItems={[savedItem]} view="saved" />);
    expect(document.getElementById(`hypothesis-${savedItem.id}`)?.getAttribute("data-hypothesis-id")).toBe(savedItem.id);
    expect(screen.getByRole("heading", { name: "Saved Opportunities" })).toBeTruthy();
    expect(screen.queryByText("Arsip Pribadi")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Hapus hipotesis: ${savedItem.hypothesis.title}` }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation.textContent).toContain(savedItem.hypothesis.title);
    expect(confirmation.textContent).toContain("Saved Opportunities");
    fireEvent.click(screen.getByRole("button", { name: /^Hapus hipotesis$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/opportunities/ideas", expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ id: savedItem.id }),
    })));
    expect(await screen.findByRole("heading", { name: "Belum ada simpanan" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps the hypothesis when deletion is cancelled", async () => {
    render(<PrivateOpportunityFinder initialItems={[generatedItem]} />);

    fireEvent.click(screen.getByRole("button", { name: `Hapus hipotesis: ${generatedItem.hypothesis.title}` }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(generatedItem.hypothesis.concept)).toBeTruthy();
  });

  it("closes the deletion dialog with Escape", async () => {
    render(<PrivateOpportunityFinder initialItems={[generatedItem]} />);

    fireEvent.click(screen.getByRole("button", { name: `Hapus hipotesis: ${generatedItem.hypothesis.title}` }));
    const confirmation = await screen.findByRole("alertdialog");
    fireEvent(confirmation, new Event("cancel", { cancelable: true }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the hypothesis visible and explains when the server rejects deletion", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Coba lagi nanti." } }, { status: 503 }));
    render(<PrivateOpportunityFinder initialItems={[generatedItem]} />);

    fireEvent.click(screen.getByRole("button", { name: `Hapus hipotesis: ${generatedItem.hypothesis.title}` }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /^Hapus hipotesis$/ }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Permintaan belum berhasil. Coba lagi.");
    expect(screen.getByText(generatedItem.hypothesis.concept)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("removes decorative synthesis and privacy labels from the hypothesis view", () => {
    render(<PrivateOpportunityFinder initialItems={[generatedItem]} />);

    expect(screen.queryByText("Sintesis Hipotesis AI")).toBeNull();
    expect(screen.queryByText("Privat untuk akun Anda")).toBeNull();
  });
});
