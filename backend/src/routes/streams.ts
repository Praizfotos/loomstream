import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const StreamStatusSchema = z.enum(["active", "canceled", "completed"]);
const RoleSchema = z.enum(["sender", "recipient"]);

const ListQuerySchema = z.object({
  role: RoleSchema.optional(),
  address: z.string().optional(),
  status: StreamStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function streamRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { role, address, status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    const orArray: unknown[] = [];
    if (address) {
      if (role === "sender" || !role) {
        orArray.push({ sender: address });
      }
      if (role === "recipient" || !role) {
        orArray.push({ recipient: address });
      }
    }
    if (orArray.length > 0) {
      where.OR = orArray;
    }

    if (status === "active") {
      where.canceled = false;
    } else if (status === "canceled") {
      where.canceled = true;
    } else if (status === "completed") {
      where.canceled = false;
    }

    const [streams, total] = await Promise.all([
      prisma.stream.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.stream.count({ where }),
    ]);

    return res.json({
      data: streams,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const streamId = parseInt(req.params.id, 10);
    if (isNaN(streamId)) {
      return res.status(400).json({ error: "Invalid stream ID" });
    }

    const stream = await prisma.stream.findUnique({
      where: { streamId },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });

    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    return res.json({ data: stream });
  });

  router.get("/:id/events", async (req: Request, res: Response) => {
    const streamId = parseInt(req.params.id, 10);
    if (isNaN(streamId)) {
      return res.status(400).json({ error: "Invalid stream ID" });
    }

    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "50", 10);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.streamEvent.findMany({
        where: { streamId },
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
      }),
      prisma.streamEvent.count({ where: { streamId } }),
    ]);

    return res.json({
      data: events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  return router;
}