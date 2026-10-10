import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/jwt";

const PROTECTED = ["/discover", "/saved", "/movie"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

// Cheap signature check only. Pages and API routes still re-check the user against the database.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (matches(pathname, PROTECTED) && !userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (matches(pathname, GUEST_ONLY) && userId) {
    return NextResponse.redirect(new URL("/discover", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/discover/:path*", "/saved/:path*", "/movie/:path*", "/login", "/signup", "/forgot-password"],
};
