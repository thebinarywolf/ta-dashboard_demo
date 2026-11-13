import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import SignOutButton from "@/components/sign-out-button";
import { GLASS_PANEL } from "@/components/glass-card";

export default async function PendingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const message =
    profile.status === "revoked"
      ? "Your access has been revoked. Contact an admin if you believe this is a mistake."
      : "Your access request is waiting for admin approval. You'll be able to see the dashboard once approved.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#dbe8fb] via-[#eef4fd] to-white p-6">
      <div className={`${GLASS_PANEL} w-full max-w-md p-8 text-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="White Gold" width={289} height={128} className="mx-auto mb-5 h-14 w-auto rounded-lg" />
        <h1 className="text-lg font-bold text-[#0e1b3d]">
          Access pending
        </h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <p className="mt-1 text-xs text-slate-400">Signed in as {profile.email}</p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
