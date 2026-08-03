"use client";

import { useState, useEffect } from "react";

interface Stream {
  streamId: number;
  sender: string;
  recipient: string;
  token: string;
  deposit: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  cancelable: boolean;
  canceled: boolean;
  withdrawnAmount: string;
}

export default function DashboardPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    async function fetchStreams() {
      try {
        const res = await fetch("/api/streams?limit=50");
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

  function formatDuration(start: number, end: number) {
    const diff = end - start;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return `${days}d ${hours}h`;
  }

  function progressPercent(stream: Stream) {
    const now = Math.floor(Date.now() / 1000);
    if (now <= stream.startTime) return 0;
    if (now >= stream.endTime) return 100;
    return Math.round(((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100);
  }

  if (loading) return <div className="p-8">Loading streams...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Loomstream Dashboard</h1>

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

      {streams.length === 0 ? (
        <p className="text-gray-500">No streams found. Create your first stream!</p>
      ) : (
        <div className="space-y-4">
          {streams
            .filter(
              (s) =>
                !address ||
                s.sender.toLowerCase().includes(address.toLowerCase()) ||
                s.recipient.toLowerCase().includes(address.toLowerCase())
            )
            .map((stream) => (
              <div
                key={stream.streamId}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Stream #{stream.streamId}
                    </h2>
                    <p className="text-sm text-gray-600">
                      From: {stream.sender} → To: {stream.recipient}
                    </p>
                    <p className="text-sm text-gray-600">
                      Token: {stream.token} | Deposit: {stream.deposit}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      stream.canceled
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {stream.canceled ? "Canceled" : "Active"}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      {progressPercent(stream)}% vested
                    </span>
                    <span>
                      {formatDuration(stream.startTime, stream.endTime)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${progressPercent(stream)}%` }}
                      role="progressbar"
                      aria-valuenow={progressPercent(stream)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Stream ${stream.streamId} progress`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-sm">
                  <span className="text-gray-500">
                    Cliff: {new Date(stream.cliffTime * 1000).toLocaleString()}
                  </span>
                  <span className="text-gray-500">
                    Ends: {new Date(stream.endTime * 1000).toLocaleString()}
                  </span>
                  <span className="text-gray-500">
                    Withdrawn: {stream.withdrawnAmount}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </main>
  );
}