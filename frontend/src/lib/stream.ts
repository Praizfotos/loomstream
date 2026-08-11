export type StreamStatus =
  | "UPCOMING"
  | "CLIFF"
  | "ACTIVE"
  | "FULLY_VESTED"
  | "CANCELED";

export interface Stream {
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
  createdAt: string;
  updatedAt: string;
  status: StreamStatus;
  vestedAmount: string;
  withdrawableAmount: string;
  remainingAmount: string;
}

export interface StreamEvent {
  id: number;
  streamId: number;
  eventType: string;
  topics: string[];
  data: Record<string, unknown>;
  txHash: string;
  ledgerSeq: number;
  createdAt: string;
}

export function formatAmount(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatIsoDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function vestedProgress(stream: Stream): number {
  const deposit = Number(stream.deposit);
  if (!deposit || deposit <= 0) return 0;
  const vested = Math.min(Number(stream.vestedAmount), deposit);
  return Math.round((vested / deposit) * 100);
}

export function formatDuration(startTime: number, endTime: number): string {
  const diff = endTime - startTime;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  return `${days}d ${hours}h`;
}