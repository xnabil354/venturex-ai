"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { EntrepreneurProfileEditValues } from "@/profile/validation";

import {
  OnboardingProgressPublisher,
  OnboardingProgressSlot,
} from "./onboarding-progress-context";
import {
  EntrepreneurProfileStepOne,
  EntrepreneurProfileStepThree,
  EntrepreneurProfileStepTwo,
} from "./entrepreneur-profile-steps";
import {
  createInitialEntrepreneurFormState,
  toEntrepreneurFormState,
  toEntrepreneurProfilePayload,
  validateStep,
  type EntrepreneurFormState,
  type EntrepreneurFormStep,
} from "./entrepreneur-profile-form.validation";
import type { ReferenceData, ReferenceState } from "./entrepreneur-profile-form.types";

const categoryEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      parentId: z.string().uuid().nullable(),
    }),
  ),
  requestId: z.string(),
  success: z.literal(true),
});

const segmentEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      description: z.string().nullable(),
      id: z.string().uuid(),
      name: z.string(),
    }),
  ),
  requestId: z.string(),
  success: z.literal(true),
});

const channelEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      id: z.string().uuid(),
      name: z.string(),
    }),
  ),
  requestId: z.string(),
  success: z.literal(true),
});

const profileSuccessSchema = z.object({
  data: z.object({
    profileComplete: z.literal(true),
    profileVersion: z.number().int(),
  }),
  requestId: z.string(),
  success: z.literal(true),
});

const STEP_META = {
  1: { label: "Lokasi dan minat" },
  2: { label: "Budget dan target pelanggan" },
  3: { label: "Cara menjalankan usaha" },
} as const satisfies Record<EntrepreneurFormStep, { label: string }>;
const PROFILE_STEPS = [STEP_META[1], STEP_META[2], STEP_META[3]];

class ReferenceLoadError extends Error {
  override readonly name = "ReferenceLoadError";

  constructor(readonly reason: "network" | "server" | "invalid") {
    super(`Reference data failed: ${reason}`);
  }
}

async function fetchReference<T>(
  url: string,
  parse: (body: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ReferenceLoadError("network");
    }
    throw error;
  }

  if (!response.ok) {
    throw new ReferenceLoadError("server");
  }

  const body: unknown = await response.json();
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ReferenceLoadError("invalid");
    }
    throw error;
  }
}

async function loadReferenceData(): Promise<ReferenceData> {
  const [categories, segments, channels] = await Promise.all([
    fetchReference("/api/v1/reference/fnb-categories", (body) =>
      categoryEnvelopeSchema.parse(body).data,
    ),
    fetchReference("/api/v1/reference/customer-segments", (body) =>
      segmentEnvelopeSchema.parse(body).data,
    ),
    fetchReference("/api/v1/reference/sales-channels", (body) =>
      channelEnvelopeSchema.parse(body).data,
    ),
  ]);

  return { categories, channels, segments };
}

export type EntrepreneurProfileFormProps = {
  readonly initialValues?: EntrepreneurProfileEditValues;
  readonly mode?: "onboarding" | "edit";
};

