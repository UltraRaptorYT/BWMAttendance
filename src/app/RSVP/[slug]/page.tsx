"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function RSVPPage() {
  const { slug } = useParams();
  const [response, setResponse] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, rsvpRes] = await Promise.all([
          fetch(`/api/user?phone=${slug}`),
          fetch(`/api/RSVP?phone=${slug}`),
        ]);

        if (userRes.status === 404) {
          setNotFound(true);
          return;
        }

        const userData = await userRes.json();
        const rsvpData = await rsvpRes.json();

        setName(userData.name || null);
        setResponse(rsvpData.rsvp || null);
      } catch (err) {
        console.error("Failed to fetch user/RSVP:", err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchData();
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

  if (!slug || loading)
    return (
      <div className="text-center text-xl flex items-center justify-center min-h-[100dvh]">
        Loading...
      </div>
    );
  if (notFound)
    return (
      <div className="text-center text-xl flex items-center justify-center min-h-[100dvh]">
        ❌ User not found.
      </div>
    );

  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Event RSVP</h1>
      <p className="text-lg mb-1">
        👤 Name: <strong>{name}</strong>
      </p>
      <p className="text-lg mb-4">
        📞 Phone: <strong>{slug}</strong>
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
