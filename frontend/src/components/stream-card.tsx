import Link from "next/link";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { Progress } from "@/components/ui/progress";
import {
  formatAmount,
  formatDate,
  formatDuration,
  Stream,
  vestedProgress,
} from "@/lib/stream";

export function StreamCard({ stream }: { stream: Stream }) {
  const progress = vestedProgress(stream);

  return (
    <Link
      href={`/streams/${stream.streamId}`}
      className="block rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Stream #{stream.streamId}</h2>
          <p className="truncate text-sm text-gray-600">
            From: {stream.sender} → To: {stream.recipient}
          </p>
        </div>
        <StreamStatusBadge status={stream.status} />
      </div>

      <p className="mt-2 truncate text-sm text-gray-600">
        Token: {stream.token} | Deposit: {formatAmount(stream.deposit)}
      </p>

      <div className="mt-4">
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

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-gray-500">
          Withdrawable: {formatAmount(stream.withdrawableAmount)}
        </span>
        <span className="text-gray-500">
          Remaining: {formatAmount(stream.remainingAmount)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
        <span>Cliff: {formatDate(stream.cliffTime)}</span>
        <span>Ends: {formatDate(stream.endTime)}</span>
      </div>
    </Link>
  );
}