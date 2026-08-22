export type EventData = {
  id: string;
  event_name: string;
  sheet_link: string;
  RSVP: boolean;
  scanned_info: string | null;
  db_name: string;
  rsvp_name: string;
  attendance_name: string;
  created_at: string;
  code_column: string;
  tracker_config: TrackerConfigType | null;
  qr_config: QrConfig | null;
};

export type TrackerField = { key: string; label: string; type: "boolean" };

export type TrackerConfigType = {
  enabled?: boolean;
  fields?: TrackerField[];
};

export type QrConfig = {
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
  colorColumn: string;
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
