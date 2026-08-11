import { Stream } from "@prisma/client";

export const STREAM_STATUSES = [
  "UPCOMING",
  "CLIFF",
  "ACTIVE",
  "FULLY_VESTED",
  "CANCELED",
] as const;

export type StreamStatus = (typeof STREAM_STATUSES)[number];

export interface StreamStatusSource {
  startTime: number;
  endTime: number;
  cliffTime: number;
  canceled: boolean;
}

export interface StreamAmounts {
  vestedAmount: bigint;
  withdrawableAmount: bigint;
  remainingAmount: bigint;
}

export interface SerializedStream {
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

export function deriveStreamStatus(
  source: StreamStatusSource,
  nowSec: number
): StreamStatus {
  if (source.canceled) {
    return "CANCELED";
  }
  if (nowSec < source.startTime) {
    return "UPCOMING";
  }
  const cliffConfigured = source.cliffTime > source.startTime;
  if (cliffConfigured && nowSec < source.cliffTime) {
    return "CLIFF";
  }
  if (nowSec >= source.endTime) {
    return "FULLY_VESTED";
  }
  return "ACTIVE";
}

export function computeVestedAmount(
  deposit: bigint,
  startTime: number,
  endTime: number,
  cliffTime: number,
  nowSec: number
): bigint {
  if (nowSec < startTime || nowSec < cliffTime) {
    return 0n;
  }
  if (nowSec >= endTime) {
    return deposit;
  }
  const elapsed = BigInt(nowSec - cliffTime);
  const total = BigInt(endTime - cliffTime);
  if (total === 0n) {
    return deposit;
  }
  return (deposit * elapsed) / total;
}

export function computeStreamAmounts(
  stream: Stream,
  nowSec: number
): StreamAmounts {
  const vestedAmount = computeVestedAmount(
    stream.deposit,
    stream.startTime,
    stream.endTime,
    stream.cliffTime,
    nowSec
  );
  if (stream.canceled) {
    return { vestedAmount, withdrawableAmount: 0n, remainingAmount: 0n };
  }
  const withdrawableAmount =
    vestedAmount > stream.withdrawnAmount
      ? vestedAmount - stream.withdrawnAmount
      : 0n;
  const remainingAmount =
    stream.deposit > stream.withdrawnAmount
      ? stream.deposit - stream.withdrawnAmount
      : 0n;
  return { vestedAmount, withdrawableAmount, remainingAmount };
}

export function serializeStream(
  stream: Stream,
  nowSec: number
): SerializedStream {
  const amounts = computeStreamAmounts(stream, nowSec);
  return {
    streamId: stream.streamId,
    sender: stream.sender,
    recipient: stream.recipient,
    token: stream.token,
    deposit: stream.deposit.toString(),
    startTime: stream.startTime,
    endTime: stream.endTime,
    cliffTime: stream.cliffTime,
    cancelable: stream.cancelable,
    canceled: stream.canceled,
    withdrawnAmount: stream.withdrawnAmount.toString(),
    createdAt: stream.createdAt.toISOString(),
    updatedAt: stream.updatedAt.toISOString(),
    status: deriveStreamStatus(stream, nowSec),
    vestedAmount: amounts.vestedAmount.toString(),
    withdrawableAmount: amounts.withdrawableAmount.toString(),
    remainingAmount: amounts.remainingAmount.toString(),
  };
}