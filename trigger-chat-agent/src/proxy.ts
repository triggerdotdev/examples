import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "tca_uid";

/**
 * Gives every visitor an anonymous id so their chats have an owner. There's no
 * login in this example, but chats are still scoped to a user — pages can only
 * read the cookie, so it's minted here, before the request reaches them.
 *
 * (Next 16 renamed `middleware` to `proxy`; both filenames still work.)
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
