import { Badge } from "@/components/ui/badge";
import { cx } from "@/lib/cx";

type AvailableScore = {
  status: "AVAILABLE";
  value: number;
};

type InsufficientScore = {
  status: "INSUFFICIENT_DATA";
  value: null;
};

export type Score = AvailableScore | InsufficientScore;

export type ScoreIndicatorProps = {
  description?: string;
  label: string;
  score: Score;
};

export function ScoreIndicator({
  description,
  label,
  score,
}: ScoreIndicatorProps) {
  const scoreValue =
    score.status === "AVAILABLE"
      ? Math.max(0, Math.min(100, score.value))
      : 0;

  return (
    <div className="grid gap-12" role="group" aria-label={label}>
      <div className="flex items-start justify-between gap-12">
        <div className="grid gap-4">
          <span className="text-body-sm font-w540 text-ink-charcoal">{label}</span>
          {description ? (
            <span className="max-w-[36ch] text-caption text-stone-gray">
              {description}
            </span>
          ) : null}
        </div>
        {score.status === "AVAILABLE" ? (
          <strong className="text-heading-sm font-w460 tracking-heading-sm tabular-nums text-ink-charcoal">
            {Number.isInteger(score.value) ? score.value : score.value.toFixed(1)}
          </strong>
        ) : (
          <Badge tone="wash">Insufficient data</Badge>
        )}
      </div>
      {score.status === "AVAILABLE" ? (
        <div
          aria-label={`${label} score scale`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={scoreValue}
          aria-valuetext={`${scoreValue} out of 100`}
          className="h-8 overflow-hidden rounded-small-buttons bg-soft-mist"
          role="meter"
        >
          <span
            aria-hidden="true"
            className="block h-full origin-left bg-midnight-wine transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${scoreValue / 100})` }}
          />
        </div>
      ) : (
        <div
          aria-label={`${label}: insufficient data`}
          className="h-8 rounded-small-buttons bg-soft-mist"
          role="img"
        />
      )}
      {score.status === "AVAILABLE" ? (
        <div className="flex justify-between text-caption text-stone-gray">
          <span>Lower</span>
          <span>Higher</span>
        </div>
      ) : (
        <p className="text-caption text-stone-gray">
          Data is not sufficient to calculate this score reliably.
        </p>
      )}
    </div>
  );
}

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskBadgeProps = {
  level: RiskLevel;
  reason?: string;
};

const riskLabels: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const riskBorderClasses: Record<RiskLevel, string> = {
  LOW: "border-soft-mist",
  MEDIUM: "border-ink-charcoal",
  HIGH: "border-midnight-wine",
};

export function RiskBadge({ level, reason }: RiskBadgeProps) {
  return (
    <div
      aria-label={`Risk: ${riskLabels[level]}`}
      className={cx(
        "grid gap-8 border-l-2 pl-12",
        riskBorderClasses[level],
      )}
      role="group"
    >
      <div className="flex items-center justify-between gap-12">
        <span className="text-body-sm font-w540 text-ink-charcoal">Risk</span>
        <Badge>{riskLabels[level]}</Badge>
      </div>
      {reason ? <p className="text-body-sm text-stone-gray">{reason}</p> : null}
    </div>
  );
}
