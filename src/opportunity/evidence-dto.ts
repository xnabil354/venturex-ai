import type { OpportunityEvidenceRecord } from "./evidence-domain";

export type OpportunityEvidenceItemDto = {
  readonly sourceName: string;
  readonly sourceType: string;
  readonly sourceDateLabel: string;
  readonly retrievedAtLabel: string;
  readonly sourceReference: string | null;
  readonly sourceUrl: string | null;
  readonly limitations: readonly string[];
};

export type OpportunityEvidenceState =
  | {
      readonly status: "AVAILABLE" | "EMPTY";
      readonly items: readonly OpportunityEvidenceItemDto[];
      readonly limited: boolean;
    }
  | { readonly status: "ERROR" };

type EvidenceProjection = {
  readonly item: OpportunityEvidenceItemDto;
  readonly limited: boolean;
};

const missingSourceDate = "Tanggal sumber tidak dicantumkan.";
const missingReference = "Referensi sumber dan URL tidak dicantumkan.";
const invalidMetadata = "Metadata keterbatasan sumber tidak dapat dibaca.";
const invalidUrl = "URL sumber tidak ditampilkan karena tidak aman.";

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function dateValue(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function sourceDateLabel(value: unknown): string {
  const date = dateValue(value);
  return date ? `Tanggal sumber (UTC): ${date.toISOString().slice(0, 10)}` : missingSourceDate;
}

function retrievedAtLabel(value: unknown): string | null {
  const date = dateValue(value);
  if (!date) return null;
  const timestamp = date.toISOString();
  return `Data diambil: ${timestamp.slice(0, 16).replace("T", " ")} UTC`;
}

function safeSourceUrl(value: string | null): { readonly url: string | null; readonly rejected: boolean } {
  if (!value) return { url: null, rejected: false };
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      return { url: null, rejected: true };
    }
    return { url: parsed.toString(), rejected: false };
  } catch {
    return { url: null, rejected: true };
  }
}

function limitationFromMetadata(metadata: unknown): {
  readonly limitation: string | null;
  readonly invalid: boolean;
} {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return { limitation: null, invalid: true };
  }

  if (!Object.hasOwn(metadata, "limitations")) {
    return { limitation: null, invalid: false };
  }

  const limitation = optionalText((metadata as Record<string, unknown>).limitations);
  return limitation
    ? { limitation, invalid: false }
    : { limitation: null, invalid: true };
}

function toEvidenceProjection(record: OpportunityEvidenceRecord): EvidenceProjection {
  const sourceName = optionalText(record.sourceName);
  const sourceType = optionalText(record.sourceType);
  const sourceReference = optionalText(record.sourceReference);
  const sourceUrlResult = safeSourceUrl(optionalText(record.sourceUrl));
  const sourceDate = dateValue(record.sourceDate);
  const retrievedAt = retrievedAtLabel(record.retrievedAt);
  const metadata = limitationFromMetadata(record.metadata);
  const limitations: string[] = [];

  if (metadata.limitation) limitations.push(metadata.limitation);
  if (metadata.invalid) limitations.push(invalidMetadata);
  if (!sourceName) limitations.push("Nama sumber tidak dicantumkan.");
  if (!sourceType) limitations.push("Jenis sumber tidak dicantumkan.");
  if (!sourceDate) limitations.push(missingSourceDate);
  if (!sourceReference && !sourceUrlResult.url) limitations.push(missingReference);
  if (sourceUrlResult.rejected) limitations.push(invalidUrl);
  if (!retrievedAt) limitations.push("Waktu pengambilan data tidak tersedia.");

  return {
    item: {
      sourceName: sourceName ?? "Nama sumber tidak dicantumkan",
      sourceType: sourceType ?? "Jenis sumber tidak dicantumkan",
      sourceDateLabel: sourceDateLabel(sourceDate),
      retrievedAtLabel: retrievedAt ?? "Waktu pengambilan data tidak tersedia.",
      sourceReference,
      sourceUrl: sourceUrlResult.url,
      limitations,
    },
    limited: limitations.length > 0,
  };
}

export function projectOpportunityEvidence(
  records: readonly OpportunityEvidenceRecord[],
): OpportunityEvidenceState {
  const projected = records.map(toEvidenceProjection);
  if (projected.length === 0) {
    return { status: "EMPTY", items: [], limited: true };
  }

  return {
    status: "AVAILABLE",
    items: projected.map(({ item }) => item),
    limited: records.length <= 1 || projected.some(({ limited }) => limited),
  };
}
