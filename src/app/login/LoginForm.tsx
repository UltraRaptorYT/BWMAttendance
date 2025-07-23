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
  const redirectPath = searchParams.get("redirect") || "/admin";

  async function handleSubmit(e: React.FormEvent) {
    setIsProcessing(true);
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
    });

    setIsProcessing(false);
    if (res.ok) {
      router.push(redirectPath);
    } else {
      setError("Wrong password");
    }
  }

  return (
    <div className="fullHeight p-4 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Enter Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" type="submit" disabled={isProcessing}>
            {isProcessing ? "Checking..." : "Submit"}
          </Button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
