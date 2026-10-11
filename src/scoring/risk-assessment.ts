import type { AnalysisRiskLevel } from "./persistence-types";

export const RISK_FACTORS = [
  "competition",
  "capitalRequirement",
  "trendVolatility",
  "executionComplexity",
  "marketUncertainty",
] as const;

export type RiskFactor = (typeof RISK_FACTORS)[number];

export const RISK_FACTOR_LABELS: Readonly<Record<RiskFactor, string>> = {
  competition: "Kompetisi",
  capitalRequirement: "Kebutuhan modal",
  trendVolatility: "Volatilitas tren",
  executionComplexity: "Kompleksitas eksekusi",
  marketUncertainty: "Ketidakpastian pasar",
};

export const RISK_INPUT_SOURCES = [
  "competitionLevel",
  "capitalMin",
  "capitalMax",
  "operationalComplexity",
  "executionFeasibility",
  "marketSustainability",
] as const;

export type RiskInputSource = (typeof RISK_INPUT_SOURCES)[number];

export type RiskInputValue = {
  readonly value: string | null;
  readonly source: string;
  readonly reference: string;
};

export type RiskAssessmentInputs = Readonly<Record<RiskInputSource, RiskInputValue>>;

export type RiskEvidenceReference = {
  readonly sourceName: string;
  readonly sourceReference: string | null;
  readonly sourceUrl: string | null;
};

export type RiskFactorFinding = {
  readonly factor: RiskFactor;
  readonly label: string;
  readonly value: string;
  readonly level: AnalysisRiskLevel;
  readonly source: string;
  readonly sourceReference: string;
};

export type RiskAssessmentReason =
  | "CONFIGURATION_UNAVAILABLE"
  | "CONFIGURATION_NOT_APPROVED"
  | "CONFIGURATION_AMBIGUOUS"
  | "INVALID_CONFIGURATION"
  | "REQUIRED_INPUTS_UNAVAILABLE"
  | "INVALID_INPUTS";

export type RiskAssessmentResult =
  | {
      readonly status: "ASSESSED";
      readonly modelType: "RISK";
      readonly modelVersion: string;
      readonly level: AnalysisRiskLevel;
      readonly reasons: readonly string[];
      readonly factorsConsidered: readonly RiskFactorFinding[];
      readonly factorsNotAssessed: readonly RiskFactor[];
      readonly evidenceReferences: readonly RiskEvidenceReference[];
      readonly limitations: readonly string[];
    }
  | {
      readonly status: "INSUFFICIENT_DATA";
      readonly modelType: "RISK";
      readonly modelVersion: string | null;
      readonly level: null;
      readonly reason: RiskAssessmentReason;
      readonly missingFactors: readonly RiskFactor[];
      readonly evidenceReferences: readonly RiskEvidenceReference[];
      readonly limitations: readonly string[];
    };

export class RiskAssessmentInputError extends Error {
  override readonly name = "RiskAssessmentInputError";

  constructor(readonly code: "INVALID_POLICY" | "INVALID_INPUTS", message: string) {
    super(message);
  }
}

type NumericRiskRule = {
  readonly factor: RiskFactor;
  readonly source: RiskInputSource;
  readonly kind: "NUMERIC_THRESHOLDS";
  readonly unit: string;
  readonly direction: "HIGHER_IS_RISKIER" | "LOWER_IS_RISKIER";
  readonly mediumThreshold: number;
  readonly highThreshold: number;
};

type LabelMappingRiskRule = {
  readonly factor: RiskFactor;
  readonly source: "competitionLevel";
  readonly kind: "EXACT_LABEL_MAPPING";
  readonly mappings: Readonly<Record<string, AnalysisRiskLevel>>;
};

type RiskRule = NumericRiskRule | LabelMappingRiskRule;

type RiskPolicy = {
  readonly modelType: "RISK";
  readonly version: string;
  readonly aggregation: "HIGHEST_RISK";
  readonly requiredFactors: readonly RiskFactor[];
  readonly rules: readonly RiskRule[];
  readonly limitations: readonly string[];
};

