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
    // Step 1: Get the spreadsheet metadata to handle special characters in sheet names
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    // Find the sheet by name (case-insensitive)
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

    const codeColumn = "B"; // Adjust based on your actual column

    let range = `'${actualSheetName}'!${codeColumn}:${codeColumn}`;
    let readRes;

    try {
      readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
      });
    } catch (e) {
      // If quoted name fails, try without quotes
      console.log(e);
      range = `${actualSheetName}!${codeColumn}:${codeColumn}`;
      readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
      });
    }

    const codes = readRes.data.values?.flat() || [];
    const existingIndex = codes.findIndex(
      (cell) => cell?.trim() === code.trim()
    );

    if (existingIndex !== -1) {
      return NextResponse.json({
        success: false,
        reason: "duplicate",
        message: `Code ${code} has already been scanned`,
      });
    }

    // Step 3: Append new attendance record
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Singapore",
    });

    // Adjust the append range and values based on your sheet structure
    range = `'${actualSheetName}'!A:C`;

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[timestamp, code, true]], // Adjust columns as needed
        },
      });
    } catch (e) {
      console.log(e);
      range = `${actualSheetName}!A:C`;
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[timestamp, code, true]],
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recorded scan for code: ${code}`,
      timestamp: timestamp,
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
