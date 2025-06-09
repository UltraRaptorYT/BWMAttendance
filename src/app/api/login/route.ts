import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  if (password === process.env.ACCESS_PASSWORD) {
    const res = NextResponse.json({ success: true });

    res.cookies.set("auth", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return res;
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
