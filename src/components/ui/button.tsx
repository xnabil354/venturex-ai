import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-midnight-wine text-paper-white hover:bg-midnight-wine/90 disabled:bg-midnight-wine/60",
  secondary:
    "border border-ink-charcoal bg-lilac-mist text-ink-charcoal hover:bg-paper-white disabled:border-stone-gray/50 disabled:text-stone-gray",
  ghost:
    "min-h-11 rounded-none px-4 text-ink-charcoal hover:text-royal-violet disabled:text-stone-gray",
};

export function Button({
  children,
  className,
  disabled,
  loading = false,
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
        "relative inline-flex min-h-button items-center justify-center gap-8 rounded-buttons px-12 text-body font-w460 transition-[background-color,color,border-color,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
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
          Loading
        </span>
      ) : null}
    </button>
  );
}
