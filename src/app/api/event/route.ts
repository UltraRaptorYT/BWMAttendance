import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidAdminToken } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { QrConfig } from "@/types";

const EVENT_COLUMNS =
  "id, event_name, sheet_link, RSVP, scanned_info, db_name, rsvp_name, attendance_name, code_column, tracker_config, qr_config, created_at";

const QR_CONFIG_FIELDS = [
  "primarySource",
  "identifierSource",
  "watermarkNameSource",
  "watermarkDetailSource",
  "watermarkSuffix",
  "colorSource",
  "colorMatchValue",
  "colorMatchHex",
  "colorFallbackHex",
  "fixedQrColor",
  "colorColumn",
  "codeColumn",
  "imageColumn",
  "autoColumn",
  "manualColumn",
  "combinedColumn",
  "attendanceCodeColumn",
  "appBaseUrl",
  "title",
  "titleColor",
  "titleFont",
  "titleSize",
  "watermarkColor",
  "watermarkSize",
] as const satisfies readonly (keyof QrConfig)[];

type TrackerField = {
  key: string;
  label: string;
  type: "boolean";
};

type TrackerConfig = {
  enabled: boolean;
  fields: TrackerField[];
};

type EventRequest = {
  id?: unknown;
  event_name?: unknown;
  sheet_link?: unknown;
  RSVP?: unknown;
  scanned_info?: unknown;
  db_name?: unknown;
  rsvp_name?: unknown;
  attendance_name?: unknown;
  code_column?: unknown;
  tracker_config?: unknown;
  qr_config?: unknown;
};

type ValidEventInput = {
  event_name: string;
  sheet_link: string;
  RSVP: boolean;
  scanned_info: string | null;
  db_name: string;
  rsvp_name: string;
  attendance_name: string;
  code_column: string;
  tracker_config: TrackerConfig | null;
  qr_config?: QrConfig | null;
};

function requiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeColumnList(value: unknown) {
  if (typeof value !== "string") return null;

  const columns = value
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  return columns.length > 0 ? columns.join(",") : null;
}

function parseTrackerConfig(value: unknown): TrackerConfig | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;

  const config = value as { enabled?: unknown; fields?: unknown };
  if (typeof config.enabled !== "boolean" || !Array.isArray(config.fields)) {
    return undefined;
  }

  const fields: TrackerField[] = [];

  for (const field of config.fields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return undefined;
    }

    const candidate = field as {
      key?: unknown;
      label?: unknown;
      type?: unknown;
    };
    const key = requiredString(candidate.key);
    const label = requiredString(candidate.label);

    if (!key || !label || candidate.type !== "boolean") {
      return undefined;
    }

    fields.push({ key, label, type: "boolean" });
  }

  return { enabled: config.enabled, fields };
}

function parseQrConfig(value: unknown): QrConfig | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;

  const candidate = value as Record<string, unknown>;
  const config: Partial<QrConfig> = {};

  for (const field of QR_CONFIG_FIELDS) {
    const fieldValue = candidate[field];
    if (typeof fieldValue !== "string" || fieldValue.length > 2_000) {
      return undefined;
    }
    config[field] = fieldValue;
  }

  return config as QrConfig;
}

function validateEvent(body: EventRequest) {
  const eventName = requiredString(body.event_name);
  const sheetLink = requiredString(body.sheet_link);
  const dbName = requiredString(body.db_name);
  const attendanceName = requiredString(body.attendance_name) || "ATTENDANCE";
  const codeColumn = requiredString(body.code_column) || "Code";
  const trackerConfig = parseTrackerConfig(body.tracker_config);
  const qrConfig =
    body.qr_config === undefined ? undefined : parseQrConfig(body.qr_config);

  if (!eventName || !sheetLink || !dbName) {
    return {
      error: "Event name, sheet link, and database sheet name are required",
    } as const;
  }

  try {
    const parsedSheetLink = new URL(sheetLink);
    if (!["http:", "https:"].includes(parsedSheetLink.protocol)) {
      throw new Error("Unsupported URL protocol");
    }
  } catch {
    return { error: "Sheet link must be a valid URL" } as const;
  }

  if (typeof body.RSVP !== "boolean") {
    return { error: "RSVP must be true or false" } as const;
  }

  if (trackerConfig === undefined) {
    return { error: "Tracker configuration is invalid" } as const;
  }

  if (body.qr_config !== undefined && qrConfig === undefined) {
    return { error: "QR configuration is invalid" } as const;
  }

  const data: ValidEventInput = {
    event_name: eventName,
    sheet_link: sheetLink,
    RSVP: body.RSVP,
    scanned_info: normalizeColumnList(body.scanned_info),
    db_name: dbName,
    rsvp_name: "RSVP",
    attendance_name: attendanceName,
    code_column: codeColumn,
    tracker_config: trackerConfig,
  };

  if (body.qr_config !== undefined) {
    data.qr_config = qrConfig ?? null;
  }

  return { data } as const;
}

async function isAdminRequest() {
  const cookieStore = await cookies();
  return isValidAdminToken(cookieStore.get("auth_token")?.value);
}

async function readBody(req: Request) {
  try {
    return (await req.json()) as EventRequest;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("attendance_events")
      .select(EVENT_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ events: data });
  } catch (error) {
    console.error("Failed to load attendance events:", error);
    return NextResponse.json(
      { error: "Failed to load attendance events" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = validateEvent(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("attendance_events")
      .insert(result.data)
      .select(EVENT_COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to create attendance event:", error);
    return NextResponse.json(
      { error: "Failed to create attendance event" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = requiredString(body.id);
  if (!id) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

  const result = validateEvent(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("attendance_events")
      .update(result.data)
      .eq("id", id)
      .select(EVENT_COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error) {
    console.error("Failed to update attendance event:", error);
    return NextResponse.json(
      { error: "Failed to update attendance event" },
      { status: 500 },
    );
  }
}
