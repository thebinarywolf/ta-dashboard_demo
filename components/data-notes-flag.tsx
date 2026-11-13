"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small flag icon with a count; clicking it opens a panel listing data
 * notes (e.g. "1 closed position has no closing date"). Keeps these notes out
 * of the page flow until someone wants them. Renders nothing when empty.
 */
export default function DataNotesFlag({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState(false);
  // Where the card sits relative to the flag, worked out when it opens so it never leaves the screen.
  const [place, setPlace] = useState<{ left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const margin = 16;
      const width = Math.min(320, window.innerWidth - margin * 2);
      // Line the card's right edge up with the flag, then slide it back on screen if it does not fit.
      const left = Math.min(Math.max(rect.right - width, margin), window.innerWidth - width - margin);
      setPlace({ left: left - rect.left, width });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (notes.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${notes.length} data ${notes.length === 1 ? "note" : "notes"} about these numbers`}
        title="Data notes"
        className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 text-brand-blue transition hover:bg-white ${
          open ? "bg-white" : "bg-blue-50"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 21V4" />
          <path d="M5 4h12l-2.5 4.5L17 13H5" />
        </svg>
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-blue px-1 text-[10px] font-bold text-white">
          {notes.length}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Data notes"
          style={place ? { left: place.left, width: place.width } : undefined}
          className="absolute top-full z-20 mt-2 w-72 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_16px_40px_rgba(30,80,204,0.18)]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-blue-dark">Data notes</p>
          <ul className="mt-2 space-y-2.5">
            {notes.map((n) => (
              <li key={n} className="flex gap-2 text-xs leading-relaxed text-[#0e1b3d]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden="true" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
