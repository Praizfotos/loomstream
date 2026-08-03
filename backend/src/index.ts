import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { streamRoutes } from "./routes/streams";
import { healthRoute } from "./routes/health";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();
const prisma = new PrismaClient();

app.use(
  pinoHttp({
    logger,
  })
);

app.use(express.json());

app.use("/api/streams", streamRoutes(prisma));
app.use("/health", healthRoute());

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  await prisma.$connect();
  logger.info("Connected to database");
  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Loomstream backend listening");
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});