"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventData, TrackerField } from "@/types";
import {
  defaultFormulaSettings,
  generateFormulas,
  indexToColumn,
  type FormulaSettings,
} from "./formulas";

const SERVICE_ACCOUNT_EMAIL =
  "bw-monastery@bw-monastery-737764.iam.gserviceaccount.com";
const EMPTY_HEADERS: string[] = [];

type SheetTab = {
  title: string;
  headers: string[];
};

type SheetInspection = {
  spreadsheet_id: string;
  spreadsheet_title: string;
  service_account_email: string;
  sheets: SheetTab[];
};

type EventWizardProps = {
  event?: EventData | null;
  onCancel: () => void;
  onSaved: (event: EventData) => void;
};

const inputClassName =
  "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600";
const selectClassName =
  "h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20";
const sectionClassName =
  "rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 sm:p-7";

function splitColumns(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

function getInitialTrackerFields(event?: EventData | null) {
  return event?.tracker_config?.fields?.map((field) => ({ ...field })) ?? [];
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Connect", "Event", "QR setup", "Finish"];

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Event setup progress">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = number === step;
        const complete = number < step;

        return (
          <li key={label} className="min-w-0">
            <div
              className={`h-1 rounded-full ${
                complete || active ? "bg-cyan-400" : "bg-slate-800"
              }`}
            />
            <div
              className={`mt-2 truncate text-xs ${
                active
                  ? "font-semibold text-cyan-300"
                  : complete
                    ? "text-slate-300"
                    : "text-slate-600"
              }`}
            >
              {number}. {label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check /> : <Clipboard />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export default function EventWizard({
  event,
  onCancel,
  onSaved,
}: EventWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    event_name: event?.event_name ?? "",
    sheet_link: event?.sheet_link ?? "",
    db_name: event?.db_name ?? "",
    attendance_name: event?.attendance_name ?? "ATTENDANCE",
    code_column: event?.code_column ?? "Code",
  });
  const [sheetInfo, setSheetInfo] = useState<SheetInspection | null>(null);
  const [selectedHeaders, setSelectedHeaders] = useState<string[]>(
    splitColumns(event?.scanned_info),
  );
  const [trackerFields, setTrackerFields] = useState<TrackerField[]>(
    getInitialTrackerFields(event),
  );
  const [formulaSettings, setFormulaSettings] = useState<FormulaSettings>(
    defaultFormulaSettings([], event?.event_name ?? ""),
  );
  const [savedEvent, setSavedEvent] = useState<EventData | null>(event ?? null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentTab = sheetInfo?.sheets.find(
    (sheet) => sheet.title === form.db_name,
  );
  const headers = currentTab?.headers ?? EMPTY_HEADERS;
  const attendanceTabExists = sheetInfo?.sheets.some(
    (sheet) => sheet.title === form.attendance_name,
  );

  const formulas = useMemo(() => {
    if (!savedEvent) return [];
    return generateFormulas({
      eventId: savedEvent.id,
      eventName: form.event_name,
      attendanceName: form.attendance_name,
      headers,
      settings: formulaSettings,
    });
  }, [savedEvent, form.event_name, form.attendance_name, headers, formulaSettings]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFormula<K extends keyof FormulaSettings>(
    key: K,
    value: FormulaSettings[K],
  ) {
    setFormulaSettings((current) => ({ ...current, [key]: value }));
  }

  function chooseDatabaseTab(title: string, inspection = sheetInfo) {
    const nextHeaders =
      inspection?.sheets.find((sheet) => sheet.title === title)?.headers ?? [];
    const existingSelection = selectedHeaders.filter((header) =>
      nextHeaders.includes(header),
    );
    const sensibleDefaults = nextHeaders
      .filter(
        (header) =>
          !/^(colour|color|code|imageurl|auto|manual|combined)$/i.test(header),
      )
      .slice(0, 3);

    updateForm("db_name", title);
    setSelectedHeaders(
      existingSelection.length > 0 ? existingSelection : sensibleDefaults,
    );
    setFormulaSettings(defaultFormulaSettings(nextHeaders, form.event_name));
  }

  async function connectSheet() {
    if (!form.sheet_link.trim()) {
      toast.error("Paste the Google Sheet link first");
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch("/api/admin/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_link: form.sheet_link }),
      });
      const result = (await response.json().catch(() => null)) as
        | (SheetInspection & { error?: string })
        | null;

      if (response.status === 401) {
        window.location.assign("/login?redirect=/admin");
        return;
      }
      if (!response.ok || !result) {
        throw new Error(result?.error || "Unable to connect to the sheet");
      }

      setSheetInfo(result);
      const preferredTab = result.sheets.some(
        (sheet) => sheet.title === form.db_name,
      )
        ? form.db_name
        : result.sheets.find(
            (sheet) => sheet.title.toUpperCase() !== "ATTENDANCE",
          )?.title ?? result.sheets[0]?.title ?? "";

      const preferredAttendance = result.sheets.some(
        (sheet) => sheet.title === form.attendance_name,
      )
        ? form.attendance_name
        : result.sheets.find((sheet) => /attendance/i.test(sheet.title))
            ?.title ?? "ATTENDANCE";

      setForm((current) => ({
        ...current,
        db_name: preferredTab,
        attendance_name: preferredAttendance,
      }));

      const nextHeaders =
        result.sheets.find((sheet) => sheet.title === preferredTab)?.headers ?? [];
      const existingSelection = splitColumns(event?.scanned_info).filter((header) =>
        nextHeaders.includes(header),
      );
      setSelectedHeaders(
        existingSelection.length > 0
          ? existingSelection
          : nextHeaders
              .filter(
                (header) =>
                  !/^(colour|color|code|imageurl|auto|manual|combined)$/i.test(
                    header,
                  ),
              )
              .slice(0, 3),
      );
      setFormulaSettings(defaultFormulaSettings(nextHeaders, form.event_name));
      setStep(2);
      toast.success(`Connected to ${result.spreadsheet_title}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to connect to the sheet",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  function toggleHeader(header: string) {
    setSelectedHeaders((current) =>
      current.includes(header)
        ? current.filter((item) => item !== header)
        : [...current, header],
    );
  }

  function addTrackerField() {
    setTrackerFields((current) => [
      ...current,
      { key: "", label: "", type: "boolean" },
    ]);
  }

  function updateTrackerField(
    index: number,
    key: "key" | "label",
    value: string,
  ) {
    setTrackerFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [key]: value } : field,
      ),
    );
  }

  function canContinueEventStep() {
    if (!form.event_name.trim()) {
      toast.error("Enter an event name");
      return false;
    }
    if (!form.db_name || headers.length === 0) {
      toast.error("Choose a database tab with a header row");
      return false;
    }
    if (selectedHeaders.length === 0) {
      toast.error("Select at least one item to display after scanning");
      return false;
    }
    if (
      trackerFields.some(
        (field) => !field.key.trim() || !field.label.trim(),
      )
    ) {
      toast.error("Complete or remove empty scanner questions");
      return false;
    }
    return true;
  }

  function continueToQrSetup() {
    if (!canContinueEventStep()) return;
    setFormulaSettings((current) => ({
      ...current,
      title: current.title || form.event_name,
    }));
    setStep(3);
  }

  async function saveEvent(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();

    if (
      !formulaSettings.primarySource ||
      !formulaSettings.identifierSource ||
      !formulaSettings.watermarkNameSource
    ) {
      toast.error("Choose the code and watermark source columns");
      return;
    }

    setIsSaving(true);
    try {
      const targetId = savedEvent?.id ?? event?.id;
      const response = await fetch("/api/event", {
        method: targetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          event_name: form.event_name,
          sheet_link: form.sheet_link,
          RSVP: false,
          scanned_info: selectedHeaders.join(","),
          db_name: form.db_name,
          rsvp_name: "RSVP",
          attendance_name: form.attendance_name,
          code_column: form.code_column,
          tracker_config:
            trackerFields.length > 0
              ? { enabled: true, fields: trackerFields }
              : null,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        event?: EventData;
        error?: string;
      } | null;

      if (response.status === 401) {
        window.location.assign("/login?redirect=/admin");
        return;
      }
      if (!response.ok || !result?.event) {
        throw new Error(result?.error || "Unable to save the event");
      }

      setSavedEvent(result.event);
      onSaved(result.event);
      setStep(4);
      toast.success(targetId ? "Event updated" : "Event created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save the event",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function copyAllFormulas() {
    const text = formulas
      .map((formula) => `${formula.cell}\n${formula.formula}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("All formulas copied");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            onClick={onCancel}
          >
            <ArrowLeft className="size-4" />
            All events
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {event ? "Manage event" : "Create event"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Guided Google Sheet, scanner, and QR setup.
          </p>
        </div>
        {savedEvent && (
          <a
            href={`/${savedEvent.id}`}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200 sm:flex"
          >
            Open scanner <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      <StepIndicator step={step} />

      <div className="mt-6">
        {step === 1 && (
          <section className={sectionClassName}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Step 1
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Share and connect the Google Sheet
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  In Google Sheets, press Share and add this service account as an
                  Editor. The connection check below confirms access for you.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <Label className="text-emerald-100">Service account</Label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-sm text-emerald-200">
                  {SERVICE_ACCOUNT_EMAIL}
                </code>
                <CopyButton value={SERVICE_ACCOUNT_EMAIL} label="Copy email" />
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              <Label htmlFor="sheet-link">Google Sheet link</Label>
              <Input
                id="sheet-link"
                type="url"
                className={inputClassName}
                value={form.sheet_link}
                onChange={(input) => updateForm("sheet_link", input.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={connectSheet} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileSpreadsheet />
                )}
                {isConnecting ? "Checking access..." : "Verify and load columns"}
              </Button>
            </div>
          </section>
        )}

        {step === 2 && sheetInfo && (
          <section className={sectionClassName}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Step 2 · Connected to {sheetInfo.spreadsheet_title}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Choose the event data
                </h2>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="event-name">Event name</Label>
                <Input
                  id="event-name"
                  className={inputClassName}
                  value={form.event_name}
                  onChange={(input) =>
                    updateForm("event_name", input.target.value)
                  }
                  placeholder="功德主祈福法会 2026"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="database-tab">Attendee database tab</Label>
                <select
                  id="database-tab"
                  className={selectClassName}
                  value={form.db_name}
                  onChange={(input) => chooseDatabaseTab(input.target.value)}
                >
                  {sheetInfo.sheets.map((sheet) => (
                    <option key={sheet.title} value={sheet.title}>
                      {sheet.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="attendance-tab">Attendance output tab</Label>
                <select
                  id="attendance-tab"
                  className={selectClassName}
                  value={form.attendance_name}
                  onChange={(input) =>
                    updateForm("attendance_name", input.target.value)
                  }
                >
                  {!sheetInfo.sheets.some(
                    (sheet) => sheet.title === form.attendance_name,
                  ) && (
                    <option value={form.attendance_name}>
                      {form.attendance_name} (not found)
                    </option>
                  )}
                  {sheetInfo.sheets.map((sheet) => (
                    <option key={sheet.title} value={sheet.title}>
                      {sheet.title}
                    </option>
                  ))}
                </select>
                {!attendanceTabExists && (
                  <p className="text-xs text-amber-300">
                    Create a tab named {form.attendance_name} before testing scans.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Label>Information shown after a scan</Label>
                  <p className="mt-1 text-xs text-slate-500">
                    Loaded directly from row 1 of {form.db_name}.
                  </p>
                </div>
                <code className="max-w-full overflow-x-auto rounded bg-black/30 px-2 py-1 text-xs text-cyan-200">
                  {selectedHeaders.join(",") || "Select columns below"}
                </code>
              </div>

              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-2">
                {headers.map((header, index) => {
                  const checked = selectedHeaders.includes(header);
                  return (
                    <label
                      key={`${header}-${index}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                        checked
                          ? "border-cyan-500/50 bg-cyan-500/10 text-white"
                          : "border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-cyan-400"
                        checked={checked}
                        onChange={() => toggleHeader(header)}
                      />
                      <span className="w-7 shrink-0 font-mono text-xs text-slate-600">
                        {indexToColumn(index)}
                      </span>
                      <span className="min-w-0 break-words">{header}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <details className="mt-7 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-200">
                Optional scanner questions
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                These become Yes/No prompts after a successful scan and are written
                to the attendance tab.
              </p>
              <div className="mt-4 space-y-3">
                {trackerFields.map((field, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-slate-800 p-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <Input
                      className={inputClassName}
                      value={field.key}
                      onChange={(input) =>
                        updateTrackerField(index, "key", input.target.value)
                      }
                      placeholder="Attendance column"
                      aria-label={`Question ${index + 1} sheet column`}
                    />
                    <Input
                      className={inputClassName}
                      value={field.label}
                      onChange={(input) =>
                        updateTrackerField(index, "label", input.target.value)
                      }
                      placeholder="Question shown to staff"
                      aria-label={`Question ${index + 1} label`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setTrackerFields((current) =>
                          current.filter((_, fieldIndex) => fieldIndex !== index),
                        )
                      }
                      aria-label={`Remove question ${index + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addTrackerField}>
                  <Plus /> Add question
                </Button>
              </div>
            </details>

            <div className="mt-7 flex justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft /> Back
              </Button>
              <Button type="button" onClick={continueToQrSetup}>
                Configure QR sheet <ArrowRight />
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <form onSubmit={saveEvent} className={sectionClassName}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                <WandSparkles className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Step 3
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Customize QR and attendance formulas
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  We will insert the real event UUID after saving.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <HeaderSelect
                id="primary-source"
                label="Name / primary code value"
                headers={headers}
                value={formulaSettings.primarySource}
                onChange={(value) => updateFormula("primarySource", value)}
              />
              <HeaderSelect
                id="identifier-source"
                label="Unique ID / secondary code value"
                headers={headers}
                value={formulaSettings.identifierSource}
                onChange={(value) => updateFormula("identifierSource", value)}
              />
              <HeaderSelect
                id="watermark-source"
                label="QR watermark name"
                headers={headers}
                value={formulaSettings.watermarkNameSource}
                onChange={(value) => updateFormula("watermarkNameSource", value)}
              />
              <HeaderSelect
                id="watermark-detail"
                label="Watermark count/detail (optional)"
                headers={headers}
                value={formulaSettings.watermarkDetailSource}
                allowNone
                onChange={(value) =>
                  updateFormula("watermarkDetailSource", value)
                }
              />
              {formulaSettings.watermarkDetailSource && (
                <div className="grid gap-2">
                  <Label htmlFor="watermark-suffix">Detail suffix</Label>
                  <Input
                    id="watermark-suffix"
                    className={inputClassName}
                    value={formulaSettings.watermarkSuffix}
                    onChange={(input) =>
                      updateFormula("watermarkSuffix", input.target.value)
                    }
                  />
                </div>
              )}
              <HeaderSelect
                id="color-source"
                label="Zone / colour source (optional)"
                headers={headers}
                value={formulaSettings.colorSource}
                allowNone
                onChange={(value) => updateFormula("colorSource", value)}
              />
            </div>

            {formulaSettings.colorSource ? (
              <div className="mt-6 grid gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
                <SmallInput
                  label="When value is"
                  value={formulaSettings.colorMatchValue}
                  onChange={(value) => updateFormula("colorMatchValue", value)}
                />
                <SmallInput
                  label="Use QR colour"
                  value={formulaSettings.colorMatchHex}
                  onChange={(value) => updateFormula("colorMatchHex", value)}
                />
                <SmallInput
                  label="Otherwise use"
                  value={formulaSettings.colorFallbackHex}
                  onChange={(value) => updateFormula("colorFallbackHex", value)}
                />
              </div>
            ) : (
              <div className="mt-6 max-w-xs">
                <SmallInput
                  label="Fixed QR colour"
                  value={formulaSettings.fixedQrColor}
                  onChange={(value) => updateFormula("fixedQrColor", value)}
                />
              </div>
            )}

            <div className="mt-8 border-t border-slate-800 pt-7">
              <h3 className="font-semibold text-white">QR appearance</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SmallInput
                  label="Title"
                  value={formulaSettings.title}
                  onChange={(value) => updateFormula("title", value)}
                />
                <SmallInput
                  label="Title font"
                  value={formulaSettings.titleFont}
                  onChange={(value) => updateFormula("titleFont", value)}
                />
                <SmallInput
                  label="Title size"
                  value={formulaSettings.titleSize}
                  onChange={(value) => updateFormula("titleSize", value)}
                />
                <SmallInput
                  label="Title colour"
                  value={formulaSettings.titleColor}
                  onChange={(value) => updateFormula("titleColor", value)}
                />
                <SmallInput
                  label="Watermark size"
                  value={formulaSettings.watermarkSize}
                  onChange={(value) => updateFormula("watermarkSize", value)}
                />
                <SmallInput
                  label="Watermark colour"
                  value={formulaSettings.watermarkColor}
                  onChange={(value) => updateFormula("watermarkColor", value)}
                />
              </div>
            </div>

            <details className="mt-7 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-200">
                Advanced output columns
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Defaults match the F–K layout in your example. Existing matching
                headers are detected automatically.
              </p>
              <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-4">
                {(
                  [
                    ["Colour", "colourColumn"],
                    ["Code", "codeColumn"],
                    ["ImageURL", "imageColumn"],
                    ["AUTO", "autoColumn"],
                    ["MANUAL", "manualColumn"],
                    ["COMBINED", "combinedColumn"],
                    ["Attendance code", "attendanceCodeColumn"],
                  ] as const
                ).map(([label, key]) => (
                  <SmallInput
                    key={key}
                    label={label}
                    value={formulaSettings[key]}
                    onChange={(value) => updateFormula(key, value.toUpperCase())}
                  />
                ))}
              </div>
              <div className="mt-4">
                <SmallInput
                  label="Attendance app URL"
                  value={formulaSettings.appBaseUrl}
                  onChange={(value) => updateFormula("appBaseUrl", value)}
                />
              </div>
            </details>

            <div className="mt-7 flex justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft /> Back
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : <WandSparkles />}
                {isSaving
                  ? "Saving..."
                  : savedEvent
                    ? "Save and generate formulas"
                    : "Create and generate formulas"}
              </Button>
            </div>
          </form>
        )}

        {step === 4 && savedEvent && (
          <section className={sectionClassName}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Step 4 · Saved
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Finish the Google Sheet setup
                  </h2>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    Event UUID: {savedEvent.id}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={copyAllFormulas}>
                <Clipboard /> Copy all
              </Button>
            </div>

            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">
              Clear the output ranges before pasting an array formula. For MANUAL,
              paste its header into the listed cell, then select the remaining column
              and choose <strong>Insert → Checkbox</strong>.
            </div>

            <div className="mt-6 space-y-4">
              {formulas.map((formula, index) => (
                <article
                  key={formula.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-cyan-300">
                        {index + 1}. Paste into {form.db_name}!{formula.cell}
                      </p>
                      <h3 className="mt-1 font-semibold text-white">
                        {formula.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {formula.description}
                      </p>
                    </div>
                    <CopyButton value={formula.formula} label="Copy formula" />
                  </div>
                  <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-3 text-xs leading-5 text-slate-300">
                    {formula.formula}
                  </pre>
                </article>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft /> Adjust formulas
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" asChild>
                  <a href={form.sheet_link} target="_blank" rel="noreferrer">
                    Open Google Sheet <ExternalLink />
                  </a>
                </Button>
                <Button type="button" asChild>
                  <a href={`/${savedEvent.id}`} target="_blank" rel="noreferrer">
                    Test scanner <ExternalLink />
                  </a>
                </Button>
                <Button type="button" onClick={onCancel}>
                  Done
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function HeaderSelect({
  id,
  label,
  headers,
  value,
  allowNone = false,
  onChange,
}: {
  id: string;
  label: string;
  headers: string[];
  value: string;
  allowNone?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(input) => onChange(input.target.value)}
        required={!allowNone}
      >
        {allowNone && <option value="">None</option>}
        {!allowNone && !value && <option value="">Choose a column</option>}
        {headers.map((header, index) => (
          <option key={`${header}-${index}`} value={header}>
            {indexToColumn(index)} · {header}
          </option>
        ))}
      </select>
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs text-slate-400">
        {label}
      </Label>
      <Input
        id={id}
        className={inputClassName}
        value={value}
        onChange={(input) => onChange(input.target.value)}
      />
    </div>
  );
}
