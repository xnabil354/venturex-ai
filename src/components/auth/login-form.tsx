"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, Input } from "@/components/ui";

type LoginFormProps = {
  registered?: boolean;
};

type LoginValues = {
  email: string;
  password: string;
};

type LoginField = keyof LoginValues;
type FieldErrors = Partial<Record<LoginField, string>>;

const initialValues: LoginValues = { email: "", password: "" };

function validate(values: LoginValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.email.trim()) {
    errors.email = "Masukkan email Anda.";
  } else if (!values.email.includes("@")) {
    errors.email = "Masukkan email yang valid.";
  }

  if (!values.password) {
    errors.password = "Masukkan password Anda.";
  }

  return errors;
}

export function LoginForm({ registered = false }: LoginFormProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [values, setValues] = useState<LoginValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This state is an intentional guard: native submission must stay disabled
    // until React has attached the client-side authentication handler.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (formError) {
      errorSummaryRef.current?.focus();
    }
  }, [formError]);

  function updateField(field: LoginField, value: string) {
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

    if (!isReady || isSubmitting) {
      return;
    }

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError("Periksa kembali data yang diisi.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const result = await signIn("credentials", {
        email: values.email.trim(),
        password: values.password,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        setFormError("Email atau password tidak sesuai.");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        setFormError("Terjadi kendala saat masuk. Silakan coba lagi.");
        return;
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-16">
      {registered ? (
        <p
          aria-live="polite"
          className="border-l-2 border-deep-lagoon bg-warm-parchment px-12 py-8 text-body-sm text-ink-charcoal"
          role="status"
        >
          Akun berhasil dibuat. Silakan masuk untuk melanjutkan.
        </p>
      ) : null}
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
      {!isReady ? (
        <p aria-live="polite" className="text-body-sm text-stone-gray" role="status">
          Menyiapkan formulir masuk…
        </p>
      ) : null}
      <form className="grid gap-16" method="post" noValidate onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          disabled={!isReady}
          error={fieldErrors.email}
          id="login-email"
          label="Email"
          name="email"
          onChange={(event) => updateField("email", event.target.value)}
          type="email"
          value={values.email}
        />
        <Input
          autoComplete="current-password"
          disabled={!isReady}
          error={fieldErrors.password}
          id="login-password"
          label="Password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          type="password"
          value={values.password}
        />
        <Button disabled={!isReady} loading={isSubmitting} type="submit">
          Masuk
        </Button>
      </form>
    </div>
  );
}
