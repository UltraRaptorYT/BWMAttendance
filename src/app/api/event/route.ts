import { NextResponse } from "next/server";

// export async function POST(req: Request) {
export async function POST() {
  return NextResponse.json({
    message: "Hi",
  });
}
