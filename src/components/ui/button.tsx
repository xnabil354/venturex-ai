import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  loadingText?: string;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "rounded-buttons bg-midnight-wine text-paper-white hover:bg-midnight-wine/90 disabled:bg-midnight-wine/60",
  inverse:
    "rounded-buttons bg-paper-white text-deep-lagoon hover:bg-paper-white/90 disabled:bg-paper-white/60",
  secondary:
    "rounded-small-buttons border border-ink-charcoal bg-lilac-mist text-ink-charcoal hover:bg-paper-white disabled:border-stone-gray/50 disabled:text-stone-gray",
  ghost:
    "min-h-11 rounded-none px-4 text-ink-charcoal hover:text-royal-violet disabled:text-stone-gray",
};

export function Button({
  children,
  className,
  disabled,
  loading = false,
  loadingText = "Loading",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={cx(
        "relative inline-flex min-h-button items-center justify-center gap-8 px-12 text-body font-w460 transition-[background-color,color,border-color,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet",
        variantClasses[variant],
        className,
      )}
      disabled={isDisabled}
      type={type}
    >
      <span aria-hidden={loading} className={cx(loading && "opacity-0")}>
        {children}
      </span>
      {loading ? (
        <span aria-live="polite" className="absolute">
          {loadingText}
        </span>
      ) : null}
    </button>
  );
}
