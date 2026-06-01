# db-explorer — Requirements & Regeneration Prompt

This file documents the full application spec and doubles as a Cortex Code prompt to regenerate or extend the app:

```
Review the requirements in @requirements.md and build the application.
```

---

## Overview

**Database Explorer** is a read-only Snowflake object browser. It lists every database, schema, table, and column that the currently logged-in user is permitted to see, respecting their Snowflake role and grants.

## Goals

- Let any Snowflake user explore their accessible objects without needing SQL knowledge
- Show only what the user is authorized to see (Caller's Rights)
- Be deployable by anyone — no Python, no Flask, no Docker knowledge required
- Be buildable from this file as a single Cortex Code prompt

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript |
| Styling | Plain CSS (no Tailwind) in `app/globals.css` |
| Icons | `lucide-react` |
| Snowflake auth | `lib/snowflake.ts` (from Next.js template) |
| Deployment | Snowflake App Runtime (SPCS) via `snow app deploy` |

## Authentication

**Caller's Rights** throughout. Every API route passes `{ callersRights: true }` to `querySnowflake()`. The `app.yml` includes `run.executeAsCaller: true` so Snowflake injects the per-user token.

Local dev falls back to `~/.snowflake/connections.toml` automatically (caller's rights has no effect locally — the connection toml user is used instead).

## UI

Three-panel layout inside an app shell with a top bar:

```
┌────────────────────────────────────────────────────────────┐
│ [icon] Database Explorer                    DB › SCHEMA    │
├───────────────┬──────────────┬──────────────────────────── │
│ DATABASES     │ SCHEMAS      │  TABLES / COLUMNS           │
│ ─────────────  ─────────────  ─────────────────────────── │
│ ▶ ACME_DB     │ ▶ PUBLIC     │  ORDERS                     │
│   SALES_DB    │   ANALYTICS  │  ▼ CUSTOMERS                │
│   …           │   …          │    #  column   type  null   │
│               │              │    1  id       NUMBER  NO   │
│               │              │    2  email    VARCHAR YES  │
└───────────────┴──────────────┴─────────────────────────────┘
```

### Interactions

1. **Click a database** → loads its schemas into panel 2
2. **Click a schema** → loads its tables into panel 3
3. **Click a table row** → expands inline to show column details (name, type, nullable, PK, comment)
4. **Clicking expanded table again** → collapses it
5. Each panel has a live filter input

### Empty and loading states

- Loading spinner while fetching
- "Select a database" placeholder before any selection
- "No tables found" / "No schemas found" when the object is empty or access is denied
- Error banner when a query fails

## API Routes

All routes use `callersRights: true` and `export const dynamic = "force-dynamic"`.

| Method | Route | Query Params | SQL |
|--------|-------|-------------|-----|
| GET | `/api/databases` | — | `SHOW DATABASES` |
| GET | `/api/schemas` | `db` | `SHOW SCHEMAS IN DATABASE "<db>"` |
| GET | `/api/tables` | `db`, `schema` | `SHOW TABLES IN SCHEMA "<db>"."<schema>"` |
| GET | `/api/columns` | `db`, `schema`, `table` | `SHOW COLUMNS IN TABLE "<db>"."<schema>"."<table>"` |

Results are sorted alphabetically by name.

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Root page — renders `<Explorer />` |
| `app/layout.tsx` | HTML shell, sets title and icon |
| `app/globals.css` | All styles (CSS variables, panels, tables, states) |
| `app/api/databases/route.ts` | List accessible databases |
| `app/api/schemas/route.ts` | List schemas for a database |
| `app/api/tables/route.ts` | List tables for a schema |
| `app/api/columns/route.ts` | List columns for a table |
| `components/Explorer.tsx` | Full client component (three panels + column detail) |
| `lib/snowflake.ts` | Snowflake query helper (from template — do not edit) |
| `next.config.mjs` | Standalone build, workspace root pin (from template — do not edit) |
| `app.yml` | SPCS run config + `executeAsCaller: true` + profile metadata |
| `snowflake.yml` | Snowflake App Runtime deployment manifest |
| `public/icon.svg` | App icon (database cylinder) |

## Deployment

### Local development

```bash
cd db-explorer
npm install
npm run dev
```

Opens at `http://localhost:3000`. Uses your `~/.snowflake/connections.toml` default connection.

### SPCS deployment

1. Make sure you have the Snowflake CLI installed (`snow --version` should be ≥ 3.17).
2. Ensure `snowflake.yml` has the correct `database`, `schema`, `query_warehouse`, `build_compute_pool`, `service_compute_pool`, and `build_eai` values for your account.
3. Deploy:

```bash
cd db-explorer
snow app deploy   # or: snow __app deploy
```

4. Open:

```bash
snow app open     # or: snow __app open
```

### SPCS prerequisites (one-time, ask your Snowflake admin)

- A compute pool (e.g. `CPU_X64_XS`)
- An external access integration that allows egress to `registry.npmjs.org` (for the build step)
- `CREATE SNOWFLAKE APP` privilege on the target database/schema

## Extending the app

- **Add views/stages**: call `SHOW VIEWS IN SCHEMA` or `SHOW STAGES IN SCHEMA` and add a fourth panel
- **Add search across all databases**: add a global `/api/search` route using `INFORMATION_SCHEMA.TABLES`
- **Add row preview**: clicking a table could fetch `SELECT * FROM ... LIMIT 20`
- **Filter by object type**: add checkboxes for TABLE / VIEW / EXTERNAL TABLE
