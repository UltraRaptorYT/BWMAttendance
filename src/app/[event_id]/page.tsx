"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import supabase from "@/lib/supabase";
import { notFound } from "next/navigation";
import { EventData } from "@/types";
import {
  Scanner as ScannerComp,
  centerText,
  IDetectedBarcode,
} from "@yudiel/react-qr-scanner";
import { toast } from "sonner";
import { extractSheetId } from "@/lib/utils";

export default function CustomScannerPage() {
  const { event_id } = useParams();
  const [eventData, setEventData] = useState<EventData>();
  const [eventStatus, setEventStatus] = useState<
    "loading" | "found" | "not-found"
  >("loading");
  const [scannedUser, setScannedUser] = useState<Record<string, string> | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const checkEventExists = async () => {
      const { data, error } = await supabase
        .from("attendance_events")
        .select("*")
        .eq("id", event_id)
        .single();

      if (error || !data) {
        setEventStatus("not-found");
      } else {
        setEventStatus("found");
        setEventData(data as EventData);
      }
    };

    if (event_id) {
      checkEventExists();
    }
  }, [event_id]);

  const getUserData = async (code: string) => {
    try {
      if (!eventData) {
        throw new Error("Event data not loaded");
      }

      console.log("Fetching user data for code:", code);
      console.log("Event data:", {
        SHEET_ID: extractSheetId(eventData.sheet_link || ""),
        SHEET_NAME: eventData.db_name || "RSVP",
        scanned_info: eventData.scanned_info,
      });

      const response = await fetch("/api/newUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          SHEET_ID: extractSheetId(eventData.sheet_link || ""),
          SHEET_NAME: eventData.db_name || "RSVP",
          scanned_info: eventData.scanned_info || "Name,Mobile Number",
          code_column: "Code",
        }),
      });
      console.log({
        code: code,
        SHEET_ID: extractSheetId(eventData.sheet_link || ""),
        SHEET_NAME: eventData.db_name || "RSVP",
        scanned_info: eventData.scanned_info || "Name,Mobile Number",
        code_column: "Code",
      });
      const result = await response.json();
      console.log("User data response:", result);

      if (!response.ok) {
        console.error("User fetch failed:", result);
        throw new Error(result.error || "API error");
      }

      return result;
    } catch (err) {
      console.error(err);
      toast.error("User not found locally or via API.");
      return null;
    }
  };

  const scanToSheet = useCallback(
    async (value: string) => {
      if (isProcessing || !eventData) return;
      setIsProcessing(true);

      try {
        const userRes = await getUserData(value);

        const scanRes = await fetch("/api/newScan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            SHEET_ID: extractSheetId(eventData.sheet_link || ""),
            SHEET_NAME: eventData.attendance_name || "ATTENDANCE",
            code: value,
          }),
        });

        const result = await scanRes.json();

        if (!scanRes.ok) throw new Error("Scan API failed");
        console.log(result);
        console.log(userRes, "I");

        if (userRes) {
          setScannedUser(userRes);
          console.log("User found:", userRes);
        } else {
          setScannedUser(null);
          console.log("User not found in database, but scan recorded");
        }

        if (result.success === false && result.reason === "duplicate") {
          toast.warning(`⚠️ Already scanned: ${value}`);
        } else {
          toast.success(`✅ Scan ${value} recorded!`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Scan failed.");
      } finally {
        setIsProcessing(false);
      }
    },
    [eventData, isProcessing]
  );

  const handleScan = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      const code = detectedCodes[0]?.rawValue;
      if (!code || isProcessing) return;
      console.log("Scanned:", code);
      if (code.split("|").slice(-1)[0] != event_id) {
        toast.error("Invalid QR Code");
        return;
      }
      scanToSheet(code);
    },
    [scanToSheet, isProcessing]
  );

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      console.error("Scanner error:", error.message);
      toast.error(`Scanner error: ${error.message}`);
    } else {
      console.error("Unknown scanner error:", error);
      toast.error(`Unknown scanner error: ${error}`);
    }
  }, []);

  useEffect(() => {
    if (scannedUser) {
      const timeout = setTimeout(() => setScannedUser(null), 10000);
      return () => clearTimeout(timeout);
    }
  }, [scannedUser]);

  if (eventStatus === "loading") {
    return (
      <div className="flex flex-col md:flex-row justify-center items-center fullHeight">
        Loading...
      </div>
    );
  } else if (eventStatus === "not-found") {
    return notFound();
  }

  // Parse the scanned_info to get column names
  const scannedInfoColumns =
    eventData?.scanned_info?.split(",").map((col) => col.trim()) || [];

  return (
    <div className="flex flex-col md:flex-row justify-center items-center fullHeight">
      <div className="w-4/5 mx-auto aspect-square max-w-3xl">
        <ScannerComp
          formats={[
            "qr_code",
            "micro_qr_code",
            "rm_qr_code",
            "maxi_code",
            "pdf417",
            "aztec",
            "data_matrix",
            "matrix_codes",
            "dx_film_edge",
            "databar",
            "databar_expanded",
            "codabar",
            "code_39",
            "code_93",
            "code_128",
            "ean_8",
            "ean_13",
            "itf",
            "linear_codes",
            "upc_a",
            "upc_e",
          ]}
          onScan={handleScan}
          onError={handleError}
          components={{
            onOff: false,
            torch: true,
            zoom: true,
            finder: true,
            tracker: centerText,
          }}
          allowMultiple={false}
          scanDelay={0}
        />
      </div>

      <div className="p-5 w-full md:w-2/5">
        {isProcessing && (
          <div className="absolute top-12 -translate-x-1/2 left-1/2 md:left-0 md:translate-none text-sm max-w-md md:relative md:top-0 text-center text-gray-500 animate-pulse">
            ⏳ Processing scan...
          </div>
        )}
        <div className="bg-white shadow-md rounded-lg p-4 w-full max-w-md text-lg">
          <h3 className="font-bold text-xl mb-2">User Info</h3>
          {scannedInfoColumns.map((columnName, i) => {
            console.log(columnName, scannedUser);
            const value = scannedUser?.[columnName] || "";

            // Special handling for color field if needed
            if (columnName.toLowerCase() === "color" && value) {
              return (
                <p key={"eventData" + i} className="mb-1">
                  <strong>{columnName}:</strong>{" "}
                  <span
                    className="font-bold"
                    style={{
                      color: value.startsWith("#") ? value : `#${value}`,
                    }}
                  >
                    {value}
                  </span>
                </p>
              );
            }

            return (
              <p key={"eventData" + i} className="mb-1">
                <strong>{columnName}:</strong> {value}
              </p>
            );
          })}
          {!scannedUser && (
            <p className="text-gray-500 italic">No user scanned yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
