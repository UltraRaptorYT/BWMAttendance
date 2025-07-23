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

export async function POST(request: Request) {
  const body = await request.json();
  const {
    code,
    SHEET_ID,
    SHEET_NAME,
    scanned_info,
    code_column = "Code",
  } = body;

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  if (!SHEET_ID || !SHEET_NAME || !scanned_info) {
    return NextResponse.json(
      { error: "Missing SHEET_ID, SHEET_NAME, or scanned_info" },
      { status: 400 }
    );
  }

  try {
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = headerRes.data.values?.[0] || [];

    const codeColumnIndex = headers.findIndex(
      (header: string) =>
        header.toLowerCase().trim() === code_column.toLowerCase().trim()
    );

    if (codeColumnIndex === -1) {
      return NextResponse.json(
        { error: `Column "${code_column}" not found in sheet` },
        { status: 400 }
      );
    }

    const columnsToExtract = scanned_info
      .split(",")
      .map((col: string) => col.trim());

    const columnMap: Record<string, number> = {};
    headers.forEach((header: string, index: number) => {
      columnMap[header.trim()] = index;
    });

    const missingColumns = columnsToExtract.filter(
      (col: string) => !(col in columnMap)
    );
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Columns not found: ${missingColumns.join(", ")}` },
        { status: 400 }
      );
    }

    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:ZZ`,
    });

    const rows = dataRes.data.values || [];

    const matchingRows = rows.filter(
      (row) => row[codeColumnIndex]?.toString().trim() === code.trim()
    );

    if (matchingRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const results = matchingRows.map((row) => {
      const extractedData: Record<string, any> = {};

      columnsToExtract.forEach((colName: string) => {
        const columnIndex = columnMap[colName];
        extractedData[colName] = row[columnIndex] || null;
      });

      extractedData["code"] = code;

      return extractedData;
    });

    return NextResponse.json(results.length === 1 ? results[0] : results);
  } catch (err) {
    console.error("POST User Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
