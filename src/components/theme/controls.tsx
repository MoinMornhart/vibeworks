"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { HEX_RE } from "@/lib/theme/color";
import { cn } from "@/lib/utils";

// Kleine Bedienelemente für den Design-Editor.

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const id = useId();
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-3">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border shadow-inner" style={{ background: value }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`${label} wählen`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block truncate text-xs text-muted">{label}</label>
        <input
          id={id}
          className="field !min-h-0 !px-2 !py-1 font-mono text-xs"
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX_RE.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setText(value)}
        />
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <label htmlFor={id} className="text-muted">{label}</label>
        <span className="font-mono tabular-nums">{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("vw-range w-full", disabled && "cursor-not-allowed opacity-50")}
      />
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors", checked ? "border-transparent bg-accent" : "bg-bg/60")}>
        <span className={cn("absolute top-0.5 h-[1.1rem] w-[1.1rem] rounded-full bg-white shadow transition-all", checked ? "left-[1.35rem]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border bg-bg/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
            value === o.value ? "bg-accent text-on-accent shadow" : "text-muted hover:text-fg",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="glass p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
