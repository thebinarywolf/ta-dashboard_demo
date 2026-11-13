"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A scrolling box for wide tables. On a phone, when more columns are hidden
 * off to the right, it shows a soft fade on that edge and a small
 * "Swipe for more" hint (until the person scrolls), so it is obvious there is
 * more to see. A fade also appears on the left once they have scrolled.
 */
export default function ScrollTable({
  className = "",
  outerClassName = "",
  children,
}: {
  /** Classes for the scrolling box itself (panel style, max height, …). */
  className?: string;
  /** Classes for the outer box (spacing such as mt-3). */
  outerClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  const [moreLeft, setMoreLeft] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
      setMoreLeft(el.scrollLeft > 2);
    };
    const onScroll = () => {
      if (el.scrollLeft > 8) setScrolled(true);
      update();
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${outerClassName}`}>
      <div ref={ref} className={`overflow-auto ${className}`}>
        {children}
      </div>
      {moreLeft && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-[22px] bg-gradient-to-r from-slate-400/20 to-transparent"
        />
      )}
      {moreRight && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 rounded-r-[22px] bg-gradient-to-l from-white via-white/70 to-transparent"
          />
          {!scrolled && (
            <div
              aria-hidden
              className="swipe-hint pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-brand-blue px-2.5 py-1 text-[10px] font-bold text-white shadow-md"
            >
              Swipe for more <span className="swipe-arrow">→</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
