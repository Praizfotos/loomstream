import { PrismaClient } from "@prisma/client";
import {
  getIndexerCursor,
  setIndexerCursor,
  upsertStream,
  upsertEvent,
  IndexedEvent,
} from "./services/indexer";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const prisma = new PrismaClient();

const SOROBAN_RPC = process.env.SOROBAN_RPC_URL || "http://localhost:8000/soroban/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const POLL_INTERVAL_MS = parseInt(process.env.INDEXER_POLL_INTERVAL || "5000", 10);
const MAX_PAGE_SIZE = 100;

async function fetchEvents(cursor: string | null): Promise<{
  events: Record<string, unknown>[];
  nextCursor: string | null;
  more: boolean;
}> {
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: 1,
    method: "getEvents",
    params: {
      startLedger: cursor ? undefined : 0,
      cursor,
      limit: MAX_PAGE_SIZE,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_ADDRESS],
        },
      ],
    },
  };

  const res = await fetch(SOROBAN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`RPC error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const error = json.error as Record<string, unknown> | null;
  if (error) {
    throw new Error(`RPC error: ${error.message}`);
  }

  const result = json.result as Record<string, unknown>;
  return {
    events: result.events || [],
    nextCursor: result.nextCursor || null,
    more: result.more !== false,
  };
}

async function processEvents() {
  let cursor = await getIndexerCursor(prisma);
  let processed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { events, nextCursor, more } = await fetchEvents(cursor);

    if (events.length === 0) {
      if (!more) break;
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    for (const event of events) {
      try {
        const topics = event.topics || [];
        const eventType = topics[0] as string || "unknown";

        const indexed: IndexedEvent = {
          streamId: topics[1] != null ? parseInt(topics[1], 10) : 0,
          eventType,
          topics: topics.map((t: unknown) => String(t)),
          data: event.body || {},
          txHash: event.transactionHash || "",
          ledgerSeq: event.ledgerSeq || 0,
          createdAt: new Date(event.createdAt || Date.now()),
        };

        await upsertEvent(prisma, indexed);

        if (eventType === "StreamCreated") {
          await upsertStream(prisma, indexed);
        } else if (eventType === "StreamCanceled") {
          const streamId = indexed.streamId;
          if (streamId) {
            await prisma.stream.update({
              where: { streamId },
              data: { canceled: true },
            });
          }
        } else if (eventType === "StreamWithdraw") {
          const streamId = indexed.streamId;
          const amount = BigInt(event.body?.amount || "0");
          if (streamId && amount > 0n) {
            await prisma.stream.update({
              where: { streamId },
              data: {
                withdrawnAmount: {
                  increment: amount,
                },
              },
            });
          }
        }

        processed++;
      } catch (err) {
        logger.error(err, "Failed to process event");
      }
    }

    if (nextCursor) {
      await setIndexerCursor(prisma, nextCursor);
      cursor = nextCursor;
    } else {
      break;
    }
  }

  logger.info({ processed }, "Indexer batch complete");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await prisma.$connect();
  logger.info("Indexer started");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await processEvents();
    } catch (err) {
      logger.error(err, "Indexer error");
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  logger.error(err, "Indexer crashed");
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});