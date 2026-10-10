"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z, ZodError } from "zod";

import { registrationSchema } from "@/auth/validation";
import { Button, Input } from "@/components/ui";

type RegisterValues = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

type RegisterField = keyof RegisterValues;
type FieldErrors = Partial<Record<RegisterField, string>>;

type RegisterFormResponse = z.infer<typeof registerResponseSchema>;

const registerResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.object({ email: z.string() }),
    requestId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      fields: z.record(z.string(), z.array(z.string())).optional(),
      message: z.string(),
    }),
    requestId: z.string(),
  }),
]);

const initialValues: RegisterValues = {
  email: "",
  password: "",
  passwordConfirmation: "",
};

function messageForField(field: RegisterField): string {
  if (field === "email") {
    return "Masukkan email yang valid.";
  }
  if (field === "password") {
    return "Password minimal 8 karakter.";
  }
  return "Konfirmasi password harus sama.";
}

function getClientFieldErrors(values: RegisterValues): FieldErrors {
  const result = registrationSchema.safeParse(values);
  if (result.success) {
    return {};
  }

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      (field === "email" ||
        field === "password" ||
        field === "passwordConfirmation") &&
      !errors[field]
    ) {
      errors[field] = messageForField(field);
    }
  }
  return errors;
}

function getServerFieldErrors(
  fields: Record<string, string[]> | undefined,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of ["email", "password", "passwordConfirmation"] as const) {
    if (fields?.[field]?.length) {
      errors[field] = messageForField(field);
    }
  }
  return errors;
}

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<RegisterValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) {
      errorSummaryRef.current?.focus();
    }
  }, [formError]);

  function updateField(field: RegisterField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clientFieldErrors = getClientFieldErrors(values);
    if (Object.keys(clientFieldErrors).length > 0) {
      setFieldErrors(clientFieldErrors);
      setFormError("Periksa kembali data yang diisi.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/v1/auth/register", {
        body: JSON.stringify(values),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: RegisterFormResponse = registerResponseSchema.parse(
        await response.json(),
      );

      if (response.status === 201 && payload.success) {
        router.replace("/login?registered=1");
        return;
      }

      if (!payload.success && response.status === 400) {
        const serverFieldErrors = getServerFieldErrors(payload.error.fields);
        setFieldErrors(serverFieldErrors);
        setFormError("Periksa kembali data yang diisi.");
        return;
      }

      if (
        !payload.success &&
        (response.status === 409 || payload.error.code === "EMAIL_ALREADY_EXISTS")
      ) {
        setFieldErrors({ email: "Email sudah digunakan." });
        setFormError("Email sudah digunakan. Silakan masuk atau gunakan email lain.");
        return;
      }

      setFormError("Terjadi kendala saat membuat akun. Silakan coba lagi.");
    } catch (error) {
      if (error instanceof TypeError) {
        setFormError("Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi.");
        return;
      }
      if (error instanceof ZodError || error instanceof Error) {
        setFormError("Terjadi kendala saat membuat akun. Silakan coba lagi.");
        return;
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-16">
      {formError ? (
        <div
          aria-live="assertive"
          className="border-l-2 border-midnight-wine bg-warm-parchment px-12 py-8 text-body-sm text-ink-charcoal"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </div>
      ) : null}
      <form className="grid gap-16" noValidate onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          error={fieldErrors.email}
          id="register-email"
          label="Email"
          name="email"
          onChange={(event) => updateField("email", event.target.value)}
          type="email"
          value={values.email}
        />
        <Input
          autoComplete="new-password"
          error={fieldErrors.password}
          id="register-password"
          label="Password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          type="password"
          value={values.password}
        />
        <Input
          autoComplete="new-password"
          error={fieldErrors.passwordConfirmation}
          id="register-password-confirmation"
          label="Konfirmasi password"
          name="passwordConfirmation"
          onChange={(event) =>
            updateField("passwordConfirmation", event.target.value)
          }
          type="password"
          value={values.passwordConfirmation}
        />
        <Button loading={isSubmitting} type="submit">
          Buat akun
        </Button>
      </form>
    </div>
  );
}
