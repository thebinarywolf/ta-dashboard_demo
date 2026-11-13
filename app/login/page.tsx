"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSignupMessage(null);

    try {
      const res = await fetch(`/api/auth/${mode === "signin" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error ?? "Something went wrong");
        return;
      }

      if (mode === "signup" && body.needsEmailConfirmation) {
        setSignupMessage(
          "Check your email to confirm your account, then sign in. Once you've signed in, an admin still needs to approve your access."
        );
        return;
      }

      router.push(mode === "signin" ? "/dashboard" : "/pending");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#dbe8fb] via-[#eef4fd] to-white p-6">
      <div className={`${GLASS_PANEL} w-full max-w-sm p-8`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="TA Dashboard" width={289} height={128} className="mx-auto mb-5 h-14 w-auto rounded-lg" />
        <h1 className="text-center text-xl font-bold text-[#0e1b3d]">
          Talent Acquisition Dashboard
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {mode === "signin"
            ? "Sign in to your account."
            : "Create an account. An admin will need to approve access before you can see the dashboard."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="full-name" className="block text-xs font-medium text-slate-600">Full name</label>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/80 bg-white/70 px-3.5 py-2.5 text-sm backdrop-blur"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-600">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/80 bg-white/70 px-3.5 py-2.5 text-sm backdrop-blur focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-600">Password</label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/80 bg-white/70 px-3.5 py-2.5 pr-10 text-sm backdrop-blur focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-sla-breach">{error}</p>}
          {signupMessage && <p className="text-sm text-sla-ok">{signupMessage}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setSignupMessage(null);
          }}
          className="mt-4 w-full text-center text-xs text-slate-500 underline hover:text-brand-blue"
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
