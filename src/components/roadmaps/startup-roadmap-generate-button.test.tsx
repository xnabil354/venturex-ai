// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

import { StartupRoadmapGenerateButton } from "./startup-roadmap-generate-button";

describe("StartupRoadmapGenerateButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows a controlled validation error from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { code: "PROFILE_INCOMPLETE" } }),
    }));
    render(<StartupRoadmapGenerateButton opportunityId="60000000-0000-4000-8000-000000000001" />);
    fireEvent.click(screen.getByRole("button", { name: "Buat Startup Roadmap" }));
    expect((await screen.findByRole("status")).textContent).toContain("Lengkapi profil sesuai tipe akun");
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("submits only the selected Opportunity and navigates to the saved result", async () => {
    const opportunityId = "60000000-0000-4000-8000-000000000001";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: "50000000-0000-4000-8000-000000000001" } }),
    }));
    render(<StartupRoadmapGenerateButton opportunityId={opportunityId} />);
    fireEvent.click(screen.getByRole("button", { name: "Buat Startup Roadmap" }));

    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith("/roadmaps/50000000-0000-4000-8000-000000000001"));
    expect(fetch).toHaveBeenCalledWith("/api/v1/roadmaps", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ opportunityId }),
    }));
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  it("offers five-stage Growth copy while leaving roadmap type to the server", async () => {
    const opportunityId = "60000000-0000-4000-8000-000000000002";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: "50000000-0000-4000-8000-000000000002" } }),
    }));
    render(<StartupRoadmapGenerateButton opportunityId={opportunityId} roadmapType="GROWTH" />);

    expect(screen.getByRole("button", { name: "Buat Growth Roadmap" })).toBeTruthy();
    expect(screen.getByText(/Lima tahap uji untuk bisnis yang sudah berjalan/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buat Growth Roadmap" }));

    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith("/roadmaps/50000000-0000-4000-8000-000000000002"));
    expect(fetch).toHaveBeenCalledWith("/api/v1/roadmaps", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ opportunityId }),
    }));
  });
});
