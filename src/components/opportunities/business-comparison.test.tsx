// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BusinessComparison } from "./business-comparison";
import { privateBusinessFixture } from "@/opportunity/test-fixtures/private-business";

afterEach(cleanup);
it("compares contextual trend and actual feasibility and returns to Saved", () => {
  render(<BusinessComparison items={[privateBusinessFixture()]} removedCount={0} from="saved" />);
  expect(screen.getByRole("link", { name: "Kembali ke peluang tersimpan" }).getAttribute("href")).toBe("/saved");
  expect(screen.getByText(/Bakso ayam · 1 tahun · Indonesia/).textContent).toContain("Meningkat");
  expect(screen.getByText(/Sederhana · 100 \/ 100/).textContent).toContain("Siapkan contoh penawaran");
  expect(screen.getByText("Rincian faktor")).toBeTruthy();
});
it("keeps missing trend and execution data explicit", () => {
  const item = privateBusinessFixture();
  item.hypothesis.businessAnalysis.trend = null;
  item.hypothesis.businessAnalysis.requirements!.complexity = null;
  render(<BusinessComparison items={[item]} removedCount={0} />);
  expect(screen.getByText("Data tren belum tersedia.")).toBeTruthy();
  expect(screen.getByText(/Belum tersedia. Kebutuhan pelaksanaan/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Kembali ke peluang" }).getAttribute("href")).toBe("/opportunities");
});
it("does not present an unverified legacy analysis as comparable", () => {
  const item = privateBusinessFixture(); delete item.hypothesis.businessAnalysis.conceptAlignmentVersion;
  render(<BusinessComparison items={[item]} removedCount={1} from="saved" />);
  expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  expect(screen.getByText(/perlu dianalisis ulang/)).toBeTruthy();
});
