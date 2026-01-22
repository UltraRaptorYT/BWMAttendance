import type { Metadata } from "next";
import supabase from "@/lib/supabase";
import CustomScannerClient from "./CustomScannerClient";

type PageProps = {
  params: Promise<{ event_id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { event_id } = await params;

  const { data } = await supabase
    .from("attendance_events")
    .select("event_name")
    .eq("id", event_id)
    .single();

  const title = data?.event_name
    ? `${data?.event_name} - BWM Attendance`
    : "BWM Attendance";

  return {
    title,
    openGraph: { title },
    twitter: { title },
  };
}

export default function Page() {
  return <CustomScannerClient />;
}
