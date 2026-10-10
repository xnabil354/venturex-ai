import { TREND_DIRECTIONS, type TrendDirection } from "./domain";
import type { TrendDto } from "./dto";
import type { UserType } from "../auth/user-types";

const directionLabels = {
  RISING: "Meningkat",
  STABLE: "Stabil",
  DECLINING: "Menurun",
} satisfies Record<TrendDirection, string>;

const idDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export class TrendListDisplayContractError extends Error {
  override readonly name = "TrendListDisplayContractError";

  constructor() {
    super("A published Trend does not satisfy the Trend List display contract.");
  }
}

export type TrendListItem = {
  readonly id: string;
  readonly title: string;
  readonly categoryName: string;
  readonly subjectAreaName: string | null;
  readonly summary: string;
  readonly directionLabel: string;
  readonly observationPeriodLabel: string;
  readonly evidence: readonly {
    readonly sourceName: string;
    readonly sourceReference: string;
    readonly supportingDetail: string;
    readonly sourceDateLabel: string;
    readonly limitations: string | null;
  }[];
  readonly businessRelevanceExplanation: string | null;
  readonly catalogUpdatedAtLabel: string;
};

function formatPeriodDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TrendListDisplayContractError();
  }
  return idDateFormatter.format(parsed);
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TrendListDisplayContractError();
  }
  return idDateFormatter.format(parsed);
}

function observationPeriodLabel(start: string | null, end: string | null): string {
  if (start && end) {
    return `Periode observasi: ${formatPeriodDate(start)} – ${formatPeriodDate(end)}`;
  }
  if (start) {
    return `Awal observasi: ${formatPeriodDate(start)} · Akhir belum tersedia`;
  }
  if (end) {
    return `Akhir observasi: ${formatPeriodDate(end)} · Awal belum tersedia`;
  }
  return "Periode observasi belum tersedia";
}

function directionLabel(value: unknown): string {
  if (
    typeof value !== "string" ||
    !TREND_DIRECTIONS.includes(value as TrendDirection)
  ) {
    throw new TrendListDisplayContractError();
  }
  return directionLabels[value as TrendDirection];
}

export function projectTrendList(
  trends: readonly TrendDto[],
  userType: UserType,
): readonly TrendListItem[] {
  return trends.map((trend) => {
    if (
      trend.lifecycleState !== "PUBLISHED" ||
      !trend.affectedUserTypes.includes(userType) ||
      !Array.isArray(trend.evidence) ||
      trend.evidence.length === 0
    ) {
      throw new TrendListDisplayContractError();
    }

    const label = directionLabel(trend.signal.direction);

    return {
      id: trend.id,
      title: trend.title,
      categoryName: trend.category.name,
      subjectAreaName: trend.subjectArea?.name ?? null,
      summary: trend.signal.summary,
      directionLabel: label,
      observationPeriodLabel: observationPeriodLabel(
        trend.signal.observationPeriod.start,
        trend.signal.observationPeriod.end,
      ),
      evidence: trend.evidence.map((item) => ({
        sourceName: item.sourceName,
        sourceReference: item.sourceReference,
        supportingDetail: item.supportingDetail,
        sourceDateLabel: item.sourceDate
          ? `Tanggal sumber: ${formatTimestamp(item.sourceDate)}`
          : "Tanggal sumber tidak dicantumkan",
        limitations: item.limitations,
      })),
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      catalogUpdatedAtLabel: formatTimestamp(trend.updatedAt),
    };
  });
}
