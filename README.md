# GoPratle requirement posting flow

Private review build for the Full-Stack Developer Intern assignment. Not affiliated with or an official GoPratle product. No recruiter submission, public release or live hosting has happened.

## What works

- Four steps: event basics, category-specific requirements, finer details, review and submit.
- Planner, performer and crew branches with independent schemas.
- Next.js 15 / React 19 frontend, Node.js + Express 5 API, actual MongoDB storage.
- Draft recovery in this tab's `sessionStorage`. Changing category clears old details.
- Server validation, dates and ranges, request size limit, Helmet, narrow CORS, rate limiting, retry-safe writes with a unique idempotency key and payload hash.
- Success displays only after MongoDB acknowledges the save. API failure leaves the form intact.
- No public listing endpoint, no contact details collected, no payment or booking.

## Run locally

Node 22 and Docker are recommended.

```sh
npm ci
docker compose up -d
cp backend/.env.example backend/.env
# Terminal A
npm start -w backend
# Terminal B
npm run dev -w frontend
```

Open http://localhost:3000. The Next.js rewrite sends `/api/*` server-side to the Express service at `API_ORIGIN` (default http://127.0.0.1:4000). Do not put the Mongo connection string in a `NEXT_PUBLIC_` variable.

```sh
npm test
npm run build
node docs/ui-test.cjs
```

Backend tests launch a real temporary `mongod` using `mongodb-memory-server`; it downloads a MongoDB binary, not a JavaScript database mock. The preview database is temporary and is not a durable hosted deployment. Local Docker uses a named persistent volume. Production requires a persistent MongoDB provider.

## Category assumptions

The recruiter specified category-specific steps but not exact fields. These are explicit design assumptions, not copied product specifications:

| Category  | Step 2                     | Step 3                                       |
| --------- | -------------------------- | -------------------------------------------- |
| Planner   | Planning support, guests   | Event style, total INR budget, notes         |
| Performer | Performance type, audience | Duration in minutes, total INR budget, notes |
| Crew      | Department, crew count     | Shift hours, total INR budget, notes         |

Dates are calendar dates (`YYYY-MM-DD`); past-day validation uses UTC consistently in the UI and API. Same-day start/end is allowed. The API rejects impossible dates and reversed ranges. Currency is INR as a documented assumption, not a payment.

## API and MongoDB data flow

`POST /api/requirements` receives a strict JSON body. Zod validates common fields and the selected category's schema. Express computes a SHA-256 hash of the normalized payload and inserts one `requirements` document. Indexes: unique `idempotencyKey`; compound `{category:1,createdAt:-1}`. A concurrent duplicate-key race re-reads and returns the same receipt if the payload matches; differing content with the same key returns 409.

```json
{
  "eventName": "Sample celebration",
  "eventType": "Wedding",
  "startDate": "2027-12-01",
  "endDate": "2027-12-02",
  "location": "Bengaluru",
  "venue": "",
  "category": "crew",
  "details": {
    "department": "Production",
    "count": 8,
    "hours": 6,
    "budget": 50000,
    "notes": "Synthetic sample"
  },
  "idempotencyKey": "a2cc83fd-7ea0-4688-aeaa-59d76f3c8306"
}
```

Response 201: `{id, category, status:"received", createdAt, replayed:false}`. Replay 200; conflict 409; validation 422; malformed JSON 400; oversized body 413; unavailable backend 503. `GET /api/health` pings MongoDB. No retrieval endpoint is exposed.

## Deployment plan (not executed)

1. Provision a free persistent MongoDB database with least-privilege database credentials and narrowly allowed server access. Keep all secrets in the hosting platform's secret settings.
2. Deploy `backend` on a Node-capable host, set `MONGODB_URI`, `MONGODB_DB`, `FRONTEND_ORIGIN`, and the provider's `PORT`.
3. Deploy `frontend` on Vercel or equivalent. Set `API_ORIGIN` to the backend HTTPS origin and rebuild.
4. Verify health, all three POST categories, actual Mongo documents, duplicate retries, errors, desktop/mobile and refresh recovery on the deployed URL.
5. Publish the reviewed source repository only after approval. Include frontend and backend, lockfile, README, tests and no `.env` files.

## Limits and next improvements

This is an anonymous assignment flow, not a full marketplace. No authentication, vendor matching, user dashboard, availability, notification or booking features are claimed. Restrictive CORS is not authentication. For public use add bot controls, quotas, origin/CSRF enforcement appropriate to hosting, abuse monitoring, retention and consent, per-owner auth for any future retrieval endpoint, distributed rate limiting for multiple instances, observability and deployment smoke tests. The current rate limiter is per process. No login was added because the brief asks only for posting; public retrieval is deliberately absent. TLS is the hosting provider's responsibility.

## Walkthrough

See `docs/walkthrough.md` for a 6-minute explanation and interview preparation checklist. The review screen recording is a silent, captioned assistant demonstration, not a recording of the applicant and not a claim of independent applicant authorship. The applicant should run the code, inspect each decision, and record their own explanation before sending it to the recruiter.
