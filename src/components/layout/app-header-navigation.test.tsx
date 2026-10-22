// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
