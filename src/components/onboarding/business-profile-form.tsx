"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { BusinessProfileInput } from "@/profile/business-validation";

import {
  OnboardingProgressPublisher,
  OnboardingProgressSlot,
} from "./onboarding-progress-context";
import {
  BusinessProfileStepOne,
  BusinessProfileStepThree,
  BusinessProfileStepTwo,
} from "./business-profile-steps";
import {
  createInitialBusinessFormState,
  toBusinessFormState,
  toBusinessProfilePayload,
  validateStep,
  type BusinessFormState,
  type BusinessFormStep,
} from "./business-profile-form.validation";
import type {
  BusinessFormErrors,
  ReferenceData,
  ReferenceState,
} from "./business-profile-form.types";

const categoryEnvelopeSchema = z.object({
  data: z.array(z.object({ code: z.string(), id: z.string().uuid(), name: z.string(), parentId: z.string().uuid().nullable() })),
  requestId: z.string(),
  success: z.literal(true),
});
const segmentEnvelopeSchema = z.object({
  data: z.array(z.object({ code: z.string(), description: z.string().nullable(), id: z.string().uuid(), name: z.string() })),
  requestId: z.string(),
  success: z.literal(true),
});
const channelEnvelopeSchema = z.object({
  data: z.array(z.object({ code: z.string(), id: z.string().uuid(), name: z.string() })),
  requestId: z.string(),
  success: z.literal(true),
});
const profileSuccessSchema = z.object({
  data: z.object({ profileComplete: z.literal(true), profileVersion: z.number().int() }),
  requestId: z.string(),
  success: z.literal(true),
});
const STEP_META = {
  1: { label: "Identitas bisnis" },
  2: { label: "Produk dan harga" },
  3: { label: "Pelanggan dan cara menjual" },
} as const satisfies Record<BusinessFormStep, { label: string }>;
const PROFILE_STEPS = [STEP_META[1], STEP_META[2], STEP_META[3]];

class ReferenceLoadError extends Error {
  override readonly name = "ReferenceLoadError";

  constructor(readonly reason: "network" | "server" | "invalid") {
    super(`Reference data failed: ${reason}`);
  }
}

async function fetchReference<T>(url: string, parse: (body: unknown) => T): Promise<T> {
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
  try {
    return parse(await response.json());
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new ReferenceLoadError("invalid");
    }
    throw error;
  }
}

async function loadReferenceData(): Promise<ReferenceData> {
  const [categories, segments, channels] = await Promise.all([
    fetchReference("/api/v1/reference/fnb-categories", (body) => categoryEnvelopeSchema.parse(body).data),
    fetchReference("/api/v1/reference/customer-segments", (body) => segmentEnvelopeSchema.parse(body).data),
    fetchReference("/api/v1/reference/sales-channels", (body) => channelEnvelopeSchema.parse(body).data),
  ]);
  return { categories, channels, segments };
}

export type BusinessProfileFormProps = {
  readonly initialValues?: BusinessProfileInput;
  readonly mode?: "onboarding" | "edit";
};

