import { NextResponse } from "next/server";
import { google } from "googleapis";

// Auth setup
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = process.env.SHEET_ID!;
const SHEET_NAME = process.env.DATABASE_SHEET_NAME || "RSVP";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json(
      { error: "Missing phone number" },
      { status: 400 }
    );
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:I`, // Check Contact Number & Name
    });

    const rows = res.data.values || [];

    const match = rows.find((row) => row[4]?.trim() === phone.trim()); // Column E is index 3 (0-based)

    if (!match || !match[1]) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const refNo = match[0];
    const name = match[1];
    const matchedPhone = match[4];
    const venue = match[6];
    const zone = match[7];
    const color = match[8];

    return NextResponse.json({
      refNo,
      name,
      phone: matchedPhone,
      venue,
      zone,
      color,
    });
  } catch (err) {
    console.error("GET RSVP Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch RSVP" },
      { status: 500 }
    );
  }
}
