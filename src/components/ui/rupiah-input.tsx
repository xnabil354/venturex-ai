"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

import { formatRupiahInput, parseRupiahInput, rupiahCaretPosition } from "@/lib/rupiah-input";

import { Input, type InputProps } from "./form-controls";

export type RupiahInputProps = Omit<
  InputProps,
  "inputMode" | "inputRef" | "onChange" | "prefix" | "type" | "value"
> & {
  readonly onValueChange: (digits: string) => void;
  readonly value: string;
};

export function RupiahInput({ onValueChange, value, ...props }: RupiahInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextCaret = useRef<number | null>(null);
  const [caretRevision, setCaretRevision] = useState(0);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && nextCaret.current !== null && document.activeElement === input) {
      input.setSelectionRange(nextCaret.current, nextCaret.current);
    }
    nextCaret.current = null;
  }, [caretRevision, value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const parsed = parseRupiahInput(input.value);
    if (parsed === null) return;

    const digitsBeforeCaret = input.value
      .slice(0, input.selectionStart ?? input.value.length)
      .replace(/\D/gu, "").length;
    nextCaret.current = rupiahCaretPosition(parsed, digitsBeforeCaret);
    onValueChange(parsed);
    setCaretRevision((revision) => revision + 1);
  }

  return (
    <Input
      {...props}
      inputMode="numeric"
      inputRef={inputRef}
      onChange={handleChange}
      placeholder={props.placeholder ?? "0"}
      prefix={<span className="text-body-sm">Rp</span>}
      type="text"
      value={formatRupiahInput(value)}
    />
  );
}
