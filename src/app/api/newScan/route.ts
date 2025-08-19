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

export async function POST(request: Request) {
  const body = await request.json();
  const { code, SHEET_ID, SHEET_NAME } = body;

  const sheetId = SHEET_ID || process.env.SHEET_ID;
  const sheetName = SHEET_NAME || process.env.ATTENDANCE_SHEET_NAME;

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  if (!sheetId || !sheetName) {
    return NextResponse.json(
      { error: "Missing SHEET_ID or SHEET_NAME" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Find the correct sheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
    );

    if (!sheet || !sheet.properties?.title) {
      return NextResponse.json(
        { error: `Sheet "${sheetName}" not found` },
        { status: 404 }
      );
    }

    const actualSheetName = sheet.properties.title;
    const codeColumn = "B";

    // Step 2: Read all codes using batchGet (future-safe)
    const range = `'${actualSheetName}'!${codeColumn}:${codeColumn}`;
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const codes = readRes.data.values?.flat().map((c) => c.trim()) || [];
    const codeSet = new Set(codes);

    let codeStatus = "SCANNED"

    if (codeSet.has(code.trim())) {
      codeStatus = "ALREADY SCANNED"
      // return NextResponse.json({
      //   success: false,
      //   reason: "duplicate",
      //   message: `Code ${code} has already been scanned`,
      // });
    }

    // Step 3: Append attendance
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Singapore",
    });

    const appendRange = `'${actualSheetName}'!A:C`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: appendRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[timestamp, code, codeStatus]],
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully recorded scan for code: ${code}`,
      timestamp,
    });
  } catch (err) {
    console.error("Error appending to Google Sheet:", err);
    return NextResponse.json(
      {
        error: "Failed to write to Google Sheet",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
