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
};

export type TrackerField = { key: string; label: string; type: "boolean" };

export type TrackerConfigType = {
  enabled?: boolean;
  fields?: TrackerField[];
};
