"use client";

import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type TabItem = {
  id: string;
  label: string;
};

type TabsProps = {
  ariaLabel?: string;
  children?: (value: string) => ReactNode;
  className?: string;
  defaultValue?: string;
  items: readonly TabItem[];
  onValueChange?: (value: string) => void;
  value?: string;
};

export function Tabs({
  ariaLabel = "Sections",
  children,
  className,
  defaultValue,
  items,
  onValueChange,
  value,
}: TabsProps) {
  const generatedId = useId();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? items[0]?.id ?? "",
  );
  const activeValue = value ?? internalValue;
  const panelId = `${generatedId}-panel`;

  function selectTab(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (items.length < 2) {
      return;
    }

    let nextIndex = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % items.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextItem = items[nextIndex];
    if (nextItem) {
      selectTab(nextItem.id);
      document.getElementById(`${generatedId}-${nextItem.id}`)?.focus();
    }
  }

  return (
    <div className={cx("grid gap-16", className)}>
      <div
        aria-label={ariaLabel}
        className="flex flex-wrap gap-4 rounded-tabs border border-soft-mist bg-paper-white p-4"
        role="tablist"
      >
        {items.map((item, index) => {
          const isActive = item.id === activeValue;
          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className={cx(
                "h-button rounded-tabs px-12 text-body-sm font-w540 transition-[background-color,color] duration-200 ease-out",
                isActive
                  ? "bg-lilac-mist text-ink-charcoal"
                  : "bg-paper-white text-stone-gray hover:text-ink-charcoal",
              )}
              id={`${generatedId}-${item.id}`}
              key={item.id}
              onClick={() => selectTab(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children ? (
        <div
          aria-labelledby={`${generatedId}-${activeValue}`}
          className="border-l-2 border-lilac-mist pl-16 text-body-sm text-stone-gray"
          id={panelId}
          role="tabpanel"
          tabIndex={0}
        >
          {children(activeValue)}
        </div>
      ) : null}
    </div>
  );
}
