"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function RSVPPage() {
  const { slug } = useParams();
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchRSVP = async () => {
      try {
        const res = await fetch(`/api/RSVP?phone=${slug}`);
        const data = await res.json();
        setResponse(data.rsvp || null);
      } catch (err) {
        console.error("Failed to fetch RSVP:", err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchRSVP();
  }, [slug]);

  const handleResponse = async (ans: "yes" | "no") => {
    try {
      const res = await fetch("/api/RSVP", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: slug, rsvp: ans }),
      });

      if (!res.ok) throw new Error("Failed to save RSVP");
      setResponse(ans);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update RSVP.");
    }
  };

  if (!slug || loading) return <div>Loading...</div>;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Event RSVP</h1>
      <p className="text-lg mb-4">
        Phone Number: <strong>{slug}</strong>
      </p>

      {!response && !isEditing && (
        <>
          <p className="mb-4">Will you be attending the event?</p>
          <div className="space-x-4">
            <button
              onClick={() => handleResponse("yes")}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Yes
            </button>
            <button
              onClick={() => handleResponse("no")}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              No
            </button>
          </div>
        </>
      )}

      {response && !isEditing && (
        <>
          <p className="mb-2">
            ✅ You responded: <strong>{response.toUpperCase()}</strong>
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit RSVP Response
          </button>
        </>
      )}

      {isEditing && (
        <>
          <p className="mb-4">Update your RSVP response:</p>
          <div className="space-x-4">
            <button
              onClick={() => handleResponse("yes")}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Yes
            </button>
            <button
              onClick={() => handleResponse("no")}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              No
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </main>
  );
}
