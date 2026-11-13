"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import LogoLoader from "@/components/logo-loader";

const NAV_START_EVENT = "app:nav-start";
// Safety net so the bar can never get stuck (e.g. a click that ends up not navigating).
const MAX_LOADING_MS = 15000;

/** Call right before `router.push(...)` so the loading bar shows for programmatic navigation. */
export function startNavProgress() {
  window.dispatchEvent(new Event(NAV_START_EVENT));
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const locationKey = `${pathname}?${searchParams.toString()}`;

  // The URL changing means the new page has arrived.
  useEffect(() => {
    setLoading(false);
  }, [locationKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      setLoading(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setLoading(false), MAX_LOADING_MS);
    };

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }

    function onSubmit(e: SubmitEvent) {
      // Decide after the form's own handlers have run: one that calls
      // preventDefault() and does its own work is not a navigation.
      setTimeout(() => {
        if (!e.defaultPrevented) start();
      }, 0);
    }

    // Capture phase on purpose: Next's <Link> handles the click and calls
    // preventDefault() before a normal (bubbling) listener on the document would
    // run, which made this skip every <Link> (e.g. the Attrition drill-downs).
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(NAV_START_EVENT, start);
    };
  }, []);

  useEffect(() => {
    document.body.toggleAttribute("data-nav-loading", loading);
    return () => document.body.removeAttribute("data-nav-loading");
  }, [loading]);

  if (!loading) return null;
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="nav-progress" aria-hidden="true" />
      <div
        className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/90 py-2 pl-3 pr-5 shadow-[0_10px_30px_rgba(30,80,204,0.18)] backdrop-blur"
        aria-hidden="true"
      >
        <LogoLoader size={28} />
        <span className="text-xs font-bold text-brand-blue">Loading…</span>
      </div>
    </div>
  );
}

export default function NavigationProgress() {
  // useSearchParams needs a Suspense boundary above it in the App Router.
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
