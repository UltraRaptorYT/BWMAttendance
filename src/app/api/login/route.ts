import { NextResponse } from "next/server";
import { createAdminToken } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const accessPassword = process.env.ACCESS_PASSWORD;

  if (!accessPassword) {
    console.error("ACCESS_PASSWORD is not configured");
    return NextResponse.json(
      { success: false, error: "Server authentication is not configured" },
      { status: 500 },
    );
  }

  let password: unknown;

  try {
    ({ password } = (await req.json()) as { password?: unknown });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password !== accessPassword) {
    return NextResponse.json(
      { success: false, error: "Incorrect password" },
      { status: 401 },
    );
  }

  const token = await createAdminToken();

  const res = NextResponse.json({ success: true });

  res.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return res;
}
