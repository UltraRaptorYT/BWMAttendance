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
    "Sheet1"
  );
  const [tempName, setTempName] = useState(sheetName);
  const [sheetId, setSheetId] = useState<string | null>(null);

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
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

  const handleScan = useCallback((detectedCodes: IDetectedBarcode[]) => {
    console.log("Scanned:", detectedCodes);
    toast.success(`Scanned: ${detectedCodes[0].rawValue}`);
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      console.error("Scanner error:", error.message);
      toast.error(`Scanner error: ${error.message}`);
    } else {
      console.error("Unknown scanner error:", error);
      toast.error(`Unknown scanner error:: ${error}`);
    }
  }, []);

  return (
    <>
      <div className="flex flex-col justify-center items-center fullHeight">
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

        <p>{sheetId}</p>

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
            scanDelay={2000}
          />
        </div>
      </div>
    </>
  );
}
