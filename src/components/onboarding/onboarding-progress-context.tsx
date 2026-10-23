"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  OnboardingProgressStepper,
  type OnboardingProgressStep,
} from "./onboarding-progress-stepper";

type OnboardingProgress = Readonly<{
  currentStep: number;
  steps: readonly OnboardingProgressStep[];
}>;

const ProgressContext = createContext<OnboardingProgress | null>(null);
const ProgressSetterContext = createContext<
  Dispatch<SetStateAction<OnboardingProgress | null>> | null
>(null);

type OnboardingProgressProviderProps = Readonly<{
  children: ReactNode;
}>;

export function OnboardingProgressProvider({
  children,
}: OnboardingProgressProviderProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  return (
    <ProgressSetterContext.Provider value={setProgress}>
      <ProgressContext.Provider value={progress}>
        {children}
      </ProgressContext.Provider>
    </ProgressSetterContext.Provider>
  );
}

type OnboardingProgressPublisherProps = OnboardingProgress;

export function OnboardingProgressPublisher({
  currentStep,
  steps,
}: OnboardingProgressPublisherProps) {
  const setProgress = useContext(ProgressSetterContext);

  useEffect(() => {
    setProgress?.({ currentStep, steps });
  }, [currentStep, setProgress, steps]);

  return null;
}

type OnboardingProgressSlotProps = Readonly<{
  className?: string;
  currentStep?: number;
  steps?: readonly OnboardingProgressStep[];
  tone?: "paper" | "photo";
}>;

export function OnboardingProgressSlot({
  className,
  currentStep,
  steps,
  tone = "paper",
}: OnboardingProgressSlotProps) {
  const contextProgress = useContext(ProgressContext);
  const progress = contextProgress ?? (
    currentStep === undefined || steps === undefined
      ? null
      : { currentStep, steps }
  );

  if (!progress) return null;

  return (
    <div className={className}>
      <OnboardingProgressStepper
        currentStep={progress.currentStep}
        steps={progress.steps}
        tone={tone}
      />
    </div>
  );
}
