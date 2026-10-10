import Link from "next/link";
import { useId } from "react";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type AuthMode = "login" | "register";

type AuthPanelProps = {
  active: AuthMode;
  children: ReactNode;
  description: string;
  title: string;
};

const authLinkClasses =
  "inline-flex min-h-button items-center text-body-sm transition-colors duration-150 ease-out";

export function AuthPanel({
  active,
  children,
  description,
  title,
}: AuthPanelProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="border border-soft-mist bg-paper-white p-20 sm:p-24"
    >
      <header>
        <h1
          className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal"
          id={titleId}
        >
          {title}
        </h1>
        <p className="mt-12 max-w-[48ch] text-body-sm leading-body-sm text-stone-gray">
          {description}
        </p>
      </header>
      <div className="mt-24">{children}</div>
      <nav
        aria-label="Authentication navigation"
        className="mt-24 border-t border-soft-mist pt-16"
      >
        <p className="text-body-sm text-stone-gray">
          {active === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
        </p>
        <div className="mt-8 flex flex-wrap gap-12">
          <Link
            aria-current={active === "login" ? "page" : undefined}
            className={cx(
              authLinkClasses,
              active === "login"
                ? "font-w540 text-ink-charcoal underline decoration-midnight-wine decoration-2 underline-offset-4"
                : "font-w460 text-royal-violet hover:text-midnight-wine",
            )}
            href="/login"
          >
            Masuk
          </Link>
          <Link
            aria-current={active === "register" ? "page" : undefined}
            className={cx(
              authLinkClasses,
              active === "register"
                ? "font-w540 text-ink-charcoal underline decoration-midnight-wine decoration-2 underline-offset-4"
                : "font-w460 text-royal-violet hover:text-midnight-wine",
            )}
            href="/register"
          >
            Buat akun
          </Link>
        </div>
      </nav>
    </section>
  );
}
