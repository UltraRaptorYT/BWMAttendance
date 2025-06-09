import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const auth = req.cookies.get("auth");
  const url = req.nextUrl;

  // Only protect /admin
  if (url.pathname.startsWith("/admin")) {
    if (auth?.value === "1") return NextResponse.next();

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
