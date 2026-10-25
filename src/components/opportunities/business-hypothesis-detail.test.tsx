// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { BusinessHypothesisDetail } from "./business-hypothesis-detail";
import { privateBusinessFixture } from "@/opportunity/test-fixtures/private-business";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("hides scores from legacy unreviewed concepts and requires reanalysis", () => {
  const item = privateBusinessFixture(); delete item.hypothesis.businessAnalysis.conceptAlignmentVersion;
  render(<BusinessHypothesisDetail item={item} initialFresh={false} />);
  expect(screen.queryByText("Business Fit")).toBeNull();
  expect(screen.getByText(/Perbarui analisis untuk memeriksa kesesuaiannya/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Buat Growth Roadmap" }).hasAttribute("disabled")).toBe(true);
});
it("shows business factors and disables roadmap for stale evidence", () => {
  render(<BusinessHypothesisDetail item={privateBusinessFixture()} initialFresh={false} />);
  expect(screen.getByText("Business Fit")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Buat Growth Roadmap" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Perbarui analisis" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(/Analisis sudah lama atau profil berubah/)).toBeTruthy();
});
it("requires explicit consent and preserves previous snapshot on failure", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Penyimpanan gagal" } }) }); vi.stubGlobal("fetch", fetch);
  render(<BusinessHypothesisDetail item={privateBusinessFixture()} initialFresh />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Perbarui analisis" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Analisis gagal dimuat"));
  expect(screen.getByText("Business Fit")).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ consent: true, refresh: true, proposedPrice: { min: 12000, max: 18000 } });
});
