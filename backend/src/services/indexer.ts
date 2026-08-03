import { PrismaClient } from "@prisma/client";

export interface IndexedEvent {
  streamId: number;
  eventType: string;
  topics: string[];
  data: Record<string, unknown>;
  txHash: string;
  ledgerSeq: number;
  createdAt: Date;
}

export async function upsertStream(prisma: PrismaClient, event: IndexedEvent) {
  const streamId = event.streamId;
  const existing = await prisma.stream.findUnique({ where: { streamId } });

  if (!existing) {
    await prisma.stream.create({
      data: {
        streamId,
        sender: event.topics[1] || "",
        recipient: event.topics[2] || "",
        token: event.topics[3] || "",
        deposit: BigInt(event.data.deposit as string || "0"),
        startTime: event.data.start_time as number,
        endTime: event.data.end_time as number,
        cliffTime: event.data.cliff_time as number,
        cancelable: event.data.cancelable as boolean,
        canceled: false,
        withdrawnAmount: 0n,
      },
    });
    return;
  }

  if (event.eventType === "StreamCanceled") {
    await prisma.stream.update({
      where: { streamId },
      data: { canceled: true },
    });
  }
}

export async function upsertEvent(prisma: PrismaClient, event: IndexedEvent) {
  await prisma.streamEvent.upsert({
    where: {
      streamId_txHash_ledgerSeq: {
        streamId: event.streamId,
        txHash: event.txHash,
        ledgerSeq: event.ledgerSeq,
      },
    },
    create: {
      streamId: event.streamId,
      eventType: event.eventType,
      topics: event.topics,
      data: event.data as Record<string, unknown>,
      txHash: event.txHash,
      ledgerSeq: event.ledgerSeq,
      createdAt: event.createdAt,
    },
    update: {},
  });
}

export async function getIndexerCursor(prisma: PrismaClient) {
  const cursor = await prisma.indexerCursor.findUnique({
    where: { id: "global" },
  });
  return cursor?.cursor ?? null;
}

export async function setIndexerCursor(prisma: PrismaClient, cursor: string) {
  await prisma.indexerCursor.upsert({
    where: { id: "global" },
    create: { id: "global", cursor },
    update: { cursor },
  });
}