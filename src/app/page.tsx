"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useState, useEffect, useCallback } from "react";
import {
  Scanner as ScannerComp,
  centerText,
  IDetectedBarcode,
} from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ScannerPage() {
  const [googleSheetLink, setGoogleSheetLink] = useLocalStorage<string>(
    "googleSheetLink",
    ""
  );
  const [tempLink, setTempLink] = useState(googleSheetLink);
  const [sheetName, setSheetName] = useLocalStorage<string>(
    "googleSheetName",
    ""
  );
  const [tempName, setTempName] = useState(sheetName);
  const [sheetId, setSheetId] = useState<string>("");
  const [scannedUser, setScannedUser] = useState<null | {
    refNo: string;
    name: string;
    phone: string;
    venue: string;
    zone: string;
    color: string;
  }>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userData, setUserData] = useState<UserData[] | null>(null);

  const extractSheetId = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : "";
  };

  useEffect(() => {
    const extractedId = extractSheetId(googleSheetLink);
    setSheetId(extractedId);
    console.log("Extracted Sheet ID:", extractedId);
  }, [googleSheetLink]);

  const handleSave = () => {
    setGoogleSheetLink(tempLink);
    setSheetName(tempName);
    toast.success("Configuration saved!");
  };

  type UserData = {
    "Ref No": string;
    Name: string;
    Contact: string;
    Venue: string;
    Zone: string;
    Colour: "Red" | "Purple" | "Yellow" | "Pink";
  };

  useEffect(() => {
    const fetchOnce = async () => {
      try {
        const res = await fetch("/output.json");
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUserData(data);
        console.log(data);
      } catch (err) {
        console.error("Prefetch error:", err);
        toast.error("⚠️ Failed to preload user data.");
      }
    };

    fetchOnce();
  }, []);

  const getUserData = async (value: string) => {
    if (!userData) {
      toast.error("User data not loaded yet.");
      return null;
    }

    const match = userData.find(
      (user) => user.Contact?.trim() === value.trim()
    );

    if (!match) return null;

    return {
      refNo: match["Ref No"],
      name: match.Name,
      phone: match.Contact,
      venue: match.Venue,
      zone: match.Zone,
      color: match.Colour,
    };
  };

  // const getUserData = async (value: string) => {
  //   try {
  //     const response = await fetch(`/api/user?phone=${value}`);

  //     const result = await response.json();
  //     if (!response.ok) {
  //       throw new Error("Failed to getUserData");
  //     }
  //     return result;
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Failed to getUserData from Google Sheet.");
  //     return null;
  //   }
  // };

  const scanToSheet = useCallback(
    async (value: string) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        const [userRes, scanRes] = await Promise.all([
          getUserData(value),
          fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              SHEET_ID: sheetId,
              SHEET_NAME: sheetName,
              phone_number: value,
            }),
          }),
        ]);

        const result = await scanRes.json();

        if (!userRes) throw new Error("User not found");
        if (!scanRes.ok) throw new Error("Scan API failed");

        setScannedUser(userRes);

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
    [sheetId, sheetName, isProcessing]
  );

  const handleScan = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      const code = detectedCodes[0]?.rawValue;
      if (!code) return;
      console.log("Scanned:", code);
      scanToSheet(code);
    },
    [sheetId, sheetName]
  );

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      console.error("Scanner error:", error.message);
      toast.error(`Scanner error: ${error.message}`);
    } else {
      console.error("Unknown scanner error:", error);
      toast.error(`Unknown scanner error:: ${error}`);
    }
  }, []);

  useEffect(() => {
    if (scannedUser) {
      const timeout = setTimeout(() => setScannedUser(null), 10000);
      return () => clearTimeout(timeout);
    }
  }, [scannedUser]);

  const colorValue: Record<"Yellow" | "Purple" | "Red", string> = {
    Yellow: "FFBF00",
    Purple: "A020F0",
    Red: "FF0000",
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-center items-center fullHeight">
        <Dialog
          onOpenChange={(open) => {
            if (open) {
              setTempLink(googleSheetLink);
              setTempName(sheetName);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="fixed top-2.5 left-2.5"
              size={"icon"}
              variant={"secondary"}
            >
              <Menu />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuration</DialogTitle>
              <div className="grid w-full max-w-sm items-center gap-1.5 mt-3">
                <Label htmlFor="sheet">Google Sheet Link</Label>
                <Input
                  id="sheet"
                  type="url"
                  placeholder="Paste your Google Sheet link"
                  value={tempLink}
                  onChange={(e) => setTempLink(e.target.value)}
                />
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5 mt-3">
                <Label htmlFor="sheetName" className="mt-4">
                  Sheet Name
                </Label>
                <Input
                  id="sheetName"
                  type="text"
                  placeholder="Enter the sheet name (e.g. 'Attendance')"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                />
              </div>
              <Button
                className="mt-2"
                onClick={handleSave}
                disabled={
                  (tempLink === googleSheetLink && tempName === sheetName) ||
                  tempLink.trim() === "" ||
                  tempName.trim() === ""
                }
              >
                Save
              </Button>
            </DialogHeader>
          </DialogContent>
        </Dialog>

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
            <p>
              <strong>Ref No:</strong> {scannedUser?.refNo || ""}
            </p>
            <p>
              <strong>Name:</strong> {scannedUser?.name || ""}
            </p>
            <p>
              <strong>Phone:</strong> {scannedUser?.phone || ""}
            </p>
            <p>
              <strong>Venue:</strong> {scannedUser?.venue || ""}
            </p>
            <p>
              <strong>Zone:</strong> {scannedUser?.zone || ""}
            </p>
            <p>
              <strong>Color:</strong>{" "}
              <span
                className="font-bold"
                style={{
                  color: `#${
                    colorValue[
                      (scannedUser?.color as keyof typeof colorValue) ||
                        "ff0000"
                    ]
                  }`,
                }}
              >
                {scannedUser?.color || ""}
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
