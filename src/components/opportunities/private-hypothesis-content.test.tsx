// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PrivateOpportunityHypothesis } from "@/opportunity/private-hypothesis";
import { PrivateHypothesisContent } from "./private-hypothesis-content";

const hypothesis: PrivateOpportunityHypothesis = {
  title: "Coba es teh dengan pilihan rasa",
  concept: "Coba tawarkan pilihan rasa teh sebagai ide menu tambahan. Ajak calon pembeli mencicipi lalu dengarkan tanggapannya.",
  targetCustomer: "Pelajar dan mahasiswa di sekitar gerai Anda.",
  validationSteps: ["Ajak calon pembeli mencicipi dan catat rasa pilihannya.", "Coba tawarkan produknya, lalu catat tanggapan dan pembelian."],
  assumptions: ["Belum diketahui apakah calon pembeli menyukai rasa ini."],
  profileAlignment: ["Pilihan ini bisa dicoba melalui gerai yang Anda gunakan."],
  evidenceInterpretation: "Ada minat pencarian terkait teh. Ini belum menunjukkan bahwa orang akan membelinya.",
  evidenceGaps: ["Biaya produksi belum tersedia untuk menilai harga jual."],
  limitations: ["Data pencarian tidak menunjukkan jumlah pembelian."],
};

afterEach(cleanup);

describe("readable private hypothesis", () => {
  it("keeps the trial plan visible and makes all uncertainty available in a native disclosure", () => {
    const { container } = render(<PrivateHypothesisContent hypothesis={hypothesis} />);
    expect(screen.getByRole("heading", { name: "Mulai dari langkah kecil" })).toBeTruthy();
    expect(screen.getByText(hypothesis.validationSteps[0]!)).toBeTruthy();
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText("Yang masih perlu dicari tahu"));
    expect(details.open).toBe(true);
    expect(screen.getByText(hypothesis.evidenceGaps![0]!)).toBeTruthy();
    expect(screen.getByText(hypothesis.limitations![0]!)).toBeTruthy();
    fireEvent.click(screen.getByText("Yang masih perlu dicari tahu"));
    expect(details.open).toBe(false);
  });

  it("renders older saved hypotheses without optional analysis fields", () => {
    const legacy: PrivateOpportunityHypothesis = {
      title: hypothesis.title, concept: hypothesis.concept, targetCustomer: hypothesis.targetCustomer,
      validationSteps: hypothesis.validationSteps, assumptions: hypothesis.assumptions,
    };
    render(<PrivateHypothesisContent hypothesis={legacy} />);
    expect(screen.getByText(legacy.targetCustomer)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mulai dari langkah kecil" })).toBeTruthy();
    expect(screen.queryByText("Apa petunjuk dari pencarian?")).toBeNull();
    expect(screen.queryByText("Informasi yang belum tersedia")).toBeNull();
  });
});
