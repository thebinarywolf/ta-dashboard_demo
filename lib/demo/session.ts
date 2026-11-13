import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE } from "./config";

export function getDemoSessionUserId(): string | null {
  return cookies().get(DEMO_SESSION_COOKIE)?.value ?? null;
}

export function setDemoSessionCookie(userId: string) {
  cookies().set(DEMO_SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearDemoSessionCookie() {
  cookies().delete(DEMO_SESSION_COOKIE);
}
