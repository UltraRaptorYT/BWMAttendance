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
const SHEET_NAME = process.env.RSVP_SHEET_NAME || "RSVP";

// GET handler: Check existing RSVP
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
      range: `${SHEET_NAME}!C2:D`, // Check Contact Number & RSVP
    });

    const rows = res.data.values || [];
    const match = rows.find((row) => row[0]?.trim() === phone.trim());

    return NextResponse.json({ rsvp: match ? match[1] : null });
  } catch (err) {
    console.error("GET RSVP Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch RSVP" },
      { status: 500 }
    );
  }
}

// POST handler: Save or update RSVP
export async function POST(request: Request) {
  const { phone, rsvp } = await request.json();

  if (!phone || !rsvp) {
    return NextResponse.json(
      { error: "Missing phone or RSVP value" },
      { status: 400 }
    );
  }

  try {
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!C2:D`, // Contact Number and RSVP
    });

    const rows = getRes.data.values || [];
    const matchIndex = rows.findIndex((row) => row[0]?.trim() === phone.trim());

    if (matchIndex !== -1) {
      const rowNumber = matchIndex + 2; // Account for header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!D${rowNumber}`, // RSVP column
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[rsvp]],
        },
      });
    } else {
      // New entry with timestamp + phone + RSVP
      const timestamp = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Singapore",
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:D`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[timestamp, "", phone, rsvp]], // Skip name, filled by VLOOKUP
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST RSVP Error:", err);
    return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
  }
}