const BASE_LIMITATIONS = [
  "Risk adalah indikator pendukung keputusan, bukan prediksi atau jaminan hasil bisnis.",
  "Hasil bergantung pada sumber input dan policy yang disetujui; validasi fakta pasar tetap diperlukan.",
] as const;

const NUMERIC_SOURCES = new Set<RiskInputSource>([
  "capitalMin",
  "capitalMax",
  "operationalComplexity",
  "executionFeasibility",
  "marketSustainability",
]);

const PERCENTAGE_SOURCES = new Set<RiskInputSource>([
  "operationalComplexity",
  "executionFeasibility",
  "marketSustainability",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function invalidPolicy(message: string): never {
  throw new RiskAssessmentInputError("INVALID_POLICY", message);
}

function invalidInputs(message: string): never {
  throw new RiskAssessmentInputError("INVALID_INPUTS", message);
}

function isRiskFactor(value: unknown): value is RiskFactor {
  return typeof value === "string" && (RISK_FACTORS as readonly string[]).includes(value);
}

function isRiskLevel(value: unknown): value is AnalysisRiskLevel {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function isInputSource(value: unknown): value is RiskInputSource {
  return typeof value === "string" && (RISK_INPUT_SOURCES as readonly string[]).includes(value);
}

// Keep only direct relationships defined by the current opportunity data contract.
// Potential Risk factors without a directly supported source remain unavailable.
function isSupportedRiskRuleCombination(
  factor: RiskFactor,
  source: RiskInputSource,
  kind: unknown,
): boolean {
  if (factor === "competition") {
    return source === "competitionLevel" && kind === "EXACT_LABEL_MAPPING";
  }
  if (factor === "capitalRequirement") {
    return (source === "capitalMin" || source === "capitalMax") && kind === "NUMERIC_THRESHOLDS";
  }
  if (factor === "executionComplexity") {
    return source === "operationalComplexity" && kind === "NUMERIC_THRESHOLDS";
  }
  return false;
}

function validatePolicy(value: unknown): RiskPolicy {
  if (!isRecord(value) || !hasExactKeys(value, [
    "modelType",
    "version",
    "aggregation",
    "requiredFactors",
    "rules",
    "limitations",
  ])) {
    invalidPolicy("A complete Risk policy is required.");
  }
  if (value.modelType !== "RISK") invalidPolicy("The policy model type must be RISK.");
  if (typeof value.version !== "string" || value.version.trim().length === 0 || value.version.length > 80) {
    invalidPolicy("A supported Risk model version is required.");
  }
  if (value.aggregation !== "HIGHEST_RISK") {
    invalidPolicy("The policy must explicitly select the supported HIGHEST_RISK aggregation.");
  }
  if (!Array.isArray(value.requiredFactors) || value.requiredFactors.length === 0) {
    invalidPolicy("At least one required risk factor must be configured.");
  }
  const requiredFactors = value.requiredFactors;
  if (
    requiredFactors.some((factor) => !isRiskFactor(factor)) ||
    new Set(requiredFactors).size !== requiredFactors.length
  ) {
    invalidPolicy("Required risk factors must be unique supported factors.");
  }
  if (!Array.isArray(value.rules) || value.rules.length === 0 || value.rules.length > RISK_FACTORS.length) {
    invalidPolicy("The policy must contain supported risk factor rules.");
  }
  if (
    !Array.isArray(value.limitations) ||
    value.limitations.length > 12 ||
    value.limitations.some((item) => typeof item !== "string" || item.trim().length === 0 || item.length > 500)
  ) {
    invalidPolicy("Policy limitations must be short, non-empty text values.");
  }

  const rules: RiskRule[] = [];
  const configuredFactors = new Set<RiskFactor>();
  for (const rawRule of value.rules) {
    if (!isRecord(rawRule) || !isRiskFactor(rawRule.factor) || !isInputSource(rawRule.source)) {
      invalidPolicy("Each risk rule must identify a supported factor and input source.");
    }
    const factor = rawRule.factor;
    const source = rawRule.source;
    if (!isSupportedRiskRuleCombination(factor, source, rawRule.kind)) {
      invalidPolicy("The factor, source, and rule type combination is not supported.");
    }
    if (configuredFactors.has(factor)) invalidPolicy("Each risk factor may have only one configured rule.");
    configuredFactors.add(factor);

    if (rawRule.kind === "NUMERIC_THRESHOLDS") {
      if (!hasExactKeys(rawRule, ["factor", "source", "kind", "unit", "direction", "mediumThreshold", "highThreshold"])) {
        invalidPolicy("Numeric risk rules contain unsupported or missing fields.");
      }
      if (source === "competitionLevel" || !NUMERIC_SOURCES.has(source)) {
        invalidPolicy("Qualitative labels require an explicit exact mapping, not numeric thresholds.");
      }
      const { mediumThreshold, highThreshold } = rawRule;
      if (
        typeof rawRule.unit !== "string" || rawRule.unit.trim().length === 0 || rawRule.unit.length > 24 ||
        (rawRule.direction !== "HIGHER_IS_RISKIER" && rawRule.direction !== "LOWER_IS_RISKIER") ||
        typeof mediumThreshold !== "number" || !Number.isFinite(mediumThreshold) || mediumThreshold < 0 ||
        typeof highThreshold !== "number" || !Number.isFinite(highThreshold) || highThreshold < 0
      ) {
        invalidPolicy("Numeric risk rules require a unit, direction, and finite non-negative thresholds.");
      }
      if (rawRule.direction === "HIGHER_IS_RISKIER" && mediumThreshold >= highThreshold) {
        invalidPolicy("Higher-is-riskier thresholds must increase from MEDIUM to HIGH.");
      }
      if (rawRule.direction === "LOWER_IS_RISKIER" && highThreshold >= mediumThreshold) {
        invalidPolicy("Lower-is-riskier thresholds must decrease from MEDIUM to HIGH.");
      }
      if (PERCENTAGE_SOURCES.has(source) && (mediumThreshold > 100 || highThreshold > 100)) {
        invalidPolicy("Percentage input thresholds must remain within 0 to 100.");
      }
      if (source === "capitalMin" || source === "capitalMax") {
        if (rawRule.unit !== "IDR") {
          invalidPolicy("Capital risk rules must use the canonical IDR unit.");
        }
        if (!Number.isSafeInteger(mediumThreshold) || !Number.isSafeInteger(highThreshold)) {
          invalidPolicy("Capital thresholds must be safe whole numbers.");
        }
      }
      rules.push(rawRule as unknown as NumericRiskRule);
      continue;
    }

    if (rawRule.kind === "EXACT_LABEL_MAPPING") {
      if (!hasExactKeys(rawRule, ["factor", "source", "kind", "mappings"])) {
        invalidPolicy("Label mapping risk rules contain unsupported or missing fields.");
      }
      if (source !== "competitionLevel" || !isRecord(rawRule.mappings)) {
        invalidPolicy("Only the qualitative competition level supports an explicit exact mapping.");
      }
      const mappingEntries = Object.entries(rawRule.mappings);
      if (
        mappingEntries.length === 0 || mappingEntries.length > 24 ||
        mappingEntries.some(([label, level]) => label.trim().length === 0 || label.length > 80 || !isRiskLevel(level))
      ) {
        invalidPolicy("Competition mappings must map exact non-empty labels to supported risk levels.");
      }
      rules.push(rawRule as unknown as LabelMappingRiskRule);
      continue;
    }

    invalidPolicy("The risk rule type is not supported.");
  }

  if (requiredFactors.some((factor) => !configuredFactors.has(factor))) {
    invalidPolicy("Every required risk factor must have a configured rule.");
  }

  return value as unknown as RiskPolicy;
}

function parseNumericInput(source: RiskInputSource, rawValue: string): number | null {
  const isCapitalSource = source === "capitalMin" || source === "capitalMax";
  const numericPattern = isCapitalSource
    ? /^(?:0|[1-9]\d*)$/u
    : /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
  if (!numericPattern.test(rawValue)) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (isCapitalSource && !Number.isSafeInteger(parsed)) return null;
  if (PERCENTAGE_SOURCES.has(source) && parsed > 100) return null;
  return parsed;
}

function riskLevelForNumeric(value: number, rule: NumericRiskRule): AnalysisRiskLevel {
  if (rule.direction === "HIGHER_IS_RISKIER") {
    if (value >= rule.highThreshold) return "HIGH";
    if (value >= rule.mediumThreshold) return "MEDIUM";
    return "LOW";
  }
  if (value <= rule.highThreshold) return "HIGH";
  if (value <= rule.mediumThreshold) return "MEDIUM";
  return "LOW";
}

function severity(level: AnalysisRiskLevel): number {
  return level === "LOW" ? 1 : level === "MEDIUM" ? 2 : 3;
}

function labelForLevel(level: AnalysisRiskLevel): string {
  return level === "LOW" ? "Rendah" : level === "MEDIUM" ? "Sedang" : "Tinggi";
}

function evidenceReferencesFrom(value: unknown): readonly RiskEvidenceReference[] {
  if (!Array.isArray(value)) invalidInputs("Evidence references must be a list.");
  return value.map((entry) => {
    if (!isRecord(entry) || !hasExactKeys(entry, ["sourceName", "sourceReference", "sourceUrl"])) {
      invalidInputs("An evidence reference is invalid.");
    }
    if (
      typeof entry.sourceName !== "string" || entry.sourceName.trim().length === 0 || entry.sourceName.length > 180 ||
      (entry.sourceReference !== null && (typeof entry.sourceReference !== "string" || entry.sourceReference.length > 2000)) ||
      (entry.sourceUrl !== null && (typeof entry.sourceUrl !== "string" || entry.sourceUrl.length > 2000))
    ) {
      invalidInputs("An evidence reference contains invalid values.");
    }
    return {
      sourceName: entry.sourceName,
      sourceReference: entry.sourceReference,
      sourceUrl: entry.sourceUrl,
    };
  });
}

function insufficient(
  modelVersion: string | null,
  reason: RiskAssessmentReason,
  missingFactors: readonly RiskFactor[],
  evidenceReferences: readonly RiskEvidenceReference[],
  limitations: readonly string[] = [],
): RiskAssessmentResult {
  return {
    status: "INSUFFICIENT_DATA",
    modelType: "RISK",
    modelVersion,
    level: null,
    reason,
    missingFactors,
    evidenceReferences,
    limitations: [...BASE_LIMITATIONS, ...limitations],
  };
}

export function assessRisk(input: {
  readonly policy: unknown | null;
  readonly inputs: RiskAssessmentInputs;
  readonly evidenceReferences?: readonly RiskEvidenceReference[];
}): RiskAssessmentResult {
  if (!isRecord(input)) invalidInputs("Risk assessment input must be an object.");
  const references = evidenceReferencesFrom(input.evidenceReferences ?? []);
  if (input.policy === null) {
    return insufficient(null, "CONFIGURATION_UNAVAILABLE", RISK_FACTORS, references);
  }
  const policy = validatePolicy(input.policy);
  if (!isRecord(input.inputs) || !hasExactKeys(input.inputs, RISK_INPUT_SOURCES)) {
    invalidInputs("Risk assessment inputs must include the supported input source set.");
  }

  const findings: RiskFactorFinding[] = [];
  const unavailableRequired: RiskFactor[] = [];
  const invalidRequired: RiskFactor[] = [];
  const unavailableOptional: RiskFactor[] = [];

  for (const rule of policy.rules) {
    const sourceInput = input.inputs[rule.source];
    if (
      !isRecord(sourceInput) || !hasExactKeys(sourceInput, ["value", "source", "reference"]) ||
      (sourceInput.value !== null && typeof sourceInput.value !== "string") ||
      typeof sourceInput.source !== "string" || sourceInput.source.trim().length === 0 ||
      typeof sourceInput.reference !== "string" || sourceInput.reference.trim().length === 0
    ) {
      invalidInputs("A configured risk input source is malformed.");
    }
    const required = policy.requiredFactors.includes(rule.factor);
    const rawValue = sourceInput.value;
    if (rawValue === null || rawValue.trim().length === 0) {
      if (required) unavailableRequired.push(rule.factor);
      else unavailableOptional.push(rule.factor);
      continue;
    }

    let level: AnalysisRiskLevel | null = null;
    let displayValue = rawValue;
    if (rule.kind === "NUMERIC_THRESHOLDS") {
      const numericValue = parseNumericInput(rule.source, rawValue);
      if (numericValue === null) {
        if (required) invalidRequired.push(rule.factor);
        else unavailableOptional.push(rule.factor);
        continue;
      }
      level = riskLevelForNumeric(numericValue, rule);
      displayValue = `${rawValue} ${rule.unit}`;
    } else if (Object.prototype.hasOwnProperty.call(rule.mappings, rawValue)) {
      level = rule.mappings[rawValue] ?? null;
    }

    if (level === null) {
      if (required) unavailableRequired.push(rule.factor);
      else unavailableOptional.push(rule.factor);
      continue;
    }

    findings.push({
      factor: rule.factor,
      label: RISK_FACTOR_LABELS[rule.factor],
      value: displayValue,
      level,
      source: sourceInput.source,
      sourceReference: sourceInput.reference,
    });
  }

  if (unavailableRequired.length > 0 || invalidRequired.length > 0) {
    const missingFactors = [...new Set([...unavailableRequired, ...invalidRequired])];
    return insufficient(
      policy.version,
      invalidRequired.length > 0 ? "INVALID_INPUTS" : "REQUIRED_INPUTS_UNAVAILABLE",
      missingFactors,
      references,
      unavailableOptional.map((factor) => `${RISK_FACTOR_LABELS[factor]} tidak dinilai karena input tidak tersedia atau tidak memiliki mapping yang disetujui.`),
    );
  }
  if (findings.length === 0) {
    return insufficient(policy.version, "REQUIRED_INPUTS_UNAVAILABLE", policy.requiredFactors, references);
  }

  const level = findings.reduce<AnalysisRiskLevel>((current, finding) =>
    severity(finding.level) > severity(current) ? finding.level : current, "LOW");
  const reasons = findings.map((finding) => {
    const rule = policy.rules.find(({ factor }) => factor === finding.factor);
    const evaluation = rule?.kind === "EXACT_LABEL_MAPPING"
      ? `nilai "${finding.value}" dipetakan ke risiko ${labelForLevel(finding.level)} oleh policy ${policy.version}`
      : `nilai ${finding.value} dinilai berisiko ${labelForLevel(finding.level)} menurut policy ${policy.version}`;
    return `${finding.label}: ${evaluation}. Sumber: ${finding.source}.`;
  });
  const notAssessedFactors = RISK_FACTORS.filter((factor) => !findings.some((finding) => finding.factor === factor));
  const limitations = [
    ...BASE_LIMITATIONS,
    ...policy.limitations,
    ...unavailableOptional.map((factor) => `${RISK_FACTOR_LABELS[factor]} tidak dinilai karena input tidak tersedia atau tidak memiliki mapping yang disetujui.`),
    ...(references.length > 0
      ? ["Evidence yang tercantum adalah konteks Opportunity dan tidak otomatis membuktikan faktor risiko tertentu."]
      : ["Tidak ada referensi evidence Opportunity yang tersedia untuk ditampilkan."]),
  ];

  return {
    status: "ASSESSED",
    modelType: "RISK",
    modelVersion: policy.version,
    level,
    reasons,
    factorsConsidered: findings,
    factorsNotAssessed: notAssessedFactors,
    evidenceReferences: references,
    limitations,
  };
}
