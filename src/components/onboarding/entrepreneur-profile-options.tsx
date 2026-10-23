import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

type CheckboxOption = {
  readonly description?: string | null | undefined;
  readonly id: string;
  readonly label: string;
};

type CheckboxGroupProps = {
  readonly describedBy?: string;
  readonly error?: string | undefined;
  readonly id: string;
  readonly legend: string;
  readonly onChange: (selectedIds: readonly string[]) => void;
  readonly otherOption?: OtherCheckboxOption | undefined;
  readonly options: readonly CheckboxOption[];
  readonly selectedIds: readonly string[];
};

type OtherCheckboxOption = {
  readonly checked: boolean;
  readonly error?: string | undefined;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
};

export function CheckboxGroup({
  describedBy,
  error,
  id,
  legend,
  onChange,
  otherOption,
  options,
  selectedIds,
}: CheckboxGroupProps) {
  const errorId = `${id}-error`;
  const errorDescription = error ? errorId : describedBy;

  function toggleOption(optionId: string, checked: boolean): void {
    const nextIds = checked
      ? [...selectedIds, optionId]
      : selectedIds.filter((selectedId) => selectedId !== optionId);
    onChange(nextIds);
  }

  return (
    <fieldset
      aria-describedby={errorDescription}
      aria-invalid={error ? true : undefined}
      className="grid gap-12"
    >
      <legend className="mb-8 text-body-sm font-w540 text-ink-charcoal">{legend}</legend>
      <div className="grid gap-8">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label
              className={cx(
                "flex min-h-button cursor-pointer items-start gap-12 border px-12 py-12 transition-[background-color,border-color] duration-150 hover:border-stone-gray focus-within:ring-2 focus-within:ring-royal-violet/40",
                checked
                  ? "border-midnight-wine bg-lilac-mist/45"
                  : "border-soft-mist bg-paper-white",
              )}
              key={option.id}
            >
              <input
                checked={checked}
                className="mt-4 size-4 shrink-0 accent-midnight-wine focus-visible:outline-none"
                onChange={(event) => toggleOption(option.id, event.target.checked)}
                type="checkbox"
                value={option.id}
              />
              <span className="grid min-w-0 flex-1 gap-4">
                <span className="flex flex-wrap items-center justify-between gap-8">
                  <span className="text-body font-w540 text-ink-charcoal">
                    {option.label}
                  </span>
                  <span
                    className={cx(
                      "text-caption font-w540 text-royal-violet",
                      checked ? "" : "invisible",
                    )}
                  >
                    Dipilih
                  </span>
                </span>
                {option.description ? (
                  <span className="text-body-sm leading-body-sm text-stone-gray">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
        {otherOption ? (
          <div
            className={cx(
              "grid gap-12 border px-12 py-12 transition-[background-color,border-color] duration-150",
              otherOption.checked
                ? "border-midnight-wine bg-lilac-mist/45"
                : "border-soft-mist bg-paper-white",
            )}
          >
            <label
              className="flex min-h-button cursor-pointer items-center gap-12"
              htmlFor={`${id}-other`}
            >
              <input
                checked={otherOption.checked}
                className="size-4 shrink-0 accent-midnight-wine"
                id={`${id}-other`}
                onChange={(event) => otherOption.onCheckedChange(event.target.checked)}
                type="checkbox"
              />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-8">
                <span className="text-body font-w540 text-ink-charcoal">Lainnya</span>
                <span
                  className={cx(
                    "text-caption font-w540 text-royal-violet",
                    otherOption.checked ? "" : "invisible",
                  )}
                >
                  Dipilih
                </span>
              </span>
            </label>
            {otherOption.checked ? (
              <div className="grid gap-8 pl-28">
                <label className="sr-only" htmlFor={`${id}-other-value`}>
                  Tuliskan jenis usaha lainnya
                </label>
                <input
                  aria-describedby={
                    otherOption.error ? `${id}-other-value-error` : undefined
                  }
                  aria-invalid={otherOption.error ? true : undefined}
                  aria-required="true"
                  className={cx(
                    "min-h-button w-full rounded-small-buttons border bg-paper-white px-12 text-body text-ink-charcoal placeholder:text-stone-gray transition-[border-color,border-width] duration-200 ease-out focus:border-2 focus:border-royal-violet focus-visible:outline-none",
                    otherOption.error ? "border-midnight-wine" : "border-stone-gray",
                  )}
                  id={`${id}-other-value`}
                  maxLength={100}
                  onChange={(event) => otherOption.onValueChange(event.target.value)}
                  placeholder="Tuliskan jenis usaha lainnya..."
                  type="text"
                  value={otherOption.value}
                />
                {otherOption.error ? (
                  <p
                    className="text-body-sm font-w540 text-midnight-wine"
                    id={`${id}-other-value-error`}
                  >
                    {otherOption.error}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="text-body-sm font-w540 text-midnight-wine" id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type FormSectionProps = {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
};

export function FormSection({ children, description, title }: FormSectionProps) {
  return (
    <section className="grid gap-16 border-t border-soft-mist pt-24">
      <div className="grid gap-8">
        <h2 className="text-subheading font-w460 leading-subheading tracking-heading-sm text-ink-charcoal">
          {title}
        </h2>
        {description ? (
          <p className="max-w-[52ch] text-body-sm leading-body-sm text-stone-gray">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
