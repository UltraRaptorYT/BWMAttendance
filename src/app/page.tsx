"use client";

import { useCallback } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Menu } from "lucide-react";

export default function ScannerPage() {
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
      <div className="flex items-center fullHeight">
        <Dialog>
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
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your
                account and remove your data from our servers.
              </DialogDescription>
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
            scanDelay={2000}
          />
        </div>
      </div>
    </>
  );
}
