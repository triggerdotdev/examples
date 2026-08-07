import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE = "tca_uid";

/**
 * Anonymous visitor id, stored in a cookie. There's no login in this example,
 * but every chat still has an owner so the queries can scope by user — the
 * same "always have a user, never branch on logged-out" idea as a guest
 * session, minus the auth dependency.
 *
 * Read-only: Next only allows setting cookies in a Server Action or Route
 * Handler, so the id is minted in `proxy.ts` (which runs before the request
 * reaches the page) and just read here.
 */
export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export const USER_COOKIE = COOKIE;
export const newUserId = randomUUID;
