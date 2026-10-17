import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { cx } from "@/lib/cx";

type FieldProps = {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  FieldProps & {
    id: string;
    suffix?: ReactNode;
  };

export function Input({
  className,
  error,
  hint,
  id,
  label,
  suffix,
  ...props
}: InputProps) {
  const describedBy = error
    ? hint
      ? `${id}-hint ${id}-error`
      : `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div className="grid gap-8">
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor={id}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cx(
            "min-h-button w-full rounded-small-buttons border bg-paper-white px-12 text-body text-ink-charcoal placeholder:text-stone-gray transition-[border-color,border-width] duration-200 ease-out focus:border-2 focus:border-royal-violet focus-visible:outline-none",
            Boolean(suffix) && "pr-44",
            error ? "border-midnight-wine" : "border-stone-gray",
            className,
          )}
          id={id}
        />
        {suffix ? (
          <div className="absolute right-8 flex items-center text-stone-gray">
            {suffix}
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className="text-body-sm text-stone-gray" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-body-sm font-w540 text-midnight-wine" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldProps & {
    id: string;
    options: readonly SelectOption[];
  };

export function Select({
  className,
  error,
  hint,
  id,
  label,
  options,
  ...props
}: SelectProps) {
  const describedBy = error
    ? hint
      ? `${id}-hint ${id}-error`
      : `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div className="grid gap-8">
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          "min-h-button w-full rounded-small-buttons border bg-paper-white px-12 text-body text-ink-charcoal transition-[border-color,border-width] duration-200 ease-out focus:border-2 focus:border-royal-violet focus-visible:outline-none",
          error ? "border-midnight-wine" : "border-stone-gray",
          className,
        )}
        id={id}
      >
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="text-body-sm text-stone-gray" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-body-sm font-w540 text-midnight-wine" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
