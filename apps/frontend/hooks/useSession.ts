import { useSyncExternalStore } from "react";
import { getSession, hydrateSession, subscribeToSession, type Session } from "@/lib/session";

function getClientSnapshot(): Session | null {
  return hydrateSession();
}

function getServerSnapshot(): Session | null {
  return null;
}

/** The current authenticated session, re-rendering on sign-in/out and token refresh. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeToSession, getClientSnapshot, getServerSnapshot);
}

export { getSession };
