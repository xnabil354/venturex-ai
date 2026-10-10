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
  readonly options: readonly CheckboxOption[];
  readonly selectedIds: readonly string[];
};

export function CheckboxGroup({
  describedBy,
  error,
  id,
  legend,
  onChange,
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
      <legend className="text-body-sm font-w540 text-ink-charcoal">{legend}</legend>
      <div className="grid gap-8">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label
              className={cx(
                "flex min-h-button cursor-pointer items-start gap-12 border bg-paper-white px-12 py-12 transition-[background-color,border-color] duration-150 hover:border-stone-gray focus-within:border-royal-violet focus-within:ring-2 focus-within:ring-royal-violet/40",
                checked
                  ? "border-midnight-wine bg-lilac-mist/45"
                  : "border-soft-mist",
              )}
              key={option.id}
            >
              <input
                checked={checked}
                className="mt-4 size-4 shrink-0 accent-midnight-wine"
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
      <div className="grid gap-4">
        <h2 className="text-label-bold font-w460 leading-label-bold text-ink-charcoal">
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
