"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  type UserType,
} from "@/auth/user-types";
import { userTypeSelectionSchema } from "@/auth/validation";
import { Button } from "@/components/ui";
import { cx } from "@/lib/cx";

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  userType: z.enum([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING]).nullable(),
  onboardingStatus: z.enum([
    ONBOARDING_STATUSES.NOT_STARTED,
    ONBOARDING_STATUSES.USER_TYPE_SELECTED,
    ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    ONBOARDING_STATUSES.COMPLETED,
  ]),
});

const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: userSchema,
    requestId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
    requestId: z.string(),
  }),
]);

type UserResponse = z.infer<typeof responseSchema>;
type UserTypeSelectionProps = Readonly<{
  initialUserType?: UserType | null;
}>;

const options: ReadonlyArray<{
  audience: string;
  description: string;
  label: string;
  value: UserType;
}> = [
  {
    audience: "Calon pengusaha",
    description: "Untuk menyiapkan langkah awal usaha baru.",
    label: "Saya ingin memulai bisnis F&B",
    value: USER_TYPES.ENTREPRENEUR,
  },
  {
    audience: "Usaha berjalan",
    description: "Untuk mengembangkan bisnis F&B yang sudah berjalan.",
    label: "Saya sudah memiliki bisnis F&B",
    value: USER_TYPES.UMKM_EXISTING,
  },
];

function destinationFor(userType: UserType): string {
  return userType === USER_TYPES.ENTREPRENEUR
    ? "/onboarding/entrepreneur"
    : "/onboarding/business";
}

async function readResponse(response: Response): Promise<UserResponse> {
  return responseSchema.parse(await response.json());
}

export function UserTypeSelection({
  initialUserType = null,
}: UserTypeSelectionProps) {
  const router = useRouter();
  const titleId = useId();
  const errorId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [selectedUserType, setSelectedUserType] = useState<UserType | null>(
    initialUserType,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (formError) {
      errorSummaryRef.current?.focus();
    }
  }, [formError]);

  function selectUserType(userType: UserType) {
    setSelectedUserType(userType);
    setFormError(null);
  }

  async function refreshDestination(): Promise<boolean> {
    const response = await fetch("/api/v1/me", { cache: "no-store" });
    const payload = await readResponse(response);

    if (response.status === 401) {
      router.replace("/login");
      return true;
    }

    if (!response.ok || !payload.success || !payload.data.userType) {
      return false;
    }

    router.replace(destinationFor(payload.data.userType));
    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserType) {
      setFormError("Pilih salah satu opsi untuk melanjutkan.");
      return;
    }

    if (selectedUserType === initialUserType && initialUserType) {
      router.replace(destinationFor(initialUserType));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const input = userTypeSelectionSchema.parse({
        userType: selectedUserType,
      });
      const response = await fetch("/api/v1/me/user-type", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const payload = await readResponse(response);

      if (response.ok && payload.success && payload.data.userType) {
        router.replace(destinationFor(payload.data.userType));
        return;
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 400) {
        setFormError("Pilihan belum valid. Pilih salah satu opsi yang tersedia.");
        return;
      }

      if (response.status === 409) {
        if (await refreshDestination()) {
          return;
        }
        setFormError(
          "Pilihan akun sudah tersimpan. Muat ulang halaman untuk melanjutkan.",
        );
        return;
      }

      setFormError("Terjadi kendala saat menyimpan pilihan. Silakan coba lagi.");
    } catch (error) {
      if (error instanceof TypeError) {
        setFormError("Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi.");
        return;
      }

      setFormError("Terjadi kendala saat menyimpan pilihan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-32"
    >
      <header className="text-left">
        <p className="text-caption font-w540 uppercase tracking-[0.12em] text-stone-gray">
          Pilih jalur
        </p>
      </header>

      <form className="grid gap-24" onSubmit={handleSubmit}>
        <fieldset
          aria-describedby={formError ? errorId : undefined}
          aria-invalid={formError ? "true" : undefined}
          className="grid gap-16"
        >
          <legend
            className="max-w-[24ch] text-left text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal"
            id={titleId}
          >
            Apa tujuan Anda menggunakan VENTUREX?
          </legend>
          <p className="-mt-4 max-w-[42ch] text-left text-body-sm leading-body-sm text-stone-gray">
            Pilihan ini menentukan jalur persiapan profil Anda berikutnya.
          </p>
          {options.map((option, index) => {
            const isSelected = selectedUserType === option.value;
            return (
              <label
                className={cx(
                  "group grid min-h-[9rem] cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-16 rounded-cards border px-16 py-16 transition-[background-color,border-color,transform] duration-200 ease-out active:translate-y-px focus-within:ring-2 focus-within:ring-royal-violet/40 focus-within:ring-offset-2 focus-within:ring-offset-paper-white motion-reduce:transition-none sm:px-20 sm:py-20",
                  isSelected
                    ? "border-midnight-wine bg-lilac-mist/40"
                    : "border-soft-mist bg-warm-parchment hover:-translate-y-0.5 hover:border-stone-gray",
                )}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  className="peer sr-only focus-visible:outline-none"
                  name="userType"
                  onChange={() => selectUserType(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    "mt-2 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                    isSelected
                      ? "border-midnight-wine bg-midnight-wine"
                      : "border-soft-mist bg-paper-white group-hover:border-stone-gray",
                  )}
                >
                  {isSelected ? (
                    <span className="size-2 rounded-full bg-paper-white" />
                  ) : null}
                </span>
                <span className="grid gap-8">
                  <span className="text-caption font-w540 tracking-[0.08em] text-stone-gray">
                    {String(index + 1).padStart(2, "0")} / {option.audience}
                  </span>
                  <span className="text-body font-w540 leading-body text-ink-charcoal">
                    {option.label}
                  </span>
                  <span className="text-body-sm leading-body-sm text-stone-gray">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {formError ? (
          <div
            aria-live="assertive"
            className="border-l-2 border-midnight-wine bg-warm-parchment px-12 py-8 text-body-sm text-ink-charcoal"
            id={errorId}
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
          >
            {formError}
          </div>
        ) : null}

        <Button
          className="group w-full justify-between px-20 sm:w-auto sm:min-w-48"
          disabled={!selectedUserType}
          loading={isSubmitting}
          type="submit"
        >
          Lanjutkan
          <svg
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M3 8h10M8.5 3.5 13 8l-4.5 4.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </Button>
      </form>
    </section>
  );
}
