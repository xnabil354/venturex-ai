// @vitest-environment jsdom
import { it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PrivateComparisonRecovery } from "./private-comparison-recovery";
it("removes only unavailable IDs from the current owner selection", () => {
  sessionStorage.setItem("venturex:compare:a", JSON.stringify(["keep", "deleted", "new-selection"]));
  sessionStorage.setItem("venturex:compare:b", JSON.stringify(["deleted"]));
  render(<PrivateComparisonRecovery ownerId="a" removedIds={["deleted"]} />);
  expect(JSON.parse(sessionStorage.getItem("venturex:compare:a")!)).toEqual(["keep", "new-selection"]);
  expect(JSON.parse(sessionStorage.getItem("venturex:compare:b")!)).toEqual(["deleted"]);
  cleanup(); sessionStorage.clear();
});
