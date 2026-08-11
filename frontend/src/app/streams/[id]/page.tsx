"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { Progress } from "@/components/ui/progress";
import {
  Stream,
  StreamEvent,
  formatAmount,
  formatDate,
  formatDuration,
  formatIsoDate,
  vestedProgress,
} from "@/lib/stream";

export default function StreamDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStream() {
      try {
        const res = await fetch(`/api/streams/${params.id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Stream not found");
          }
          throw new Error(`Request failed: ${res.status}`);
        }
        const data = await res.json();
        setStream(data.data);
        setEvents(data.data?.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stream");
      } finally {
        setLoading(false);
      }
    }
    fetchStream();
  }, [params.id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-8" role="status" aria-live="polite">
        <p className="text-gray-500">Loading stream...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <div className="rounded bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!stream) return null;

  const progress = vestedProgress(stream);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/dashboard" className="mb-4 inline-block text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-3xl font-bold">Stream #{stream.streamId}</h1>
        <StreamStatusBadge status={stream.status} />
      </div>

      <section
        className="mt-6 rounded-lg border bg-white p-6 shadow-sm"
        aria-labelledby="overview-heading"
      >
        <h2 id="overview-heading" className="text-xl font-semibold">
          Overview
        </h2>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Sender</dt>
            <dd className="break-all text-sm font-medium">{stream.sender}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Recipient</dt>
            <dd className="break-all text-sm font-medium">{stream.recipient}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Token</dt>
            <dd className="break-all text-sm font-medium">{stream.token}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Deposit</dt>
            <dd className="text-sm font-medium">{formatAmount(stream.deposit)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{progress}% vested</span>
            <span>{formatDuration(stream.startTime, stream.endTime)}</span>
          </div>
          <div className="mt-2">
            <Progress
              value={progress}
              max={100}
              aria-label={`Stream ${stream.streamId} vesting progress`}
            />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded border border-gray-100 p-4">
            <dt className="text-sm text-gray-500">Withdrawable</dt>
            <dd className="text-lg font-semibold">
              {formatAmount(stream.withdrawableAmount)}
            </dd>
          </div>
          <div className="rounded border border-gray-100 p-4">
            <dt className="text-sm text-gray-500">Remaining</dt>
            <dd className="text-lg font-semibold">
              {formatAmount(stream.remainingAmount)}
            </dd>
          </div>
          <div className="rounded border border-gray-100 p-4">
            <dt className="text-sm text-gray-500">Withdrawn</dt>
            <dd className="text-lg font-semibold">
              {formatAmount(stream.withdrawnAmount)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Start</dt>
            <dd className="text-sm font-medium">{formatDate(stream.startTime)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Cliff</dt>
            <dd className="text-sm font-medium">{formatDate(stream.cliffTime)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">End</dt>
            <dd className="text-sm font-medium">{formatDate(stream.endTime)}</dd>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-600">
          Cancelable: {stream.cancelable ? "Yes" : "No"}
        </p>
      </section>

      <section
        className="mt-6 rounded-lg border bg-white p-6 shadow-sm"
        aria-labelledby="events-heading"
      >
        <h2 id="events-heading" className="text-xl font-semibold">
          Events
        </h2>
        {events.length === 0 ? (
          <p className="mt-4 text-gray-500">No events recorded.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded border border-gray-100 p-3 text-sm"
              >
                <span className="font-medium">{event.eventType}</span>
                <span className="text-gray-500">{formatIsoDate(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}