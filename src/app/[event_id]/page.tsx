import type { Metadata } from "next";
import supabase from "@/lib/supabase";
import CustomScannerClient from "./CustomScannerClient";

export async function generateMetadata({
  params,
}: {
  params: { event_id: string };
}): Promise<Metadata> {
  const { data } = await supabase
    .from("attendance_events")
    .select("event_name")
    .eq("id", params.event_id)
    .single();

  const title = data?.event_name ? `${data.event_name} - BWM Attendance` : "BWM Attendance";
  return { title };
}

export default function Page() {
  return <CustomScannerClient />;
}
