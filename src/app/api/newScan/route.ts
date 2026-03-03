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

type Body = {
  code: string;
  SHEET_ID?: string;
  SHEET_NAME?: string;

  // optional
  header_row?: number; // default 1
  code_column?: string; // header name for code (still best to identify row)
  updates?: Record<string, string>;

  tracker_only?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const sheetId = body.SHEET_ID || process.env.SHEET_ID;
  const sheetNameInput = body.SHEET_NAME || process.env.ATTENDANCE_SHEET_NAME;

  const code = String(body.code ?? "").trim();
  const headerRow = body.header_row ?? 1;
  const codeColumnName = (body.code_column ?? "Code").trim();
  const updates = body.updates ?? {};
  const trackerOnly = !!body.tracker_only;

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (!sheetId || !sheetNameInput) {
    return NextResponse.json(
      { error: "Missing SHEET_ID or SHEET_NAME" },
      { status: 400 },
    );
  }

  try {
    // 1) Resolve actual sheet name (case-insensitive)
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) =>
        s.properties?.title?.toLowerCase() === sheetNameInput.toLowerCase(),
    );
    if (!sheet?.properties?.title) {
      return NextResponse.json(
        { error: `Sheet "${sheetNameInput}" not found` },
        { status: 404 },
      );
    }
    const sheetName = sheet.properties.title;

    const norm = (s: string) => s.trim().toLowerCase();

    // 2) Read header row (we'll keep your existing header as-is)
    const headerRange = `'${sheetName}'!${headerRow}:${headerRow}`;
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: headerRange,
    });

    const headers = (headerRes.data.values?.[0] ?? []).map((h) =>
      String(h ?? "").trim(),
    );

    // Find code column index by header name
    const codeIdx = headers.findIndex((h) => norm(h) === norm(codeColumnName));
    if (codeIdx < 0) {
      return NextResponse.json(
        { error: `Code column not found in header: "${codeColumnName}"` },
        { status: 400 },
      );
    }

    // If sheet has no header (rare), you can still handle it, but let's keep strict.
    // Ensure update columns exist in header (append missing headers to the right)
    const updateCols = Object.keys(updates).filter(Boolean);
    const missingUpdateCols = updateCols.filter(
      (c) => !headers.some((h) => norm(h) === norm(c)),
    );

    let finalHeaders = headers.slice();
    if (missingUpdateCols.length > 0) {
      finalHeaders = finalHeaders.concat(missingUpdateCols);

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: headerRange,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [finalHeaders] },
      });
    }

    const headerIndex0 = (name: string) =>
      finalHeaders.findIndex((h) => norm(h) === norm(name));

    // 3) Find row by code (read just the code column from data rows)
    const codeColLetter = indexToCol(codeIdx + 1);
    const firstDataRow = headerRow + 1;

    const codeColRange = `'${sheetName}'!${codeColLetter}${firstDataRow}:${codeColLetter}`;
    const codeColRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: codeColRange,
    });

    const colValues = (codeColRes.data.values ?? []).map((r) =>
      String(r?.[0] ?? "").trim(),
    );

    const foundIdx0 = colValues.findIndex((v) => v === code);
    const isDuplicate = foundIdx0 >= 0;

    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Singapore",
    });

    // --- IMPORTANT: we do NOT assume any "Status" header exists ---
    // We will treat "timestamp" and "code" as fixed columns:
    //   Column 1 = timestamp
    //   Column 2 = code
    //   Column 3 = status (whatever header it has, we don't care)
    //
    // This matches your requirement: "just the 3rd column".

    const COL_TIMESTAMP_1 = 1; // A
    const COL_CODE_2 = 2; // B
    const COL_STATUS_3 = 3; // C

    // Helper: build a single-cell range by column number + row
    const cell = (colNum1: number, rowNum1: number) =>
      `'${sheetName}'!${indexToCol(colNum1)}${rowNum1}`;

    // 4) If row exists: update ONLY updates (and optionally never touch status)
    if (isDuplicate) {
      const targetRow = firstDataRow + foundIdx0;

      const cellWrites: { range: string; values: string[][] }[] = [];

      // Only update timestamp/status if NOT tracker-only
      if (!trackerOnly) {
        // Timestamp in column A
        cellWrites.push({
          range: cell(COL_TIMESTAMP_1, targetRow),
          values: [[timestamp]],
        });

        // Status in column C: do NOT flip to "ALREADY SCANNED" on tracker updates.
        // If someone is scanning again (not tracker-only), you can choose what to write.
        // If you want to preserve your old behavior on rescan:
        cellWrites.push({
          range: cell(COL_STATUS_3, targetRow),
          values: [["ALREADY SCANNED"]],
        });
      }

      // Apply updates
      for (const [k, v] of Object.entries(updates)) {
        const idx = headerIndex0(k);
        if (idx < 0) continue;
        cellWrites.push({
          range: cell(idx + 1, targetRow),
          values: [[String(v)]],
        });
      }

      if (cellWrites.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: cellWrites },
        });
      }

      return NextResponse.json({
        success: false,
        duplicate: true,
        message: trackerOnly
          ? `Updated tracker fields for code: ${code}`
          : `Code ${code} has already been scanned (updated row)`,
        timestamp,
      });
    }

    const rowLen = finalHeaders.length;
    const row = new Array(rowLen).fill("");

    // Column A,B,C fixed
    row[COL_TIMESTAMP_1 - 1] = timestamp;
    row[COL_CODE_2 - 1] = code;
    row[COL_STATUS_3 - 1] = "SCANNED";

    // Put updates
    for (const [k, v] of Object.entries(updates)) {
      const idx = headerIndex0(k);
      if (idx < 0) continue;
      row[idx] = String(v);
    }

    const appendRange = `'${sheetName}'!A:${indexToCol(rowLen)}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: appendRange,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return NextResponse.json({
      success: true,
      duplicate: false,
      message: `Successfully recorded scan for code: ${code}`,
      timestamp,
    });
  } catch (err) {
    console.error("Error writing to Google Sheet:", err);
    return NextResponse.json(
      {
        error: "Failed to write to Google Sheet",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function indexToCol(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
