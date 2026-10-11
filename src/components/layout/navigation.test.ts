import { describe, expect, it } from "vitest";

import { appNavigation, getNavigationLabel, isNavigationActive } from "./navigation";

describe("Trend List navigation", () => {
  it("exposes the usable Trend Radar route and marks it active", () => {
    expect(appNavigation).toContainEqual({ href: "/trends", label: "Trend Radar" });
    expect(isNavigationActive("/trends", "/trends")).toBe(true);
    expect(getNavigationLabel("/trends")).toBe("Trend Radar");
  });

  it("exposes Opportunity Finder and marks its route active", () => {
    expect(appNavigation).toContainEqual({
      href: "/opportunities",
      label: "Opportunity Finder",
    });
    expect(isNavigationActive("/opportunities", "/opportunities")).toBe(true);
    expect(getNavigationLabel("/opportunities")).toBe("Opportunity Finder");
  });

  it("exposes Saved Opportunities and marks its route active", () => {
    expect(appNavigation).toContainEqual({
      href: "/saved",
      label: "Saved Opportunities",
    });
    expect(isNavigationActive("/saved", "/saved")).toBe(true);
    expect(getNavigationLabel("/saved")).toBe("Saved Opportunities");
  });

  it("exposes the saved Roadmap route and marks detail pages active", () => {
    expect(appNavigation).toContainEqual({ href: "/roadmaps", label: "Startup Roadmap" });
    expect(isNavigationActive("/roadmaps/60000000-0000-4000-8000-000000000001", "/roadmaps")).toBe(true);
    expect(getNavigationLabel("/roadmaps/60000000-0000-4000-8000-000000000001")).toBe("Startup Roadmap");
  });
});
