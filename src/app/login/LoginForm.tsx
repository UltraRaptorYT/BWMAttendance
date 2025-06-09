"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      router.push(redirectPath);
    } else {
      setError("Wrong password");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Enter Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border border-gray-300 p-2 w-full rounded"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded"
          >
            Submit
          </button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
