"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, Input } from "@/components/ui";
import { EyeIcon, EyeOffIcon } from "./auth-icons";
import { consumeRegisteredEmail } from "./registered-email";

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
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<LoginValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const registeredEmail = consumeRegisteredEmail();
    if (registeredEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((current) => ({
        ...current,
        email: current.email || registeredEmail,
      }));
    }
    // This state is an intentional guard: native submission must stay disabled
    // until React has attached the client-side authentication handler.
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

      const session = await getSession();
      router.replace(session?.user?.accountType === "ADMIN" ? "/admin/dashboard" : "/dashboard");
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
    <div className="grid gap-20">
      {registered ? (
        <p
          aria-live="polite"
          className="border-l-2 border-deep-lagoon bg-warm-parchment px-12 py-10 text-body-sm font-w460 text-ink-charcoal"
          role="status"
        >Akun berhasil dibuat. Silakan masuk untuk melanjutkan.</p>
      ) : null}
      {formError ? (
        <div
          aria-live="assertive"
          className="rounded-small-buttons border border-red-300 bg-red-50 px-12 py-10 text-body-sm font-w540 text-red-800"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >{formError}</div>
      ) : null}
      {!isReady ? (
        <p aria-live="polite" className="text-body-sm text-stone-gray animate-pulse" role="status">
          Menyiapkan formulir masuk…
        </p>
      ) : null}
      <form className="grid gap-16" method="post" noValidate onSubmit={handleSubmit}>
        <Input
          autoComplete="username"
          disabled={!isReady}
          enterKeyHint="next"
          error={fieldErrors.email}
          id="login-email"
          label="Email"
          name="email"
          onChange={(event) => updateField("email", event.target.value)}
          
          required
          type="email"
          value={values.email}
        />
        <Input
          autoComplete="current-password"
          disabled={!isReady}
          enterKeyHint="done"
          error={fieldErrors.password}
          id="login-password"
          label="Password"
          name="password"
          onChange={(event) => updateField("password", event.target.value)}

          required
          type={showPassword ? "text" : "password"}
          value={values.password}
          suffix={
            <button
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              className="inline-flex size-44 items-center justify-center rounded-small-buttons text-stone-gray transition-colors hover:text-ink-charcoal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-royal-violet"
              disabled={!isReady}
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
            >
              {showPassword ? (
                <EyeOffIcon className="h-16 w-16" />
              ) : (
                <EyeIcon className="h-16 w-16" />
              )}
            </button>
          }
        />
        <Button
          className="w-full justify-center shadow-sm mt-4"
          disabled={!isReady}
          loading={isSubmitting}
          type="submit"
        >
          Masuk
        </Button>
      </form>
    </div>
  );
}