export function BusinessProfileForm({
  initialValues,
  mode = "onboarding",
}: BusinessProfileFormProps) {
  const router = useRouter();
  const headingId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [formState, setFormState] = useState(() =>
    initialValues ? toBusinessFormState(initialValues) : createInitialBusinessFormState(),
  );
  const [step, setStep] = useState<BusinessFormStep>(1);
  const [stepErrors, setStepErrors] = useState<BusinessFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referenceAttempt, setReferenceAttempt] = useState(0);
  const [references, setReferences] = useState<ReferenceState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadReferenceData()
      .then((data) => {
        if (!cancelled) setReferences({ data, status: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ReferenceLoadError && error.reason === "network"
          ? "Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi."
          : "Pilihan profil belum dapat dimuat. Coba lagi.";
        setReferences({ message, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [referenceAttempt]);

  useEffect(() => {
    if (formError) errorSummaryRef.current?.focus();
  }, [formError]);

  function retryReferences(): void {
    setReferences({ status: "loading" });
    setReferenceAttempt((current) => current + 1);
  }

  function updateForm(patch: Partial<BusinessFormState>): void {
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
    if (step < 3) setStep((current) => (current + 1) as BusinessFormStep);
  }

  function handleBack(): void {
    setFormError(null);
    setStepErrors({});
    if (step > 1) setStep((current) => (current - 1) as BusinessFormStep);
  }

  async function submitProfile(): Promise<void> {
    const errors = validateStep(3, formState);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      setFormError("Periksa bagian yang masih perlu dilengkapi sebelum menyimpan.");
      return;
    }
    const payload = toBusinessProfilePayload(formState);
    if (!payload.success) {
      setStepErrors(payload.errors);
      setFormError("Data profil belum lengkap. Periksa kembali isian Anda.");
      return;
    }

    setIsSubmitting(true);
    setStepErrors({});
    setFormError(null);
    try {
      const response = await fetch("/api/v1/profile/business", {
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
      } else if (response.status === 403) {
        setFormError("Akun ini tidak menggunakan jalur profil bisnis.");
      } else if (response.status === 404) {
        retryReferences();
        setFormError("Pilihan referensi berubah. Periksa pilihan setelah data dimuat ulang.");
      } else if (response.status === 409) {
        setFormError("Profil bisnis belum dapat disimpan pada tahap ini. Muat ulang lalu coba lagi.");
      } else {
        setFormError("Profil belum dapat disimpan. Silakan coba lagi.");
      }
    } catch (error) {
      setFormError(error instanceof TypeError
        ? "Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi."
        : "Profil belum dapat disimpan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting) return;
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
  if (!references.data.categories.length || !references.data.segments.length || !references.data.channels.length) {
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

  const Heading = mode === "edit" ? "h2" : "h1";

  return (
    <section aria-labelledby={headingId} className={cx(
      "grid",
      mode === "edit"
        ? "mx-auto max-w-[58rem] gap-24 rounded-cards border border-soft-mist bg-paper-white p-16 sm:p-24"
        : "gap-32 border-t border-soft-mist pt-20 sm:pt-24",
    )}>
      <header className={cx("grid", mode === "edit" ? "gap-8 border-b border-soft-mist pb-16" : "gap-12")}>
        <Heading className="max-w-[20ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:max-w-none" id={headingId}>
          {mode === "edit" ? "Perbarui detail usaha" : "Lengkapi profil bisnis Anda"}
        </Heading>
        <p className="max-w-[52ch] text-body-sm leading-body-sm text-stone-gray">
          {mode === "edit"
            ? "Data yang tersimpan tetap digunakan pada peluang yang sudah ada."
            : "Beberapa detail singkat membantu VENTUREX memahami konteks usaha Anda."}
        </p>
      </header>
      {progressPublisher}
      {mode === "edit" ? (
        <OnboardingProgressSlot currentStep={step} steps={PROFILE_STEPS} />
      ) : null}
      <form className={cx("grid", mode === "edit" ? "gap-24" : "gap-32")} noValidate onSubmit={handleSubmit}>
        {step === 1 ? <BusinessProfileStepOne errors={stepErrors} references={references.data} state={formState} updateForm={updateForm} /> : null}
        {step === 2 ? <BusinessProfileStepTwo errors={stepErrors} references={references.data} state={formState} updateForm={updateForm} /> : null}
        {step === 3 ? <BusinessProfileStepThree errors={stepErrors} references={references.data} state={formState} updateForm={updateForm} /> : null}
        {formError ? (
          <div aria-live="assertive" className="rounded-small-buttons border border-red-300 bg-red-50 px-12 py-12 text-body-sm font-w540 text-red-800" ref={errorSummaryRef} role="alert" tabIndex={-1}>
            {formError}
          </div>
        ) : null}
        <div className={`flex flex-col-reverse gap-12 border-t border-soft-mist pt-20 sm:flex-row sm:items-center sm:pt-24 ${step > 1 ? "justify-between" : "justify-end"}`}>
          {step > 1 ? <Button className="w-full sm:w-auto" disabled={isSubmitting} onClick={handleBack} type="button" variant="ghost">Sebelumnya</Button> : null}
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
