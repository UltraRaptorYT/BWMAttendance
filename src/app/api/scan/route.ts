import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  return NextResponse.json({
    message: "Scan API working perfectly!",
  });
}

export async function POST(request: Request) {
  let { phone_number, SHEET_ID, SHEET_NAME } = await request.json();

  if (!SHEET_ID) SHEET_ID = process.env.SHEET_ID;
  if (!SHEET_NAME) SHEET_NAME = process.env.ATTENDANCE_SHEET_NAME;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Step 1: Read column C to check for duplicates
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!C:C`,
    });

    const existingNumbers = (readRes.data.values || [])
      .flat()
      .map((v) => v.trim());

    if (existingNumbers.includes(phone_number.trim())) {
      return NextResponse.json({ success: false, reason: "duplicate" });
    }

    // Step 2: Append data
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
