import { describe, expect, it } from "vitest";

import {
  assessRisk,
  type RiskAssessmentInputs,
} from "./risk-assessment";

const inputs: RiskAssessmentInputs = {
  competitionLevel: { value: "High", source: "Tingkat kompetisi tersimpan", reference: "opportunities.competition_level" },
  capitalMin: { value: "1000000", source: "Modal minimum tersimpan", reference: "opportunity_fit_requirements.capital_min" },
  capitalMax: { value: "5000000", source: "Modal maksimum tersimpan", reference: "opportunity_fit_requirements.capital_max" },
  operationalComplexity: { value: "72.50", source: "Kompleksitas operasional tersimpan", reference: "opportunity_fit_requirements.operational_complexity" },
  executionFeasibility: { value: "61.00", source: "Execution Feasibility tersimpan", reference: "opportunities.execution_feasibility" },
  marketSustainability: { value: "80.00", source: "Market Sustainability tersimpan", reference: "opportunities.market_sustainability" },
};

function numericPolicy(overrides: Record<string, unknown> = {}) {
  return {
    modelType: "RISK",
    version: "synthetic-risk-v1",
    aggregation: "HIGHEST_RISK",
    requiredFactors: ["executionComplexity"],
    rules: [{
      factor: "executionComplexity",
      source: "operationalComplexity",
      kind: "NUMERIC_THRESHOLDS",
      unit: "/100",
      direction: "HIGHER_IS_RISKIER",
      mediumThreshold: 40,
      highThreshold: 70,
    }],
    limitations: ["Synthetic policy used only by this isolated test."],
    ...overrides,
  };
}

function withComplexity(value: string | null): RiskAssessmentInputs {
  return { ...inputs, operationalComplexity: { ...inputs.operationalComplexity, value } };
}

function capitalPolicy(
  source: "capitalMin" | "capitalMax",
  options: {
    readonly unit?: string;
    readonly omitUnit?: boolean;
    readonly mediumThreshold?: number;
    readonly highThreshold?: number;
  } = {},
) {
  const rule: Record<string, unknown> = {
    factor: "capitalRequirement",
    source,
    kind: "NUMERIC_THRESHOLDS",
    direction: "HIGHER_IS_RISKIER",
    mediumThreshold: options.mediumThreshold ?? 2_000_000,
    highThreshold: options.highThreshold ?? 4_000_000,
  };
  if (!options.omitUnit) rule.unit = options.unit ?? "IDR";

  return numericPolicy({
    requiredFactors: ["capitalRequirement"],
    rules: [rule],
  });
}

function withCapitalValue(source: "capitalMin" | "capitalMax", value: string): RiskAssessmentInputs {
  return { ...inputs, [source]: { ...inputs[source], value } };
}

