"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";

import {
  googleTrendsGeoOptionsResponseSchema,
  type GoogleTrendsGeoOption,
} from "@/trend/trend-radar-contract";

export function GoogleTrendsGeographySelect({
  disabled = false,
  id,
  label = "Wilayah",
  onChange,
  value,
}: {
  readonly disabled?: boolean;
  readonly id: string;
  readonly label?: string;
  readonly onChange: (value: GoogleTrendsGeoOption | null) => void;
  readonly value: GoogleTrendsGeoOption | null;
}) {
  const instanceId = useId();
  const listboxId = `google-trends-geographies-${instanceId}`;
  const validationId = `google-trends-geographies-validation-${instanceId}`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<readonly GoogleTrendsGeoOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (!open || disabled) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setLookupFailed(false);
      const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      void fetch(`/api/v1/trend-radar/geographies${search}`, {
        credentials: "same-origin",
        cache: "force-cache",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Geography search failed");
        const parsed = googleTrendsGeoOptionsResponseSchema.safeParse(await response.json() as unknown);
        if (!parsed.success) throw new Error("Geography response was invalid");
        if (!controller.signal.aborted) {
          setOptions(parsed.data.options);
          setActiveIndex(-1);
        }
      }).catch(() => {
        if (!controller.signal.aborted) {
          setOptions([]);
          setLookupFailed(true);
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [disabled, open, query]);

  function chooseOption(option: GoogleTrendsGeoOption): void {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => options.length === 0 ? -1 : Math.min(current < 0 ? 0 : current + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => options.length === 0 ? -1 : current < 0 ? options.length - 1 : Math.max(0, current - 1));
      return;
    }
    if (event.key === "Home" && open && options.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open && options.length > 0) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === "Enter" && open && options[activeIndex]) {
      event.preventDefault();
      chooseOption(options[activeIndex]!);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  const inputValue = query || value?.label || "";
  const requiresChoice = query.trim().length > 0 && value === null;

  return (
    <div
      className="relative grid min-w-0 gap-6"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setOpen(false);
      }}
    >
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor={id}>{label}</label>
      <input
        aria-activedescendant={open && options[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-busy={loading}
          aria-controls={open && !loading && options.length > 0 ? listboxId : undefined}
        aria-describedby={requiresChoice ? validationId : undefined}
        aria-expanded={open}
        aria-invalid={requiresChoice}
        autoComplete="off"
        className="min-h-button w-full min-w-0 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm font-w460 text-ink-charcoal focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet disabled:cursor-not-allowed disabled:bg-warm-parchment/60"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
          onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Cari negara atau daerah"
        role="combobox"
        value={inputValue}
      />
      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-4 max-h-[240px] overflow-y-auto rounded-small-buttons border border-soft-mist bg-paper-white p-4 shadow-sm">
          {loading ? <p className="px-10 py-12 text-caption text-stone-gray" role="status">Mencari wilayah…</p> : null}
          {!loading && lookupFailed ? <p className="px-10 py-12 text-caption text-stone-gray" role="status">Daftar wilayah belum bisa dimuat.</p> : null}
          {!loading && !lookupFailed && options.length === 0 ? <p className="px-10 py-12 text-caption text-stone-gray" role="status">Tidak ada wilayah yang cocok.</p> : null}
          {!loading && !lookupFailed && options.length > 0 ? (
            <div aria-label="Wilayah Google Trends" id={listboxId} role="listbox">
              {options.map((option, index) => (
                <div
                  aria-selected={index === activeIndex || value?.geo === option.geo}
                  className={`flex min-h-[44px] cursor-pointer items-center rounded-small-buttons px-10 py-6 text-body-sm text-ink-charcoal ${index === activeIndex ? "bg-lilac-mist/50" : "hover:bg-warm-parchment"}`}
                  id={`${listboxId}-option-${index}`}
                  key={option.geo}
                  onClick={() => chooseOption(option)}
                  onPointerDown={(event) => event.preventDefault()}
                  role="option"
                >
                  {option.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {requiresChoice ? <span className="text-caption text-stone-gray" id={validationId}>Pilih wilayah dari daftar.</span> : null}
    </div>
  );
}
