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

const options: ReadonlyArray<{
  description: string;
  label: string;
  value: UserType;
}> = [
  {
    description: "Untuk menyiapkan langkah awal usaha baru.",
    label: "Saya ingin memulai bisnis F&B",
    value: USER_TYPES.ENTREPRENEUR,
  },
  {
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

export function UserTypeSelection() {
  const router = useRouter();
  const titleId = useId();
  const errorId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [selectedUserType, setSelectedUserType] = useState<UserType | null>(
    null,
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
      className="border-t border-soft-mist pt-20 sm:pt-24"
    >
      <header>
        <p className="text-caption font-w540 uppercase tracking-[0.08em] text-stone-gray">
          Account setup
        </p>
      </header>

      <form className="mt-24 grid gap-24" onSubmit={handleSubmit}>
        <fieldset
          aria-describedby={formError ? errorId : undefined}
          aria-invalid={formError ? "true" : undefined}
          className="grid gap-12"
        >
          <legend
            className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal"
            id={titleId}
          >
            Apa tujuan Anda menggunakan VENTUREX?
          </legend>
          <p className="-mt-4 max-w-[48ch] text-body-sm leading-body-sm text-stone-gray">
            Pilihan ini menentukan jalur persiapan profil Anda berikutnya.
          </p>
          {options.map((option) => {
            const isSelected = selectedUserType === option.value;
            return (
              <label
                className={cx(
                  "flex min-h-button cursor-pointer items-start gap-12 border bg-paper-white px-16 py-12 transition-[background-color,border-color] duration-150 hover:border-stone-gray focus-within:border-royal-violet focus-within:ring-2 focus-within:ring-royal-violet/40",
                  isSelected
                    ? "border-midnight-wine bg-lilac-mist/50"
                    : "border-soft-mist",
                )}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  className="mt-4 size-4 shrink-0 accent-midnight-wine"
                  name="userType"
                  onChange={() => selectUserType(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span className="grid gap-4">
                  <span className="text-body font-w540 text-ink-charcoal">
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

        <Button disabled={!selectedUserType} loading={isSubmitting} type="submit">
          Lanjutkan
        </Button>
      </form>
    </section>
  );
}
