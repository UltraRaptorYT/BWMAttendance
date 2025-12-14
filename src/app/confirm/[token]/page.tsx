"use client";

import { Button } from "@/components/ui/button";
import { useParams, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  // lang=en | zh (default: en)
  const lang = searchParams.get("lang") === "zh" ? "zh" : "en";

  const L = (en: string, zh: string) => (lang === "zh" ? zh : en);

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
          { method: "GET" }
        );

        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch donor data");

        const json = (await res.json()) as DonorData;
        setData(json);

        // pre-fill if previously submitted
        if (json.status?.h === "1") {
          setDecision("correct");
        } else if (json.status?.h && json.status.h !== "1") {
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

      alert(
        L(
          "Thank you! Your response has been recorded.",
          "谢谢！已记录您的回复。"
        )
      );

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
      alert(
        L(
          "Sorry—failed to submit. Please try again.",
          "抱歉—提交失败，请重试。"
        )
      );
    }
  };

  if (!token || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-lg">
        {L("Loading...", "正在加载…")}
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-lg">
        {L("❌ Link not found / expired.", "❌ 链接无效或已过期。")}
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* Optional: quick language links */}
        <div className="flex gap-2 justify-end text-sm mb-2">
          <a className="underline opacity-80 hover:opacity-100" href="?lang=en">
            English
          </a>
          <span className="opacity-50">|</span>
          <a className="underline opacity-80 hover:opacity-100" href="?lang=zh">
            中文
          </a>
        </div>

        <h1 className="text-2xl font-bold">
          {L("Address Confirmation", "地址确认")}
        </h1>

        <p className="mt-3 text-black/80 leading-relaxed">
          {L("Dear", "亲爱的")}{" "}
          <span className="font-semibold text-black">
            {data.name ?? L("Donor", "捐款人")}
          </span>
          ,<br />
          {L(
            "Is your address recorded with BW Monastery correct?",
            "您在 吉祥宝聚寺 登记的地址是否正确？"
          )}
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="font-semibold mb-2">
            {L("Address recorded with BW Monastery", "吉祥宝聚寺 登记地址")}
          </div>
          <div className="text-black/85 space-y-1">
            <div>
              {L("Blk/No:", "楼号/门牌：")}{" "}
              <span className="font-mono">{data.old.blk || "—"}</span>
            </div>
            <div>
              {L("Street:", "街道：")}{" "}
              <span className="font-mono">{data.old.street || "—"}</span>
            </div>
            <div>
              {L("Unit:", "单元：")}{" "}
              <span className="font-mono">{data.old.unit || "—"}</span>
            </div>
            <div>
              {L("Postal Code:", "邮政编码：")}{" "}
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
              {L(
                `a) if "correct",  please go above link and press "1"`,
                `a) “正确”，请进入以上链接，点 “1”`
              )}
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
              {L(
                `b) If address is "changed" or "not correct", please go above link and provide new address`,
                `b) "地址已更改” 或 “错误”, 请在以上链接填写新地址。`
              )}
            </span>
          </label>
        </div>

        {showNew && (
          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-black/70 mb-1">
                  {L("Blk/No (new)", "新楼号/门牌")}
                </div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  value={newBlk}
                  onChange={(e) => setNewBlk(e.target.value)}
                />
              </div>
              <div>
                <div className="text-sm text-black/70 mb-1">
                  {L("Unit (new)", "新单元")}
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
                {L("Street (new)", "新街道")}
              </div>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm text-black/70 mb-1">
                {L("Postal Code (new)", "新邮政编码")}
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
            {L("Submit", "提交")}
          </Button>
        </div>

        {data.status?.h && (
          <p className="mt-3 text-sm text-black/70">
            {L("Current recorded response:", "当前已记录的回复：")}{" "}
            <span className="font-mono">{String(data.status.h)}</span>
          </p>
        )}
      </div>
    </main>
  );
}
