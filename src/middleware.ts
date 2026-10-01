import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authed = await isValidSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Lewati aset statis & endpoint login/logout
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/login|api/logout|.*\\..*).*)",
  ],
};
