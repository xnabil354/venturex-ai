import { cx } from "@/lib/cx";

export type OnboardingProgressStep = Readonly<{
  label: string;
}>;

type OnboardingProgressStepperProps = Readonly<{
  currentStep: number;
  steps: readonly OnboardingProgressStep[];
  tone?: "paper" | "photo";
}>;

const STEP_STATUS: Record<"completed" | "current" | "upcoming", string> = {
  completed: "Selesai",
  current: "Langkah saat ini",
  upcoming: "Belum dimulai",
};

export function OnboardingProgressStepper({
  currentStep,
  steps,
  tone = "paper",
}: OnboardingProgressStepperProps) {
  if (steps.length === 0) return null;

  const activeStep = Math.min(Math.max(Math.trunc(currentStep), 1), steps.length);
  const progress = steps.length > 1
    ? ((activeStep - 1) / (steps.length - 1)) * 100
    : 0;
  const stepCenter = 50 / steps.length;
  const activeLabel = steps[activeStep - 1]?.label;
  const isPhoto = tone === "photo";

  return (
    <nav aria-label="Progres onboarding" className="w-full">
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        Langkah {activeStep} dari {steps.length}: {activeLabel}
      </p>

      <div className="relative">
        {steps.length > 1 ? (
          <div
            aria-hidden="true"
            className={cx(
              "absolute top-16 h-2 -translate-y-1/2 overflow-hidden rounded-full",
              isPhoto ? "bg-paper-white/30" : "bg-soft-mist",
            )}
            style={{ left: `${stepCenter}%`, right: `${stepCenter}%` }}
          >
            <span
              className={cx(
                "block h-full rounded-full transition-[width] duration-300 ease-out",
                isPhoto ? "bg-[#eadcc8]" : "bg-midnight-wine",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}

        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const state = stepNumber < activeStep
              ? "completed"
              : stepNumber === activeStep
                ? "current"
                : "upcoming";

            return (
              <li
                aria-current={state === "current" ? "step" : undefined}
                className="flex min-w-0 flex-col items-center text-center"
                key={`${stepNumber}-${step.label}`}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "relative z-10 flex size-32 shrink-0 items-center justify-center rounded-full border text-caption font-w540 transition-colors",
                    state === "completed" && isPhoto &&
                      "border-[#eadcc8] bg-[#eadcc8] text-midnight-wine",
                    state === "current" && isPhoto &&
                      "border-paper-white bg-[#421d24]/90 text-paper-white ring-4 ring-paper-white/20",
                    state === "upcoming" && isPhoto &&
                      "border-paper-white/60 bg-[#14080e]/55 text-paper-white/80",
                    state === "completed" && !isPhoto &&
                      "border-midnight-wine bg-midnight-wine text-paper-white",
                    state === "current" && !isPhoto &&
                      "border-midnight-wine bg-paper-white text-midnight-wine ring-4 ring-midnight-wine/10",
                    state === "upcoming" && !isPhoto &&
                      "border-soft-mist bg-warm-parchment text-stone-gray",
                  )}
                >
                  {state === "completed" ? (
                    <svg
                      aria-hidden="true"
                      className="size-16"
                      fill="none"
                      viewBox="0 0 16 16"
                    >
                      <path
                        d="m3.5 8.25 3 3L12.5 5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </span>

                <span
                  className={cx(
                    "mt-12 flex min-h-[3rem] max-w-full items-start justify-center rounded-[0.5rem] px-6 py-4 text-caption leading-[1rem]",
                    isPhoto && "bg-[#14080e]/40",
                    state === "current" && isPhoto && "font-w540 text-paper-white",
                    state === "completed" && isPhoto && "font-w460 text-paper-white/90",
                    state === "upcoming" && isPhoto && "font-w460 text-paper-white/75",
                    state === "current" && !isPhoto && "font-w540 text-midnight-wine",
                    state === "completed" && !isPhoto && "font-w460 text-stone-gray",
                    state === "upcoming" && !isPhoto && "font-w460 text-stone-gray/75",
                  )}
                >
                  <span className="max-w-full break-words">{step.label}</span>
                </span>

                <span className="sr-only">{STEP_STATUS[state]}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
