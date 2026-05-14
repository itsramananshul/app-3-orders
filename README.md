# APP 3 — Orders Management

Standalone Next.js 14 + TypeScript app for tracking customer orders at a
factory or warehouse, backed by Supabase Postgres. Same codebase runs as
Factory 1–4 and Warehouse 1–2 with per-instance isolation via the
`instance_name` column.

The `/api/status` endpoint reports `health: "degraded"` when any orders are
FLAGGED — that's the signal Nexus will read in a later phase of the demo.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `@supabase/supabase-js`
- Vercel-ready (no custom port handling)

## Supabase setup

1. Paste `supabase/schema.sql` into the Supabase SQL editor and run (once).
2. Paste `supabase/seed.sql` and run. It upserts 72 rows — 12 per instance
   across Factory 1–4 and Warehouse 1–2. Each instance has at least one
   FLAGGED order and at least one overdue order so the dashboards always
   have something to react to. Re-running the seed acts as a demo reset.

The `total_value` column is a Postgres generated column
(`quantity * unit_price`) and is never written from the app.

## Environment

`.env.local` (copied from app-1, same Supabase project):

```env
INSTANCE_NAME=Factory 1
NEXT_PUBLIC_INSTANCE_NAME=Factory 1

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # preferred (bypasses RLS)
SUPABASE_ANON_KEY=...           # fallback
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Switch instance locally by changing `INSTANCE_NAME` and
`NEXT_PUBLIC_INSTANCE_NAME` and restarting `npm run dev`.

## Local dev

```bash
npm install
npm run dev          # http://localhost:3000
```

## API

| Method | Path                              | Body                                   | Notes                                |
| ------ | --------------------------------- | -------------------------------------- | ------------------------------------ |
| GET    | `/api/orders`                     | —                                      | List orders for this instance        |
| POST   | `/api/orders`                     | full order, minus auto fields          | Create a new order                   |
| GET    | `/api/orders/[id]`                | —                                      | Single order                         |
| PATCH  | `/api/orders/[id]/status`         | `{ "status": "..." }`                  | Change status                        |
| PATCH  | `/api/orders/[id]/priority`       | `{ "priority": "..." }`                | Change priority                      |
| POST   | `/api/orders/[id]/note`           | `{ "note": "..." }`                    | Appends timestamped note             |
| GET    | `/api/status`                     | —                                      | health is `degraded` if flaggedCount > 0 |

All errors → `{ "success": false, "error": "..." }`.
All mutation successes → `{ "success": true, "order": { ... } }`.

Notes are accumulated as a newline-separated log; each new note is prepended
with `[<ISO timestamp>] ` before being appended to the existing notes.

Sort order on `GET /api/orders`: `due_date` ASC, then priority (URGENT first).

## UI

- Header with instance chip, connection status, **+ New order** button.
- Four stat cards: Total Orders, Flagged Orders (danger when > 0), Overdue
  Orders (danger when > 0), Total Value (sum of `total_value`).
- Filter bar: status, priority, free-text search, "Overdue only" toggle.
- Orders table — wide. FLAGGED rows are tinted rose, overdue (non-DELIVERED)
  rows tinted amber. Due Date in rose when overdue.
- Per-row actions: Status / Priority / Note → modal.
- Toast for every mutation. Bottom **Recent Activity** panel logs the last
  50 attempts client-side.

## Deploy to Vercel

One Vercel project per instance, all pointing at the same git repo with
**Root Directory** = `app-3-orders`. Same Supabase env vars across projects;
only `INSTANCE_NAME` / `NEXT_PUBLIC_INSTANCE_NAME` differ.

## curl smoke test

```bash
BASE=http://localhost:3000

curl $BASE/api/orders
curl $BASE/api/status

# Use an id from the list above.
curl -X PATCH $BASE/api/orders/<uuid>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PRODUCTION"}'

curl -X PATCH $BASE/api/orders/<uuid>/priority \
  -H "Content-Type: application/json" \
  -d '{"priority":"URGENT"}'

curl -X POST $BASE/api/orders/<uuid>/note \
  -H "Content-Type: application/json" \
  -d '{"note":"Customer called about delivery"}'

curl -X POST $BASE/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_number":"ORD-F1-099",
    "customer":"Acme Test",
    "product_sku":"TEST-001",
    "product_name":"Test Product",
    "quantity":10,
    "unit_price":99.99,
    "status":"PENDING",
    "priority":"NORMAL",
    "due_date":"2026-06-30",
    "notes":""
  }'

# 400 — invalid status
curl -X PATCH $BASE/api/orders/<uuid>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"NOT_A_REAL_STATUS"}'

# 404 — unknown id
curl $BASE/api/orders/00000000-0000-0000-0000-000000000000
```
