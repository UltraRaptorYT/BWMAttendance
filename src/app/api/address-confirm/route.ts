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

const SHEET_ID = process.env.ADDRESS_SHEET_NAME!;
const SHEET_NAME = process.env.DONOR_SHEET_NAME || "SEND";

// Column indexes (1-based)
const COL = {
  NAME: 2, // B
  OLD_BLK: 4, // D
  OLD_STREET: 5, // E
  OLD_UNIT: 6, // F
  OLD_POSTAL: 7, // G
  CORRECT_FLAG: 8, // H

  NEW_BLK: 9, // I
  NEW_STREET: 10, // J
  NEW_UNIT: 11, // K
  NEW_POSTAL: 12, // L

  TOKEN: 3, // C  <-- store unique token here
};

// Helper to A1 notation for a single cell
function a1(col: number, row: number) {
  // col: 1=A, 2=B ...
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `${s}${row}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    // Pull a reasonable range that includes B..Q
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!B2:Q`,
    });

    const rows = res.data.values || [];

    // In this B2:Q range, TOKEN is column Q which becomes index 15 (0-based):
    // B=0 ... Q=15
    const tokenIndex = 1;
    const matchIndex = rows.findIndex(
      (r) => (r[tokenIndex] || "").trim() === token
    );
    console.log(rows[1][tokenIndex]);

    if (matchIndex === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sheetRow = matchIndex + 2; // because range starts at row 2

    const row = rows[matchIndex];

    const name = row[0] ?? null; // B
    const oldBlk = row[2] ?? ""; // D (B=0,C=1,D=2)
    const oldStreet = row[3] ?? ""; // E
    const oldUnit = row[4] ?? ""; // F
    const oldPostal = row[5] ?? ""; // G
    const h = row[6] ?? null; // H

    let newBlk = row[7] ?? "";
    let newStreet = row[8] ?? "";
    let newUnit = row[9] ?? "";
    let newPostal = row[10] ?? "";

    // If H is 1, treat new address as empty (even if sheet still had old data somehow)
    if (String(h).trim() === "1") {
      newBlk = "";
      newStreet = "";
      newUnit = "";
      newPostal = "";
    }

    return NextResponse.json({
      token,
      name,
      old: { blk: oldBlk, street: oldStreet, unit: oldUnit, postal: oldPostal },
      status: { h },
      newAddr:
        newBlk || newStreet || newUnit || newPostal
          ? { blk: newBlk, street: newStreet, unit: newUnit, postal: newPostal }
          : null,
    });
  } catch (err) {
    console.error("GET address-confirm error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token || "").trim();
  const decision = String(body.decision || "").trim(); // "correct" | "changed"
  const newAddress = body.newAddress ?? null;

  if (!token || !decision) {
    return NextResponse.json(
      { error: "Missing token/decision" },
      { status: 400 }
    );
  }
  if (decision !== "correct" && decision !== "changed") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  if (decision === "changed") {
    const { blk, street, unit, postal } = newAddress || {};
    if (!blk || !street || !unit || !postal) {
      return NextResponse.json(
        { error: "Missing new address fields" },
        { status: 400 }
      );
    }
  }

  try {
    // Find row by token (same as GET)
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!B2:Q`,
    });

    const rows = getRes.data.values || [];
    const tokenIndex = 1;
    const matchIndex = rows.findIndex(
      (r) => (r[tokenIndex] || "").trim() === token
    );

    if (matchIndex === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sheetRow = matchIndex + 2;

    if (decision === "correct") {
      // Write "1" to Column H
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            {
              range: `${SHEET_NAME}!${a1(COL.CORRECT_FLAG, sheetRow)}`, // H
              values: [[1]],
            },
            {
              range: `${SHEET_NAME}!${a1(COL.NEW_BLK, sheetRow)}:${a1(
                COL.NEW_POSTAL,
                sheetRow
              )}`, // I:L
              values: [["", "", "", ""]],
            },
          ],
        },
      });

      return NextResponse.json({ success: true, h: "1", newAddr: null });
    }

    // decision === "changed"
    const { blk, street, unit, postal } = newAddress;

    // Set H to "changed" (or leave blank if you prefer)
    // Write M-P new address
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${SHEET_NAME}!${a1(COL.CORRECT_FLAG, sheetRow)}`,
            values: [["changed"]],
          },
          {
            range: `${SHEET_NAME}!${a1(COL.NEW_BLK, sheetRow)}:${a1(
              COL.NEW_POSTAL,
              sheetRow
            )}`,
            values: [[blk, street, unit, postal]],
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      h: "changed",
      newAddr: { blk, street, unit, postal },
    });
  } catch (err) {
    console.error("POST address-confirm error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
