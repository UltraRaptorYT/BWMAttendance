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
import { extractSheetId, normalizeHex, HEX_TO_COLOR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SwitchCamera } from "lucide-react";

type CameraDevice = {
  deviceId: string;
  label: string;
};

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

  // --- Camera state ---
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const selectedCamera = cameras[cameraIndex];

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

  // Fetch available cameras (best effort: prompts permission if needed)
  useEffect(() => {
    let cancelled = false;

    const loadCameras = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) return;

      try {
        // Some browsers won't reveal labels until permission is granted.
        // We try to get permission once (video only) to populate labels.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // If user denies, we can still enumerate devices but labels may be blank.
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, idx) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${idx + 1}`,
          }));

        if (!cancelled) {
          setCameras(vids);
          setCameraIndex(pickBackCameraIndex(vids));
        }
      } catch (e) {
        console.error(e);
        toast.error("Could not load cameras.");
      }
    };

    loadCameras();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchCamera = useCallback(() => {
    setCameraIndex((prev) => {
      if (cameras.length <= 1) return prev;
      return (prev + 1) % cameras.length;
    });
  }, [cameras.length]);

  const getUserData = async (code: string) => {
    try {
      if (!eventData) {
        throw new Error("Event data not loaded");
      }

      console.log("Fetching user data for code:", code);
      const eventBody = {
        code: code,
        SHEET_ID: extractSheetId(eventData.sheet_link || ""),
        SHEET_NAME: eventData.db_name || "RSVP",
        scanned_info: eventData.scanned_info || "Name,Mobile Number",
        code_column: eventData.code_column || "Code",
      };

      const response = await fetch("/api/newUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
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

        if (userRes) {
          setScannedUser(userRes);
        } else {
          setScannedUser(null);
        }

        if (!result.success && result.duplicate) {
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
      if (code.split("|").slice(-1)[0] != event_id) {
        toast.error("Invalid QR Code");
        return;
      }
      scanToSheet(code);
    },
    [scanToSheet, isProcessing, event_id]
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

  function pickBackCameraIndex(vids: CameraDevice[]) {
    const keywords = ["back", "rear", "environment"];
    const idx = vids.findIndex((v) =>
      keywords.some((k) => v.label.toLowerCase().includes(k))
    );
    return idx >= 0 ? idx : 0;
  }

  const scannedInfoColumns =
    eventData?.scanned_info?.split(",").map((col) => col.trim()) || [];

  return (
    <div className="flex flex-col md:flex-row justify-center items-center fullHeight">
      <div className="w-4/5 mx-auto aspect-square max-w-3xl relative">
        {/* Small switch camera button */}
        {cameras.length > 1 && (
          <div className="absolute z-10 top-3 right-3 flex items-center gap-2">
            <Button type="button" onClick={switchCamera} size={"icon"}>
              <SwitchCamera />
            </Button>
            {/* <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
              {selectedCamera?.label}
            </span> */}
          </div>
        )}
        {cameras.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Initializing camera...
          </div>
        ) : (
          <ScannerComp
            key={selectedCamera?.deviceId ?? "default-camera"}
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
            constraints={{ deviceId: { ideal: selectedCamera!.deviceId } }}
          />
        )}
      </div>

      <div className="p-5 w-full md:w-2/5">
        {isProcessing && (
          <div className="absolute top-5 -translate-x-1/2 left-1/2 md:left-0 md:translate-none text-sm max-w-md md:relative md:top-0 text-center text-gray-500 animate-pulse">
            ⏳ Processing scan...
          </div>
        )}
        <div className="bg-white shadow-md rounded-lg p-4 w-full max-w-md text-lg">
          <h3 className="font-bold text-xl mb-2 text-center">
            {eventData?.event_name} User Info
          </h3>

          {scannedInfoColumns.map((columnName, i) => {
            const value = scannedUser?.[columnName] || "";

            if (columnName.toLowerCase() === "color" && value) {
              const normalized = normalizeHex(value);
              const mappedName = HEX_TO_COLOR[normalized];

              let displayName = mappedName || value;
              let colorHex = mappedName ? normalized : value;

              if (!mappedName && !value.startsWith("#")) {
                displayName =
                  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                colorHex = value;
              }

              return (
                <p key={`color-${i}`} className="mb-1">
                  <strong>{columnName}:</strong>{" "}
                  <span className="font-bold" style={{ color: colorHex }}>
                    {displayName}
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
