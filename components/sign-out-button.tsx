"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={signOut}
      className="text-sm text-slate-500 underline hover:text-slate-700"
    >
      Sign out
    </button>
  );
}
