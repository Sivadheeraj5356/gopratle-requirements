import "dotenv/config";
import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
if (!process.env.MONGODB_URI)
  throw new Error(
    "MONGODB_URI is required. No mock or fallback persistence is used.",
  );
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
await client.connect();
const app = await createApp(client.db(process.env.MONGODB_DB || "gopratle"), {
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
});
const server = app.listen(process.env.PORT || 4000, () =>
  console.log("GoPratle API listening"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await client.close();
      process.exit(0);
    }),
  );
