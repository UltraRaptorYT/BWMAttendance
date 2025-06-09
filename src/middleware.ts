import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;

  try {
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET!); // throws if invalid/expired
      return NextResponse.next();
    }
  } catch (err) {
    console.warn("JWT verification failed:", err);
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
