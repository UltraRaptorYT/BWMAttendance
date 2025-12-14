"use client";

import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DonorData = {
  name: string | null;
  token: string;
  old: { blk: string; street: string; unit: string; postal: string };
  status: { h: string | null }; // Column H
  newAddr?: {
    blk: string;
    street: string;
    unit: string;
    postal: string;
  } | null; // M-P
};

export default function ConfirmAddressPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [data, setData] = useState<DonorData | null>(null);

  const [decision, setDecision] = useState<"correct" | "changed" | null>(null);

  const [newBlk, setNewBlk] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPostal, setNewPostal] = useState("");

  const showNew = decision === "changed";

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(
          `/api/address-confirm?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
          }
        );

        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch donor data");

        const json = (await res.json()) as DonorData;
        setData(json);

        // if user already submitted before, optionally pre-fill UI
        // (you can tweak this logic as you like)
        if (json.status?.h === "1") {
          setDecision("correct");
        } else if (json.status?.h && json.status.h !== "1") {
          // e.g. "changed"
          setDecision("changed");
          if (json.newAddr) {
            setNewBlk(json.newAddr.blk || "");
            setNewStreet(json.newAddr.street || "");
            setNewUnit(json.newAddr.unit || "");
            setNewPostal(json.newAddr.postal || "");
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (token) run();
  }, [token]);

  const canSubmit = useMemo(() => {
    if (!decision) return false;
    if (decision === "correct") return true;

    // changed: require all new fields
    return (
      newBlk.trim() && newStreet.trim() && newUnit.trim() && newPostal.trim()
    );
  }, [decision, newBlk, newStreet, newUnit, newPostal]);

  const submit = async () => {
    if (!decision) return;

    try {
      const res = await fetch("/api/address-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          decision,
          newAddress:
            decision === "changed"
              ? {
                  blk: newBlk.trim(),
                  street: newStreet.trim(),
                  unit: newUnit.trim(),
                  postal: newPostal.trim(),
                }
              : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      const updated = await res.json();

      alert("Thank you! Your response has been recorded.");
      // refresh state
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: {
                h: updated.h ?? (decision === "correct" ? "1" : "changed"),
              },
              newAddr:
                updated.newAddr ??
                (decision === "changed"
                  ? {
                      blk: newBlk,
                      street: newStreet,
                      unit: newUnit,
                      postal: newPostal,
                    }
                  : null),
            }
          : prev
      );
    } catch (e) {
      console.error(e);
      alert("Sorry—failed to submit. Please try again.");
    }
  };

  if (!token || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-lg">
        Loading...
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-lg">
        ❌ Link not found / expired.
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Address Confirmation</h1>

        <p className="mt-3 text-black/80 leading-relaxed">
          Dear{" "}
          <span className="font-semibold text-black">
            {data.name ?? "Donor"}
          </span>
          ,<br />
          Is your address recorded with BW Monastery correct?
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="font-semibold mb-2">
            Address recorded with BW Monastery
          </div>
          <div className="text-black/85 space-y-1">
            <div>
              Blk/No: <span className="font-mono">{data.old.blk || "—"}</span>
            </div>
            <div>
              Street:{" "}
              <span className="font-mono">{data.old.street || "—"}</span>
            </div>
            <div>
              Unit: <span className="font-mono">{data.old.unit || "—"}</span>
            </div>
            <div>
              Postal Code:{" "}
              <span className="font-mono">{data.old.postal || "—"}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="decision"
              className="h-4 w-4"
              checked={decision === "correct"}
              onChange={() => setDecision("correct")}
            />
            <span>
              a) If <b>correct</b>, press <b>1</b>
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="decision"
              className="h-4 w-4"
              checked={decision === "changed"}
              onChange={() => setDecision("changed")}
            />
            <span>
              b) If address is <b>changed / not correct</b>, please provide new
              address
            </span>
          </label>
        </div>

        {showNew && (
          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-black/70 mb-1">
                  Blk/No (new) (Column M)
                </div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  value={newBlk}
                  onChange={(e) => setNewBlk(e.target.value)}
                />
              </div>
              <div>
                <div className="text-sm text-black/70 mb-1">
                  Unit (new) (Column O)
                </div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="text-sm text-black/70 mb-1">
                Street (new) (Column N)
              </div>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm text-black/70 mb-1">
                Postal Code (new) (Column P)
              </div>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                inputMode="numeric"
                value={newPostal}
                onChange={(e) => setNewPostal(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="w-full text-center mt-3">
          <Button onClick={submit} disabled={!canSubmit} className="mx-auto">
            Submit
          </Button>
        </div>

        {data.status?.h && (
          <p className="mt-3 text-sm text-black/70">
            Current recorded response:{" "}
            <span className="font-mono">{String(data.status.h)}</span>
          </p>
        )}
      </div>
    </main>
  );
}
