import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidAdminToken } from "@/lib/admin-auth";
import { extractSheetId } from "@/lib/utils";

export const runtime = "nodejs";

const SERVICE_ACCOUNT_EMAIL =
  "bw-monastery@bw-monastery-737764.iam.gserviceaccount.com";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function getGoogleStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; response?: { status?: unknown } };
  const value = candidate.response?.status ?? candidate.code;
  const status = Number(value);
  return Number.isFinite(status) ? status : null;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get("auth_token")?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sheetLink = "";
  try {
    const body = (await req.json()) as { sheet_link?: unknown };
    sheetLink = typeof body.sheet_link === "string" ? body.sheet_link.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const spreadsheetId = extractSheetId(sheetLink);
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Paste a valid Google Sheets link" },
      { status: 400 },
    );
  }

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties(title),sheets(properties(index,title))",
    });

    const tabs = (spreadsheet.data.sheets ?? [])
      .map((sheet) => ({
        index: sheet.properties?.index ?? 0,
        title: sheet.properties?.title?.trim() ?? "",
      }))
      .filter((sheet) => sheet.title)
      .sort((a, b) => a.index - b.index);

    const headerResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabs.map((tab) => `${quoteSheetName(tab.title)}!1:1`),
      majorDimension: "ROWS",
    });

    const discoveredSheets = tabs.map((tab, index) => ({
      title: tab.title,
      headers: (headerResponse.data.valueRanges?.[index]?.values?.[0] ?? [])
        .map((header) => String(header ?? "").trim())
        .filter(Boolean),
    }));

    return NextResponse.json({
      spreadsheet_id: spreadsheetId,
      spreadsheet_title: spreadsheet.data.properties?.title ?? "Google Sheet",
      service_account_email: SERVICE_ACCOUNT_EMAIL,
      sheets: discoveredSheets,
    });
  } catch (error) {
    const status = getGoogleStatus(error);
    console.error("Failed to inspect Google Sheet:", error);

    if (status === 403 || status === 404) {
      return NextResponse.json(
        {
          error: `Share the sheet with ${SERVICE_ACCOUNT_EMAIL} as Editor, then try again.`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Unable to read this Google Sheet" },
      { status: 500 },
    );
  }
}
