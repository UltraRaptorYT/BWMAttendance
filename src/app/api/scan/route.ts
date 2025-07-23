import { NextResponse } from "next/server";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "ping") {
    return await pingGoogleSheets();
  }

  return NextResponse.json({
    message: "Scan API working perfectly!",
  });
}

async function pingGoogleSheets() {
  const SHEET_ID = process.env.SHEET_ID;
  const SHEET_NAME = process.env.ATTENDANCE_SHEET_NAME;

  if (!SHEET_ID || !SHEET_NAME) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing SHEET_ID or SHEET_NAME environment variables",
      },
      { status: 500 }
    );
  }

  try {
    const startTime = Date.now();

    // Simple read operation to test connectivity and latency
    await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:A1`, // Just read one cell
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    return NextResponse.json({
      success: true,
      latency_ms: latency,
      status: latency < 1000 ? "good" : latency < 3000 ? "moderate" : "slow",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Ping failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to ping Google Sheets API",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const phone_number = body.phone_number;
  const SHEET_ID = body.SHEET_ID || process.env.SHEET_ID;
  const SHEET_NAME = body.SHEET_NAME || process.env.ATTENDANCE_SHEET_NAME;
  try {
    // Step 1: Read the full sheet to get rows and find duplicates
    // Step 1: Read only the phone number column (column C)
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!D:D`, // Only phone number column
    });

    const phoneNumbers = readRes.data.values?.flat() || [];
    const existingIndex = phoneNumbers.findIndex(
      (cell) => cell?.trim() === phone_number.trim()
    );

    if (existingIndex !== -1) {
      return NextResponse.json({
        success: false,
        reason: "duplicate",
      });
    }

    // Step 2: Append new attendance
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Singapore",
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[timestamp, "", "", phone_number, true]],
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
