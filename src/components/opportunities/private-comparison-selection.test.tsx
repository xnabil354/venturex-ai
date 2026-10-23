// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PrivateOpportunityFinder } from "./private-opportunity-finder";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
it("keeps selections across list pages, bounds to three, and isolates accounts", () => {
  const first = privateEntrepreneurFixture();
  const second = { ...first, id: "90000000-0000-4000-8000-000000000022" };
  const props = { comparisonOwnerId: "owner-a", showScoreDetails: true, view: "saved" as const };
  const a = render(<PrivateOpportunityFinder {...props} initialItems={[first]} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Bandingkan/ }));
  a.unmount();
  const b = render(<PrivateOpportunityFinder {...props} initialItems={[second]} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Bandingkan/ }));
  expect(screen.getByRole("link", { name: "Lihat perbandingan" }).getAttribute("href")).toContain(`${first.id},${second.id}`);
  b.unmount();
  render(<PrivateOpportunityFinder {...props} comparisonOwnerId="owner-b" initialItems={[first]} />);
  expect((screen.getByRole("checkbox", { name: /Bandingkan/ }) as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole("link", { name: "Lihat perbandingan" })).toBeNull();
});