describe("assessRisk", () => {
  it.each([
    ["LOW", "10.00"],
    ["MEDIUM", "55.00"],
    ["HIGH", "90.00"],
  ] as const)("deterministically assigns the configured %s level", (level, value) => {
    const first = assessRisk({ policy: numericPolicy(), inputs: withComplexity(value) });
    const second = assessRisk({ policy: numericPolicy(), inputs: withComplexity(value) });

    expect(first).toEqual(second);
    expect(first).toMatchObject({ status: "ASSESSED", level, modelVersion: "synthetic-risk-v1" });
  });

  it("returns grounded reasons, actual factor values, sources, and limitations", () => {
    const result = assessRisk({
      policy: numericPolicy(),
      inputs,
      evidenceReferences: [{
        sourceName: "Laporan terkurasi",
        sourceReference: "Tabel 4, halaman 8",
        sourceUrl: "https://example.org/report",
      }],
    });

    expect(result).toMatchObject({
      status: "ASSESSED",
      level: "HIGH",
      reasons: [expect.stringContaining("72.50 /100")],
      factorsConsidered: [{
        factor: "executionComplexity",
        value: "72.50 /100",
        source: "Kompleksitas operasional tersimpan",
        sourceReference: "opportunity_fit_requirements.operational_complexity",
      }],
      evidenceReferences: [{ sourceName: "Laporan terkurasi", sourceReference: "Tabel 4, halaman 8" }],
      limitations: expect.arrayContaining(["Synthetic policy used only by this isolated test."]),
      factorsNotAssessed: expect.arrayContaining(["trendVolatility", "marketUncertainty"]),
    });
    if (result.status === "ASSESSED") expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("does not assign a level when a required input is missing", () => {
    expect(assessRisk({ policy: numericPolicy(), inputs: withComplexity(null) })).toMatchObject({
      status: "INSUFFICIENT_DATA",
      level: null,
      reason: "REQUIRED_INPUTS_UNAVAILABLE",
      missingFactors: ["executionComplexity"],
    });
  });

  it("rejects reversed thresholds and unsupported factor inputs", () => {
    expect(() => assessRisk({
      policy: numericPolicy({ rules: [{
        factor: "executionComplexity",
        source: "operationalComplexity",
        kind: "NUMERIC_THRESHOLDS",
        unit: "/100",
        direction: "HIGHER_IS_RISKIER",
        mediumThreshold: 80,
        highThreshold: 40,
      }] }),
      inputs,
    })).toThrow("thresholds must increase");

    expect(() => assessRisk({
      policy: numericPolicy({ rules: [{
        factor: "trendVolatility",
        source: "trendDirection",
        kind: "NUMERIC_THRESHOLDS",
        unit: "direction",
        direction: "HIGHER_IS_RISKIER",
        mediumThreshold: 1,
        highThreshold: 2,
      }] }),
      inputs,
    })).toThrow("supported factor and input source");
  });

  it("rejects unsupported factor, source, and rule type combinations", () => {
    expect(() => assessRisk({
      policy: numericPolicy({
        requiredFactors: ["trendVolatility"],
        rules: [{
          factor: "trendVolatility",
          source: "capitalMin",
          kind: "NUMERIC_THRESHOLDS",
          unit: "IDR",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 2_000_000,
          highThreshold: 4_000_000,
        }],
      }),
      inputs,
    })).toThrow("factor, source, and rule type combination is not supported");

    expect(() => assessRisk({
      policy: numericPolicy({
        requiredFactors: ["marketUncertainty"],
        rules: [{
          factor: "marketUncertainty",
          source: "competitionLevel",
          kind: "EXACT_LABEL_MAPPING",
          mappings: { High: "HIGH", Moderate: "MEDIUM", Low: "LOW" },
        }],
      }),
      inputs,
    })).toThrow("factor, source, and rule type combination is not supported");

    expect(() => assessRisk({
      policy: numericPolicy({
        requiredFactors: ["competition"],
        rules: [{
          factor: "competition",
          source: "competitionLevel",
          kind: "NUMERIC_THRESHOLDS",
          unit: "level",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 2,
          highThreshold: 3,
        }],
      }),
      inputs,
    })).toThrow("factor, source, and rule type combination is not supported");
  });

  it("accepts supported factor, source, and rule type combinations with matching attribution", () => {
    const supportedPolicies = [
      {
        factor: "competition",
        label: "Kompetisi",
        source: "competitionLevel",
        rule: { kind: "EXACT_LABEL_MAPPING", mappings: { High: "HIGH" } },
      },
      {
        factor: "capitalRequirement",
        label: "Kebutuhan modal",
        source: "capitalMin",
        rule: {
          kind: "NUMERIC_THRESHOLDS",
          unit: "IDR",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 2_000_000,
          highThreshold: 4_000_000,
        },
      },
      {
        factor: "capitalRequirement",
        label: "Kebutuhan modal",
        source: "capitalMax",
        rule: {
          kind: "NUMERIC_THRESHOLDS",
          unit: "IDR",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 2_000_000,
          highThreshold: 4_000_000,
        },
      },
      {
        factor: "executionComplexity",
        label: "Kompleksitas eksekusi",
        source: "operationalComplexity",
        rule: {
          kind: "NUMERIC_THRESHOLDS",
          unit: "/100",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 40,
          highThreshold: 70,
        },
      },
    ];

    for (const { factor, label, source, rule } of supportedPolicies) {
      const result = assessRisk({
        policy: numericPolicy({
          requiredFactors: [factor],
          rules: [{ factor, source, ...rule }],
        }),
        inputs,
      });

      expect(result.status).toBe("ASSESSED");
      if (result.status === "ASSESSED") {
        expect(result.factorsConsidered.map(({ factor: assessedFactor }) => assessedFactor)).toEqual([factor]);
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain(`${label}:`);
        if (source === "capitalMin" || source === "capitalMax") {
          expect(result.factorsConsidered[0]?.value).toBe(`${inputs[source].value} IDR`);
          expect(result.reasons[0]).toContain(`${inputs[source].value} IDR`);
        }
      }
    }
  });

  it.each(["capitalMin", "capitalMax"] as const)("accepts %s only with the canonical IDR unit", (source) => {
    const result = assessRisk({ policy: capitalPolicy(source), inputs });

    expect(result).toMatchObject({ status: "ASSESSED", level: source === "capitalMin" ? "LOW" : "HIGH" });
    if (result.status === "ASSESSED") {
      expect(result.factorsConsidered[0]?.value).toBe(`${inputs[source].value} IDR`);
      expect(result.reasons[0]).toContain(`${inputs[source].value} IDR`);
    }
  });

  it.each(["USD", "EUR", "Rp", "idr", "IDR ", "USD/IDR"])(
    "rejects capitalMin and capitalMax policies with unsupported unit %j",
    (unit) => {
      for (const source of ["capitalMin", "capitalMax"] as const) {
        expect(() => assessRisk({ policy: capitalPolicy(source, { unit }), inputs }))
          .toThrow("canonical IDR unit");
      }
    },
  );

  it.each(["capitalMin", "capitalMax"] as const)("rejects %s policies with an absent or empty unit", (source) => {
    expect(() => assessRisk({ policy: capitalPolicy(source, { omitUnit: true }), inputs }))
      .toThrow("unsupported or missing fields");
    expect(() => assessRisk({ policy: capitalPolicy(source, { unit: "" }), inputs }))
      .toThrow("require a unit");
  });

  it.each(["capitalMin", "capitalMax"] as const)("compares %s at whole-Rupiah threshold boundaries", (source) => {
    const cases = [
      ["1999999", "LOW"],
      ["2000000", "MEDIUM"],
      ["3999999", "MEDIUM"],
      ["4000000", "HIGH"],
    ] as const;

    for (const [value, level] of cases) {
      expect(assessRisk({
        policy: capitalPolicy(source),
        inputs: withCapitalValue(source, value),
      })).toMatchObject({ status: "ASSESSED", level });
    }
  });

  it.each(["capitalMin", "capitalMax"] as const)("rejects fractional, unsafe, NaN, or infinite %s values", (source) => {
    for (const value of [
      "1000000.5",
      "1000000.00000000001",
      "9007199254740991.1",
      "9007199254740992",
      "NaN",
      "Infinity",
    ]) {
      expect(assessRisk({
        policy: capitalPolicy(source),
        inputs: withCapitalValue(source, value),
      })).toMatchObject({ status: "INSUFFICIENT_DATA", level: null, reason: "INVALID_INPUTS" });
    }
  });

  it.each([
    [2_000_000.5, 4_000_000],
    [2_000_000, 4_000_000.5],
    [2_000_000, Number.NaN],
    [Number.NaN, 4_000_000],
    [2_000_000, Number.POSITIVE_INFINITY],
    [Number.POSITIVE_INFINITY, 4_000_000],
    [2_000_000, 9_007_199_254_740_992],
  ])("rejects invalid capital thresholds %j", (mediumThreshold, highThreshold) => {
    expect(() => assessRisk({
      policy: capitalPolicy("capitalMin", { mediumThreshold, highThreshold }),
      inputs,
    })).toThrow();
  });

  it("rejects qualitative-to-numeric inference unless an exact approved mapping is configured", () => {
    const policy = numericPolicy({
      requiredFactors: ["competition"],
      rules: [{
        factor: "competition",
        source: "competitionLevel",
        kind: "EXACT_LABEL_MAPPING",
        mappings: { "High": "HIGH", "Moderate": "MEDIUM", "Low": "LOW" },
      }],
    });

    expect(assessRisk({ policy, inputs }).status).toBe("ASSESSED");
    expect(assessRisk({
      policy,
      inputs: { ...inputs, competitionLevel: { ...inputs.competitionLevel, value: "HIGH" } },
    })).toMatchObject({ status: "INSUFFICIENT_DATA", level: null, missingFactors: ["competition"] });

    expect(() => assessRisk({
      policy: numericPolicy({ rules: [{
        factor: "competition",
        source: "competitionLevel",
        kind: "NUMERIC_THRESHOLDS",
        unit: "level",
        direction: "HIGHER_IS_RISKIER",
        mediumThreshold: 2,
        highThreshold: 3,
      }] }),
      inputs,
    })).toThrow("factor, source, and rule type combination is not supported");
  });

  it("does not silently use unsupported or missing factor values", () => {
    const policy = numericPolicy({
      requiredFactors: ["competition", "executionComplexity"],
      rules: [
        {
          factor: "competition",
          source: "competitionLevel",
          kind: "EXACT_LABEL_MAPPING",
          mappings: { High: "HIGH" },
        },
        {
          factor: "executionComplexity",
          source: "operationalComplexity",
          kind: "NUMERIC_THRESHOLDS",
          unit: "/100",
          direction: "HIGHER_IS_RISKIER",
          mediumThreshold: 40,
          highThreshold: 70,
        },
      ],
    });
    const result = assessRisk({ policy, inputs: { ...inputs, competitionLevel: { ...inputs.competitionLevel, value: null } } });

    expect(result).toMatchObject({ status: "INSUFFICIENT_DATA", level: null });
    if (result.status === "INSUFFICIENT_DATA") {
      expect(result.missingFactors).toContain("competition");
    }
  });
});
