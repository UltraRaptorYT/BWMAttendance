export type FormulaSettings = {
  primarySource: string;
  identifierSource: string;
  watermarkNameSource: string;
  watermarkDetailSource: string;
  watermarkSuffix: string;
  colorSource: string;
  colorMatchValue: string;
  colorMatchHex: string;
  colorFallbackHex: string;
  fixedQrColor: string;
  colourColumn: string;
  codeColumn: string;
  imageColumn: string;
  autoColumn: string;
  manualColumn: string;
  combinedColumn: string;
  attendanceCodeColumn: string;
  appBaseUrl: string;
  title: string;
  titleColor: string;
  titleFont: string;
  titleSize: string;
  watermarkColor: string;
  watermarkSize: string;
};

export type GeneratedFormula = {
  id: "colour" | "code" | "image" | "auto" | "manual" | "combined";
  title: string;
  cell: string;
  formula: string;
  description: string;
};

export function indexToColumn(index: number) {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function headerColumn(headers: string[], names: string[], fallback: string) {
  const normalizedNames = names.map((name) => name.toLowerCase());
  const index = headers.findIndex((header) =>
    normalizedNames.includes(header.trim().toLowerCase()),
  );
  return index >= 0 ? indexToColumn(index) : fallback;
}

function findHeader(headers: string[], pattern: RegExp, fallback = "") {
  return headers.find((header) => pattern.test(header)) ?? fallback;
}

export function defaultFormulaSettings(
  headers: string[],
  eventName = "",
): FormulaSettings {
  const primarySource =
    findHeader(headers, /(^|\b)(name|姓名|student|participant)/i) ||
    headers[0] ||
    "";
  const identifierSource =
    findHeader(headers, /(mobile|phone|contact|编号|identity|order|id)/i) ||
    headers.find((header) => header !== primarySource) ||
    primarySource;

  return {
    primarySource,
    identifierSource,
    watermarkNameSource: primarySource,
    watermarkDetailSource: findHeader(
      headers,
      /(seat|ticket|guest|pax|attend|入场|人数|位)/i,
    ),
    watermarkSuffix: "位入场",
    colorSource: findHeader(headers, /(zone|区域|分区|区域代码)/i),
    colorMatchValue: "A",
    colorMatchHex: "FA003F",
    colorFallbackHex: "000000",
    fixedQrColor: "000000",
    colourColumn: headerColumn(headers, ["Colour", "Color"], "F"),
    codeColumn: headerColumn(headers, ["Code"], "G"),
    imageColumn: headerColumn(headers, ["ImageURL", "Image URL"], "H"),
    autoColumn: headerColumn(headers, ["AUTO"], "I"),
    manualColumn: headerColumn(headers, ["MANUAL"], "J"),
    combinedColumn: headerColumn(headers, ["COMBINED"], "K"),
    attendanceCodeColumn: "B",
    appBaseUrl: "https://bwm-attendance.vercel.app",
    title: eventName,
    titleColor: "000000",
    titleFont: "Arial",
    titleSize: "24",
    watermarkColor: "000000",
    watermarkSize: "18",
  };
}

function sourceColumn(headers: string[], header: string) {
  const index = headers.indexOf(header);
  return index >= 0 ? indexToColumn(index) : "";
}

function sheetText(value: string) {
  return value.replace(/"/g, '""');
}

function sheetName(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function cleanHex(value: string, fallback: string) {
  const normalized = value.replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{3}([0-9A-F]{3})?$/.test(normalized)
    ? normalized
    : fallback;
}

function cleanColumn(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{1,2}$/.test(normalized) ? normalized : fallback;
}

export function generateFormulas({
  eventId,
  eventName,
  attendanceName,
  headers,
  settings,
}: {
  eventId: string;
  eventName: string;
  attendanceName: string;
  headers: string[];
  settings: FormulaSettings;
}) {
  const primary = sourceColumn(headers, settings.primarySource);
  const identifier = sourceColumn(headers, settings.identifierSource);
  const watermarkName = sourceColumn(headers, settings.watermarkNameSource);
  const watermarkDetail = sourceColumn(
    headers,
    settings.watermarkDetailSource,
  );
  const colorSource = sourceColumn(headers, settings.colorSource);

  const colourColumn = cleanColumn(settings.colourColumn, "F");
  const codeColumn = cleanColumn(settings.codeColumn, "G");
  const imageColumn = cleanColumn(settings.imageColumn, "H");
  const autoColumn = cleanColumn(settings.autoColumn, "I");
  const manualColumn = cleanColumn(settings.manualColumn, "J");
  const combinedColumn = cleanColumn(settings.combinedColumn, "K");
  const attendanceCodeColumn = cleanColumn(
    settings.attendanceCodeColumn,
    "B",
  );

  const formulas: GeneratedFormula[] = [];

  if (colorSource) {
    formulas.push({
      id: "colour",
      title: "Colour mapping",
      cell: `${colourColumn}1`,
      description: `Maps ${settings.colorSource} to QR colours. Change the match and fallback colours above as needed.`,
      formula: `={"Colour";ARRAYFORMULA(IF(${colorSource}2:${colorSource}="","",IF(${colorSource}2:${colorSource}="${sheetText(settings.colorMatchValue)}","${cleanHex(settings.colorMatchHex, "FA003F")}","${cleanHex(settings.colorFallbackHex, "000000")}")))}`,
    });
  }

  if (primary && identifier) {
    formulas.push({
      id: "code",
      title: "Event QR code value",
      cell: `${codeColumn}1`,
      description:
        "The final segment is this event's UUID, which lets the scanner reject QR codes from another event.",
      formula: `={"Code";ARRAYFORMULA(IF(${identifier}2:${identifier}="","",${primary}2:${primary}&"|"&${identifier}2:${identifier}&"|"&"${eventId}"))}`,
    });
  }

  if (watermarkName) {
    const baseUrl = settings.appBaseUrl.replace(/\/$/, "");
    const colorExpression = colorSource
      ? `${colourColumn}2:${colourColumn}`
      : `"${cleanHex(settings.fixedQrColor, "000000")}"`;
    const detailExpression = watermarkDetail
      ? `&"%20("&ENCODEURL(${watermarkDetail}2:${watermarkDetail})&"%20${sheetText(settings.watermarkSuffix)})"`
      : "";
    const title = encodeURIComponent(settings.title || eventName);
    const staticParams =
      `&wmcolor=${cleanHex(settings.watermarkColor, "000000")}` +
      `&wmsize=${encodeURIComponent(settings.watermarkSize || "18")}` +
      `&title=${title}` +
      `&titlecolor=${cleanHex(settings.titleColor, "000000")}` +
      `&titlefont=${encodeURIComponent(settings.titleFont || "Arial")}` +
      `&titlebold=true` +
      `&titlesize=${encodeURIComponent(settings.titleSize || "26")}`;

    formulas.push({
      id: "image",
      title: "QR image URL",
      cell: `${imageColumn}1`,
      description:
        "Creates the QR image link with an optional colour, attendee watermark, and event title.",
      formula: `={"ImageURL";ARRAYFORMULA(IF(${codeColumn}2:${codeColumn}="","",HYPERLINK("${sheetText(baseUrl)}/api/qrcode?data="&ENCODEURL(${codeColumn}2:${codeColumn})&"&color="&${colorExpression}&"&wm="&ENCODEURL(${watermarkName}2:${watermarkName})${detailExpression}&"${staticParams}")))}`,
    });
  }

  formulas.push(
    {
      id: "auto",
      title: "Automatic attendance status",
      cell: `${autoColumn}1`,
      description: `Checks whether each generated code appears in ${attendanceName || "ATTENDANCE"} column ${attendanceCodeColumn}.`,
      formula: `={"AUTO";ARRAYFORMULA(IF(${codeColumn}2:${codeColumn}="","",COUNTIF(${sheetName(attendanceName || "ATTENDANCE")}!$${attendanceCodeColumn}:$${attendanceCodeColumn},${codeColumn}2:${codeColumn})>0))}`,
    },
    {
      id: "manual",
      title: "Manual override",
      cell: `${manualColumn}1`,
      description: `Paste the header, then select ${manualColumn}2:${manualColumn} and choose Insert → Checkbox in Google Sheets.`,
      formula: '={"MANUAL"}',
    },
    {
      id: "combined",
      title: "Combined attendance status",
      cell: `${combinedColumn}1`,
      description: "Returns TRUE when either automatic attendance or the manual override is TRUE.",
      formula: `={"COMBINED";ARRAYFORMULA(IF(${autoColumn}2:${autoColumn}="","",${autoColumn}2:${autoColumn}+${manualColumn}2:${manualColumn}>0))}`,
    },
  );

  return formulas;
}
