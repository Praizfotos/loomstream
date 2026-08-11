"use client";

import { useState, useEffect } from "react";
import { StreamCard } from "@/components/stream-card";
import { Stream } from "@/lib/stream";

export default function DashboardPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    async function fetchStreams() {
      try {
        const res = await fetch("/api/streams?limit=50");
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data = await res.json();
        setStreams(data.data || []);
      } catch (err) {
        setError("Failed to load streams");
      } finally {
        setLoading(false);
      }
    }
    fetchStreams();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-8" role="status" aria-live="polite">
        <h1 className="mb-8 text-3xl font-bold">Loomstream Dashboard</h1>
        <p className="text-gray-500">Loading streams...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="mb-8 text-3xl font-bold">Loomstream Dashboard</h1>
        <div className="rounded bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </div>
      </main>
    );
  }

  const filtered = streams.filter(
    (s) =>
      !address ||
      s.sender.toLowerCase().includes(address.toLowerCase()) ||
      s.recipient.toLowerCase().includes(address.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-8 text-3xl font-bold">Loomstream Dashboard</h1>

      <div className="mb-8 flex gap-4">
        <input
          type="text"
          placeholder="Filter by address (sender or recipient)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 rounded border p-2"
          aria-label="Filter streams by address"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No streams found. Create your first stream!</p>
      ) : (
        <ul className="space-y-4" aria-label="Stream list">
          {filtered.map((stream) => (
            <li key={stream.streamId}>
              <StreamCard stream={stream} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}