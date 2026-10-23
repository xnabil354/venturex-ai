import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
import { PrivateStartupView } from "@/components/roadmaps/private-startup-view";
import { generatePrivateStartupRoadmap } from "./private-startup-generator";
import { conciseRoadmapText, startupRoadmapDisplayAction } from "./private-startup-text";

describe("roadmap copy", () => {
  it("does not split words or repeat trailing sentence punctuation", () => {
    expect(conciseRoadmapText("Pekerja kantor dan komuter", 17, "pelanggan")).toBe("Pekerja kantor\u2026");
    expect(conciseRoadmapText("a".repeat(500), 70, "pelanggan")).toBe("pelanggan");
    expect(conciseRoadmapText("Keluarga.", 70, "pelanggan")).toBe("Keluarga");
  });
  it("repairs archived clipping only for display and exposes complete archived needs", () => {
    const item = privateEntrepreneurFixture();
    item.hypothesis.analysis!.requirements!.initialNeeds = ["Racikan dan bahan minuman yang konsisten serta aman ditangani.", "Cara menerima dan mencatat pesanan langsung online."];
    const roadmap = generatePrivateStartupRoadmap(item);
    roadmap.generatorVersion = "personalized-v3";
    const snippet = item.hypothesis.analysis!.requirements!.initialNeeds.join("; ").slice(0, 70);
    roadmap.steps[2]!.action = `Siapkan prototipe. Kebutuhan awal: ${snippet}. Periksa biaya.`;
    item.hypothesis.startupRoadmap = roadmap;
    const before = JSON.stringify(item);
    expect(startupRoadmapDisplayAction(item, roadmap.steps[2]!)).not.toContain("Cara m.");
    const html = renderToStaticMarkup(createElement(PrivateStartupView, { item }));
    expect(html).toContain("Cara menerima dan mencatat pesanan langsung online.");
    expect(html).not.toContain("Cara m.");
    expect(JSON.stringify(item)).toBe(before);
  });
});
