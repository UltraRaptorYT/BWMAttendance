"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirect");
  const redirectPath =
    requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.push(redirectPath);
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error || "Unable to sign in");
      }
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="dark fullHeight flex items-center justify-center bg-[#070b12] p-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          BWM Attendance
        </p>
        <h1 className="mb-1 text-xl font-semibold text-white">Admin sign in</h1>
        <p className="mb-5 text-sm text-slate-500">
          Enter the access password to manage events.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button className="w-full" type="submit" disabled={isProcessing}>
            {isProcessing ? "Checking..." : "Submit"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
