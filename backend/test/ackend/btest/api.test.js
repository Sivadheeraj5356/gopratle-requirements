import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import { createApp } from "../src/app.js";
let server, client, db, app;
before(async () => {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  await client.connect();
  db = client.db("tests");
  app = await createApp(db, { rateLimitMax: 1000 });
});
after(async () => {
  await client?.close();
  await server?.stop();
});
const details = {
  planner: {
    service: "Full event planning",
    guests: 150,
    style: "Classic and elegant",
    budget: 200000,
  },
  performer: { act: "Live band", audience: 200, duration: 60, budget: 50000 },
  crew: { department: "Production", count: 8, hours: 6, budget: 32000 },
};
const payload = (category = "planner") => ({
  eventName: "Sample celebration",
  eventType: "Wedding",
  startDate: "2027-12-01",
  endDate: "2027-12-02",
  location: "Bengaluru",
  venue: "",
  category,
  details: details[category],
  idempotencyKey: randomUUID(),
});
for (const c of ["planner", "performer", "crew"])
  test(`${c}: stores actual categorised Mongo document`, async () => {
    const p = payload(c);
    const r = await request(app).post("/api/requirements").send(p).expect(201);
    assert.equal(r.body.category, c);
    const doc = await db
      .collection("requirements")
      .findOne({ idempotencyKey: p.idempotencyKey });
    assert.equal(doc.category, c);
    assert.deepEqual(doc.details, { ...details[c], notes: "" });
    assert.equal(r.body.id, doc._id.toString());
    assert.equal(r.body.details, undefined);
  });
test("health checks real Mongo connection", async () => {
  const r = await request(app).get("/api/health").expect(200);
  assert.equal(r.body.database, "connected");
});
test("same submission is replay-safe", async () => {
  const p = payload();
  const a = await request(app).post("/api/requirements").send(p).expect(201);
  const b = await request(app).post("/api/requirements").send(p).expect(200);
  assert.equal(a.body.id, b.body.id);
  assert.equal(b.body.replayed, true);
  assert.equal(
    await db
      .collection("requirements")
      .countDocuments({ idempotencyKey: p.idempotencyKey }),
    1,
  );
});
test("parallel retries create one document", async () => {
  const p = payload();
  const result = await Promise.all(
    Array.from({ length: 4 }, () =>
      request(app).post("/api/requirements").send(p),
    ),
  );
  assert.equal(new Set(result.map((r) => r.body.id)).size, 1);
  assert.equal(
    await db
      .collection("requirements")
      .countDocuments({ idempotencyKey: p.idempotencyKey }),
    1,
  );
});
test("changed payload with same key conflicts", async () => {
  const p = payload();
  await request(app).post("/api/requirements").send(p).expect(201);
  await request(app)
    .post("/api/requirements")
    .send({ ...p, eventName: "Changed event" })
    .expect(409);
});
for (const [name, patch] of [
  ["past date", { startDate: "2020-01-01" }],
  ["reversed range", { endDate: "2027-11-01" }],
  ["impossible date", { startDate: "2027-02-30" }],
  ["wrong category details", { category: "crew" }],
  ["NoSQL object", { location: { $gt: "" } }],
  ["unknown properties", { isAdmin: true }],
  ["invalid category", { category: "hacker" }],
  ["missing required", { eventName: "" }],
  ["negative budget", { details: { ...details.planner, budget: -1 } }],
  ["zero quantity", { details: { ...details.planner, guests: 0 } }],
])
  test(`rejects ${name}`, async () => {
    await request(app)
      .post("/api/requirements")
      .send({ ...payload(), ...patch })
      .expect(422);
  });
test("does not expose stored requirements publicly", async () => {
  await request(app).get("/api/requirements").expect(404);
});
test("disallowed origin receives no CORS access", async () => {
  const r = await request(app)
    .get("/api/health")
    .set("Origin", "https://untrusted.invalid");
  assert.equal(r.headers["access-control-allow-origin"], undefined);
});
test("payload limit", async () => {
  await request(app)
    .post("/api/requirements")
    .send({ ...payload(), venue: "x".repeat(20000) })
    .expect(413);
});
test("malformed JSON", async () => {
  await request(app)
    .post("/api/requirements")
    .set("Content-Type", "application/json")
    .send("{no")
    .expect(400);
});
