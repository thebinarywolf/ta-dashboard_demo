"use client";

import "@/app/side-menu.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

const ICONS: Record<string, string> = {
  "/dashboard": "M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01",
  "/dashboard/attrition": "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 8l-4 4-2-2",
  "/dashboard/attrition-insights": "M4 20V10M10 20V4M16 20v-8M22 20H2",
  "/dashboard/recruiters": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "/dashboard/recruiters-insights": "M4 20V10M10 20V4M16 20v-8M22 20H2",
  "/dashboard/sources": "M4 4h16v4l-6 6v6l-4-2v-4L4 8z",
  "/dashboard/dropouts": "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  "/dashboard/funnel": "M3 4h18l-7 8v7l-4 2v-9z",
  "/dashboard/report": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
  "/dashboard/financials": "M12 3v18M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  "/admin": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  "/admin/data-source": "M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8zM4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5",
};
const FALLBACK_ICON = "M4 7h16M4 12h16M4 17h16";

/** "/dashboard" and "/admin" match exactly (each is a prefix of its own sub-routes); the rest match by prefix. */
function isActive(href: string, pathname: string): boolean {
  return href === "/dashboard" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const isStaging = (href: string) => href.endsWith("-insights");

/**
 * The left menu. It starts shut, with only the logo tab on the left edge; clicking the tab
 * slides the menu out (pushing the page over on a computer, lying over it on a phone).
 * The footer (profile, sign out) is passed in from the server-rendered shell.
 */
export default function SideMenu({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // On the first visit of a browser session the menu slides half way out and back in, so people
  // learn it is there. It is a quick teaser, never shown again that session.
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("menu-peeked")) return;
    } catch {
      return; // storage blocked: skip the teaser rather than repeat it on every page
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const show = setTimeout(() => {
      // Remembered only once it has really been shown (development mode runs effects twice).
      try {
        sessionStorage.setItem("menu-peeked", "1");
      } catch {}
      setPeek(true);
    }, 900);
    const hide = setTimeout(() => setPeek(false), 3000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // On a phone the menu lies over the page, so close it once the new page is showing.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) setPeek(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <aside
        id="side-menu"
        data-open={open || peek}
        aria-label="Main menu"
        className={`side-panel fixed left-0 top-0 z-[48] flex h-screen flex-col gap-1.5 overflow-hidden border-r border-white/90 bg-white/90 shadow-[0_10px_30px_rgba(30,80,204,0.10)] md:sticky md:z-20 md:shrink-0 ${
          open
            ? "w-[min(300px,88vw)] px-3 py-3.5 md:w-[280px]"
            : peek
              ? "pointer-events-none !fixed w-[150px] px-3 py-3.5 shadow-[0_10px_40px_rgba(30,80,204,0.25)]"
              : "invisible w-0 px-0 py-3.5"
        }`}
      >
        <Link href="/dashboard" className="flex shrink-0 items-center px-1 pb-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="TA Dashboard" width={289} height={128} className="h-11 w-auto rounded-lg" />
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {items.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3.5 whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-brand-blue text-white shadow-[0_6px_16px_rgba(30,80,204,0.28)]"
                    : "text-slate-600 hover:bg-blue-50 hover:text-brand-blue"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path d={ICONS[item.href] ?? FALLBACK_ICON} />
                </svg>
                {item.label}
                {isStaging(item.href) && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${
                      active ? "bg-white/25 text-white" : "bg-blue-50 text-brand-blue-dark"
                    }`}
                  >
                    Staging
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-slate-200/70 px-1.5 pt-3">{footer}</div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close the menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[45] bg-[#0e1b3d]/30 md:hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="side-menu"
        aria-label={open ? "Close the menu" : "Open the menu"}
        style={open ? undefined : { left: peek ? 150 : 0 }}
        className={`side-handle fixed z-50 grid place-items-center text-white hover:brightness-110 ${
          open
            ? "top-1/2 left-[min(300px,88vw)] h-[92px] w-[30px] -translate-y-1/2 rounded-r-[18px] bg-gradient-to-b from-[#2f63e0] to-brand-blue sm:w-[34px] md:left-[280px]"
            : // Halfway down the left edge, easy to reach. A bigger tile on narrow screens so it is easy to see and tap.
              "top-1/2 h-[112px] w-[68px] -translate-y-1/2 overflow-hidden rounded-r-2xl bg-[#00319f] lg:h-[100px] lg:w-[62px]"
        }`}
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="side-handle-arrow"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        ) : (
          <span className="flex flex-col items-center gap-0.5">
            {/* The logo mark, with a "MENU" label and an arrow, is the button while the menu is shut. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" width={192} height={192} className="h-[56px] w-[56px] object-cover lg:h-[50px] lg:w-[50px]" />
            <span className="text-[11px] font-extrabold leading-none tracking-[0.14em]">MENU</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="side-handle-arrow"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        )}
      </button>
    </>
  );
}
