"use client";

import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fromISO } from "@/lib/scheduler";
import type { Level } from "@/lib/types";

export const fmtMin = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
export const fmtDate = (iso: string, pattern = "EEE d MMM") => format(fromISO(iso), pattern);
export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const LEVEL_LABEL = ["", "Very low", "Low", "Medium", "High", "Very high"];
export const priorityChip = (p: number) =>
  p >= 4
    ? { label: "High", className: "bg-rust/35 text-[#e8a58c]" }
    : p === 3
      ? { label: "Medium", className: "bg-ochre/35 text-[#e6c07e]" }
      : { label: "Low", className: "bg-olive/40 text-[#b9c79a]" };

export function useAsync<T, A extends unknown[]>(fn: (...args: A) => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const run = useCallback(async (...args: A) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fnRef.current(...args);
      setData(r);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  return { run, loading, error, data, setData, setError };
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`panel fade-up w-full ${width} shadow-2xl shadow-black/60`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-head flex items-start justify-between gap-4 px-5 py-3.5">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-2 hover:bg-black/20 hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LevelPicker({ label, value, onChange, hint }: { label: string; value: Level; onChange: (v: Level) => void; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink-2">{label}</span>
        <span className="text-muted">{hint ?? LEVEL_LABEL[value]}</span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n as Level)}
            className={`h-8 flex-1 rounded text-sm transition-colors ${
              n <= value ? "bg-copper text-ink" : "bg-panel-3 text-muted hover:bg-line-2"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-2">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </span>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-3 rounded border border-rust/60 bg-rust/15 px-3 py-2 text-sm text-[#f0b8a4]">{error}</p>;
}

export function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct(Math.min(1, value)), background: color }} />
    </div>
  );
}
