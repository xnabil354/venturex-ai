// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WORLDWIDE_TREND_GEO } from "@/trend/trend-radar-contract";
import { GoogleTrendsGeographySelect } from "./google-trends-geography-select";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GoogleTrendsGeographySelect", () => {
  it("supports keyboard navigation and selects a provider-backed geography", async () => {
    const onChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => Response.json({
      options: [
        { geo: "US", label: "Amerika Serikat" },
        { geo: "US-CA", label: "California · Amerika Serikat" },
      ],
    })));
    render(<GoogleTrendsGeographySelect id="geo" onChange={onChange} value={WORLDWIDE_TREND_GEO} />);

    const input = screen.getByRole("combobox", { name: "Wilayah" });
    fireEvent.focus(input);
    expect(await screen.findByRole("option", { name: "Amerika Serikat" })).toBeTruthy();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ geo: "US", label: "Amerika Serikat" });
  });
});