export function EntrepreneurProfileForm({
  initialValues,
  mode = "onboarding",
}: EntrepreneurProfileFormProps) {
  const router = useRouter();
  const headingId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [formState, setFormState] = useState(() =>
    initialValues ? toEntrepreneurFormState(initialValues) : createInitialEntrepreneurFormState(),
  );
  const [step, setStep] = useState<EntrepreneurFormStep>(1);
  const [stepErrors, setStepErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referenceAttempt, setReferenceAttempt] = useState(0);
  const [references, setReferences] = useState<ReferenceState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void loadReferenceData()
      .then((data) => {
        if (!cancelled) {
          setReferences({ data, status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof ReferenceLoadError && error.reason === "network"
            ? "Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi."
            : "Pilihan profil belum dapat dimuat. Coba lagi.";
        setReferences({ message, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [referenceAttempt]);

  useEffect(() => {
    if (formError) {
      errorSummaryRef.current?.focus();
    }
  }, [formError]);

  function retryReferences(): void {
    setReferences({ status: "loading" });
    setReferenceAttempt((current) => current + 1);
  }

  function updateForm(patch: Partial<EntrepreneurFormState>): void {
    setFormState((current) => ({ ...current, ...patch }));
    setStepErrors({});
    setFormError(null);
  }

  function handleContinue(): void {
    const errors = validateStep(step, formState);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      setFormError("Periksa bagian yang masih perlu dilengkapi sebelum melanjutkan.");
      return;
    }

    setStepErrors({});
    setFormError(null);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  function handleBack(): void {
    setFormError(null);
    setStepErrors({});
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  }

  async function submitProfile(): Promise<void> {
    const stepThreeErrors = validateStep(3, formState);
    if (Object.keys(stepThreeErrors).length > 0) {
      setStepErrors(stepThreeErrors);
      setFormError("Periksa bagian yang masih perlu dilengkapi sebelum menyimpan.");
      return;
    }

    const payload = toEntrepreneurProfilePayload(formState);
    if (!payload.success) {
      setStepErrors(payload.errors);
      setFormError("Data profil belum lengkap. Periksa kembali pilihan Anda.");
      return;
    }

    setIsSubmitting(true);
    setStepErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/v1/profile/entrepreneur", {
        body: JSON.stringify(payload.data),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const body: unknown = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.ok && profileSuccessSchema.safeParse(body).success) {
        router.refresh();
        router.replace(mode === "edit" ? "/dashboard?profileUpdated=1" : "/dashboard");
        return;
      }
      if (response.status === 400) {
        setFormError("Data profil belum valid. Periksa kembali isian Anda.");
        return;
      }
      if (response.status === 403) {
        setFormError("Akun ini tidak menggunakan jalur profil entrepreneur.");
        return;
      }
      if (response.status === 404) {
        retryReferences();
        setFormError("Pilihan referensi berubah. Periksa pilihan setelah data dimuat ulang.");
        return;
      }
      setFormError("Profil belum dapat disimpan. Silakan coba lagi.");
    } catch (error) {
      if (error instanceof TypeError) {
        setFormError("Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi.");
      } else if (error instanceof SyntaxError) {
        setFormError("Respons server belum dapat dibaca. Silakan coba lagi.");
      } else {
        setFormError("Profil belum dapat disimpan. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (step < 3) {
      handleContinue();
      return;
    }
    void submitProfile();
  }

  const progressPublisher = (
    <OnboardingProgressPublisher currentStep={step} steps={PROFILE_STEPS} />
  );

  if (references.status === "loading") {
    return (
      <>
        {progressPublisher}
        <ReferenceLoadingState />
      </>
    );
  }

  if (references.status === "error") {
    return (
      <>
        {progressPublisher}
        <EmptyState
          action={<Button onClick={retryReferences} variant="secondary">Coba lagi</Button>}
          description={references.message}
          title="Pilihan profil belum tersedia"
        />
      </>
    );
  }

  if (
    references.data.categories.length === 0 ||
    references.data.segments.length === 0 ||
    references.data.channels.length === 0
  ) {
    return (
      <>
        {progressPublisher}
        <EmptyState
          action={<Button onClick={retryReferences} variant="secondary">Muat ulang pilihan</Button>}
          description="Data pilihan profil belum tersedia. Coba muat ulang sebelum melanjutkan."
          title="Pilihan profil belum lengkap"
        />
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-32 border-t border-soft-mist pt-20 sm:pt-24">
      <header className="grid gap-12">
        <h1
          className="max-w-[20ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:max-w-none"
          id={headingId}
        >
          {mode === "edit" ? "Edit profil entrepreneur" : "Lengkapi profil calon pengusaha"}
        </h1>
        <p className="max-w-[52ch] text-body-sm leading-body-sm text-stone-gray">
          {mode === "edit"
            ? "Perbarui informasi profil Anda. Perubahan profil tidak menghapus peluang yang telah disimpan."
            : "Beberapa pilihan singkat membantu VENTUREX menyiapkan konteks usaha yang lebih sesuai."}
        </p>
      </header>

      {progressPublisher}
      {mode === "edit" ? (
        <OnboardingProgressSlot currentStep={step} steps={PROFILE_STEPS} />
      ) : null}

      <form className="grid gap-32" noValidate onSubmit={handleSubmit}>
        {step === 1 ? (
          <EntrepreneurProfileStepOne
            errors={stepErrors}
            references={references.data}
            state={formState}
            updateForm={updateForm}
          />
        ) : null}
        {step === 2 ? (
          <EntrepreneurProfileStepTwo
            errors={stepErrors}
            references={references.data}
            state={formState}
            updateForm={updateForm}
          />
        ) : null}
        {step === 3 ? (
          <EntrepreneurProfileStepThree
            errors={stepErrors}
            references={references.data}
            state={formState}
            updateForm={updateForm}
          />
        ) : null}

        {formError ? (
          <div
            aria-live="assertive"
            className="rounded-small-buttons border border-soft-mist bg-warm-parchment px-12 py-12 text-body-sm font-w540 text-ink-charcoal"
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
          >
            {formError}
          </div>
        ) : null}

        <div
          className={cx(
            "flex flex-col-reverse gap-12 border-t border-soft-mist pt-24 sm:flex-row sm:items-center",
            step > 1 ? "sm:justify-between" : "sm:justify-end",
          )}
        >
          {step > 1 ? (
            <Button
              className="w-full sm:w-auto"
              disabled={isSubmitting}
              onClick={handleBack}
              type="button"
              variant="ghost"
            >
              Sebelumnya
            </Button>
          ) : null}
          <Button className="w-full sm:w-auto" loading={isSubmitting} type="submit">
            {step < 3 ? "Selanjutnya" : mode === "edit" ? "Simpan perubahan" : "Simpan profil"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ReferenceLoadingState() {
  return (
    <div aria-busy="true" className="grid gap-12 border-t border-soft-mist pt-24">
      <LoadingSkeleton className="h-12 w-32" />
      <LoadingSkeleton className="h-48 w-3/4" />
      <LoadingSkeleton className="h-20 w-full" />
      <LoadingSkeleton className="h-20 w-11/12" />
    </div>
  );
}
