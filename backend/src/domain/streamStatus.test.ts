import { Stream } from "@prisma/client";
import {
  computeStreamAmounts,
  computeVestedAmount,
  deriveStreamStatus,
  serializeStream,
  StreamStatus,
} from "./streamStatus";

const NOW = 1_700_000_000;

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    streamId: 1,
    sender: "GA_SENDER",
    recipient: "GB_RECIPIENT",
    token: "CA_TOKEN",
    deposit: 1000n,
    startTime: NOW - 10_000,
    endTime: NOW + 20_000,
    cliffTime: NOW - 10_000,
    cancelable: true,
    canceled: false,
    withdrawnAmount: 0n,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("deriveStreamStatus", () => {
  it("returns UPCOMING before the stream start time", () => {
    const stream = makeStream({ startTime: NOW + 60, endTime: NOW + 10_000, cliffTime: NOW + 60 });
    expect(deriveStreamStatus(stream, NOW)).toBe("UPCOMING");
  });

  it("returns CLIFF during the cliff period", () => {
    const stream = makeStream({ startTime: NOW - 100, cliffTime: NOW + 100 });
    expect(deriveStreamStatus(stream, NOW)).toBe("CLIFF");
  });

  it("returns ACTIVE while vesting before the end time", () => {
    const stream = makeStream();
    expect(deriveStreamStatus(stream, NOW)).toBe("ACTIVE");
  });

  it("returns ACTIVE for streams without a cliff", () => {
    const stream = makeStream({ cliffTime: NOW - 10_000 });
    expect(deriveStreamStatus(stream, NOW)).toBe("ACTIVE");
  });

  it("returns FULLY_VESTED at or after the end time", () => {
    const stream = makeStream({ startTime: NOW - 50_000, endTime: NOW });
    expect(deriveStreamStatus(stream, NOW)).toBe("FULLY_VESTED");
  });

  it("returns FULLY_VESTED after the end time", () => {
    const stream = makeStream({ startTime: NOW - 50_000, endTime: NOW - 1 });
    expect(deriveStreamStatus(stream, NOW)).toBe("FULLY_VESTED");
  });

  it("returns CANCELED for canceled streams regardless of time", () => {
    const canceled = makeStream({ canceled: true });
    expect(deriveStreamStatus(canceled, NOW)).toBe("CANCELED");

    const canceledAfterEnd = makeStream({ canceled: true, startTime: NOW - 50_000, endTime: NOW - 1 });
    expect(deriveStreamStatus(canceledAfterEnd, NOW)).toBe("CANCELED");
  });
});

describe("deriveStreamStatus boundary conditions", () => {
  it("treats exactly at start time as started", () => {
    const stream = makeStream({ startTime: NOW, endTime: NOW + 10_000, cliffTime: NOW });
    expect(deriveStreamStatus(stream, NOW)).toBe("ACTIVE");
  });

  it("treats exactly at cliff time as past the cliff", () => {
    const stream = makeStream({ startTime: NOW - 100, cliffTime: NOW, endTime: NOW + 10_000 });
    expect(deriveStreamStatus(stream, NOW)).toBe("ACTIVE");
  });

  it("treats exactly at end time as fully vested", () => {
    const stream = makeStream({ startTime: NOW - 10_000, endTime: NOW });
    expect(deriveStreamStatus(stream, NOW)).toBe("FULLY_VESTED");
  });

  it("at exactly the start a stream with a future cliff is CLIFF", () => {
    const stream = makeStream({ startTime: NOW, cliffTime: NOW + 100, endTime: NOW + 10_000 });
    expect(deriveStreamStatus(stream, NOW)).toBe("CLIFF");
  });
});

describe("computeVestedAmount", () => {
  it("returns zero before start time", () => {
    expect(computeVestedAmount(1000n, 1000, 2000, 1000, 500)).toBe(0n);
  });

  it("returns zero before cliff time", () => {
    expect(computeVestedAmount(1000n, 1000, 2000, 1500, 1200)).toBe(0n);
  });

  it("returns zero exactly at cliff time", () => {
    expect(computeVestedAmount(1000n, 1000, 2000, 1500, 1500)).toBe(0n);
  });

  it("returns full deposit at or after end time", () => {
    expect(computeVestedAmount(1000n, 1000, 2000, 1500, 2000)).toBe(1000n);
    expect(computeVestedAmount(1000n, 1000, 2000, 1500, 3000)).toBe(1000n);
  });

  it("computes linear vesting between cliff and end", () => {
    expect(computeVestedAmount(1000n, 1000, 2000, 1500, 1750)).toBe(500n);
  });
});

describe("computeStreamAmounts", () => {
  it("computes vested, withdrawable and remaining amounts", () => {
    const stream = makeStream({
      startTime: NOW - 10_000,
      endTime: NOW + 10_000,
      cliffTime: NOW - 10_000,
    });
    const amounts = computeStreamAmounts(stream, NOW);
    expect(amounts.vestedAmount).toBe(500n);
    expect(amounts.withdrawableAmount).toBe(500n);
    expect(amounts.remainingAmount).toBe(1000n);
  });

  it("reports withdrawable capped by withdrawn amount", () => {
    const stream = makeStream({ endTime: NOW + 10_000, withdrawnAmount: 600n });
    const amounts = computeStreamAmounts(stream, NOW);
    expect(amounts.vestedAmount).toBe(500n);
    expect(amounts.withdrawableAmount).toBe(0n);
    expect(amounts.remainingAmount).toBe(400n);
  });

  it("reports zero withdrawable and remaining for canceled streams", () => {
    const stream = makeStream({ canceled: true });
    const amounts = computeStreamAmounts(stream, NOW);
    expect(amounts.withdrawableAmount).toBe(0n);
    expect(amounts.remainingAmount).toBe(0n);
  });
});

describe("serializeStream", () => {
  it("is deterministic for a fixed point in time", () => {
    const stream = makeStream();
    const first = serializeStream(stream, NOW);
    const second = serializeStream(stream, NOW);
    expect(first).toEqual(second);
  });

  it("includes status and formatted amounts", () => {
    const stream = makeStream({ endTime: NOW + 10_000, withdrawnAmount: 100n });
    const serialized = serializeStream(stream, NOW);
    expect(serialized.status).toBe("ACTIVE" as StreamStatus);
    expect(serialized.deposit).toBe("1000");
    expect(serialized.withdrawnAmount).toBe("100");
    expect(serialized.vestedAmount).toBe("500");
    expect(serialized.withdrawableAmount).toBe("400");
    expect(serialized.remainingAmount).toBe("900");
  });

  it("serializes a canceled stream with status CANCELED", () => {
    const serialized = serializeStream(makeStream({ canceled: true }), NOW);
    expect(serialized.status).toBe("CANCELED");
    expect(serialized.withdrawableAmount).toBe("0");
    expect(serialized.remainingAmount).toBe("0");
  });
});