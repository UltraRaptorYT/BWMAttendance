import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  return NextResponse.json({
    message: "Scan API working perfectly!",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const phone_number = body.phone_number;
  const SHEET_ID = body.SHEET_ID || process.env.SHEET_ID;
  const SHEET_NAME = body.SHEET_NAME || process.env.ATTENDANCE_SHEET_NAME;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Step 1: Read the full sheet to get rows and find duplicates
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:D`, // full rows if A:D contains data
    });

    const rows = readRes.data.values || [];
    const existingRow = rows.find(
      (row) => row[2]?.trim() === phone_number.trim()
    ); // column C

    if (existingRow) {
      return NextResponse.json({
        success: false,
        reason: "duplicate",
        user: {
          timestamp: existingRow[0] || null,
          name: existingRow[1] || null,
          phone: existingRow[2] || null,
          attended: existingRow[3] || null,
        },
      });
    }

    // Step 2: Append new attendance
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[timestamp, "", phone_number, true]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error appending to Google Sheet:", err);
    return NextResponse.json(
      { error: "Failed to write to Google Sheet" },
      { status: 500 }
    );
  }
}

