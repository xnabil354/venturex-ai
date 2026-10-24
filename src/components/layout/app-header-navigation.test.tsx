// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) =>
      React.createElement("a", { href, ...props }),
  };
});

import { AppHeaderNavigation } from "./app-header-navigation";

afterEach(() => cleanup());

describe("AppHeaderNavigation profile control", () => {
  it("uses an icon trigger and opens profile editing and logout actions", () => {
    render(<AppHeaderNavigation userEmail="owner@example.com" />);

    const profileButton = screen.getByRole("button", { name: "Menu profil" });
    expect(screen.queryByText("Profile")).toBeNull();
    expect(screen.queryByText("•")).toBeNull();
    fireEvent.click(profileButton);

    expect(profileButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Edit profil" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(profileButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Edit profil" })).toBeNull();
  });

  it("shows the authenticated user's remaining credits inside the account menu", () => {
    render(<AppHeaderNavigation availableCredits={7} userEmail="owner@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Menu profil" }));
    const credits = screen.getByRole("link", { name: "7 kredit tersedia. Buka paket dan kredit" });
    expect(credits.getAttribute("href")).toBe("/billing");
    expect(credits.textContent).toContain("7 kredit");
  });
});

describe("AppHeaderNavigation mobile navigation", () => {
  it("opens mobile navigation panel with exact items and closes on Escape", () => {
    render(<AppHeaderNavigation availableCredits={10} userEmail="owner@example.com" />);

    const menuButton = screen.getByRole("button", { name: "Buka menu navigasi" });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();

    fireEvent.click(menuButton);
    expect(menuButton.getAttribute("aria-expanded")).toBe("true");

    const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(mobileNav).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Trend Radar" })).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Opportunity Finder" })).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Saved Opportunities" })).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Roadmaps" })).toBeTruthy();
    expect(within(mobileNav).getByRole("link", { name: "Paket & Kredit" }).getAttribute("href")).toBe("/billing");

    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });

  it("closes when the backdrop button is clicked", () => {
    render(<AppHeaderNavigation userEmail="owner@example.com" />);

    const menuButton = screen.getByRole("button", { name: "Buka menu navigasi" });
    fireEvent.click(menuButton);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();

    const closeButtons = screen.getAllByRole("button", { name: "Tutup menu navigasi" });
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]!);
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });
});
