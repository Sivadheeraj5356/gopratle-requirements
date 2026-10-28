import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import { requirementSchema } from "./schema.js";
export async function createApp(
  db,
  { origin = "http://localhost:3000", rateLimitMax = 30 } = {},
) {
  const collection = db.collection("requirements");
  await collection.createIndex({ idempotencyKey: 1 }, { unique: true });
  await collection.createIndex({ category: 1, createdAt: -1 });
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (requestOrigin, cb) =>
        cb(null, !requestOrigin || requestOrigin === origin),
      methods: ["POST", "GET"],
      allowedHeaders: ["Content-Type"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", async (req, res, next) => {
    try {
      await db.command({ ping: 1 });
      res.json({ status: "ok", database: "connected" });
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/api/requirements",
    rateLimit({
      windowMs: 60000,
      limit: rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res, next) => {
      try {
        const parsed = requirementSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(422)
            .json({
              error: "Please check your event details",
              fields: parsed.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            });
        const { idempotencyKey, ...data } = parsed.data;
        const hash = createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex");
        const existing = await collection.findOne({ idempotencyKey });
        if (existing) {
          if (existing.payloadHash !== hash)
            return res
              .status(409)
              .json({
                error:
                  "This submission key was already used for different details. Start a new request.",
              });
          return res.json(receipt(existing, true));
        }
        const document = {
          ...data,
          idempotencyKey,
          payloadHash: hash,
          createdAt: new Date(),
          status: "received",
        };
        try {
          const result = await collection.insertOne(document);
          document._id = result.insertedId;
          return res.status(201).json(receipt(document, false));
        } catch (e) {
          if (e.code === 11000) {
            const prior = await collection.findOne({ idempotencyKey });
            if (prior?.payloadHash === hash)
              return res.json(receipt(prior, true));
            return res
              .status(409)
              .json({ error: "Submission conflict. Start a new request." });
          }
          throw e;
        }
      } catch (e) {
        next(e);
      }
    },
  );
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request too large" });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON" });
    console.error("Request failed:", error.name);
    res
      .status(503)
      .json({
        error:
          "We could not save this request. Your form is still here. Please try again.",
      });
  });
  return app;
}
function receipt(doc, replayed) {
  return {
    id: doc._id.toString(),
    category: doc.category,
    status: doc.status,
    createdAt: doc.createdAt,
    replayed,
  };
}
