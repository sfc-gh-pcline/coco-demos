# Database Explorer

A Snowflake object browser that shows the databases, schemas, tables, and columns the app's service identity is permitted to see. Runs with **owner's rights** — all users see the same set of objects, controlled by what the app's managed role has been granted access to.

Built with Next.js. No Python, no Flask, no Docker knowledge required.

> **Why not caller's rights?** Snowflake App Runtime uses *restricted* caller's rights, which requires an explicit `CALLER USAGE` grant on every database the app accesses on behalf of the caller. That model is impractical for a general-purpose explorer. Owner's rights with appropriate grants on the service identity is the correct pattern here.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`. The app reads Snowflake credentials automatically from your default [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/connecting/specify-credentials) connection in `~/.snowflake/config.toml`. No extra configuration needed if you already have `snow` CLI set up.

To use a specific named connection:

```bash
SNOWFLAKE_CONNECTION_NAME=myconn npm run dev
```

> During local development the app uses your `~/.snowflake/config.toml` default connection. The same databases visible to that connection will appear in the explorer.

## Deploy to Snowflake

### 1. Create your snowflake.yml

`snowflake.yml` holds your personal deployment settings (warehouse, database, compute pool) and is **git-ignored** so it never gets committed. A template with placeholders is provided:

```bash
cp snowflake.yml.example snowflake.yml
```

Open `snowflake.yml` and replace every `<placeholder>` with your values:

| Field | What to put here |
|-------|------------------|
| `identifier.database` | Database where the app object will be created |
| `identifier.schema` | Schema inside that database (e.g. `APPS` or `PUBLIC`) |
| `query_warehouse` | Warehouse the running app uses for queries |
| `build_compute_pool.name` | Compute pool for the build step |
| `service_compute_pool.name` | Compute pool the live service runs on |
| `build_eai.name` | External access integration that allows egress to `registry.npmjs.org` |

### 2. Prerequisites (one-time setup, requires ACCOUNTADMIN or SYSADMIN)

#### Create the external access integration for npm

The build step runs `npm ci` inside Snowflake, which needs to reach `registry.npmjs.org` over HTTPS. Create a network rule and external access integration to allow this:

```sql
-- 1. Network rule: allow HTTPS egress to the npm registry
CREATE OR REPLACE NETWORK RULE npm_network_rule
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('registry.npmjs.org', 'registry.yarnpkg.com');

-- 2. External access integration referencing that rule
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION npm_build_eai
  ALLOWED_NETWORK_RULES = (npm_network_rule)
  ENABLED = TRUE;

-- 3. Grant usage to the role that will run the deploy
GRANT USAGE ON INTEGRATION npm_build_eai TO ROLE <your_deploy_role>;
```

Use `npm_build_eai` (or whatever name you chose) as the `build_eai.name` value in `snowflake.yml`.

> The EAI is only used during the build job. The running app service does not need external network access — it only talks to Snowflake internally.

#### Create a compute pool

A compute pool is the VM cluster that runs both the build job and the live app service. A single `CPU_X64_XS` pool is sufficient for this app.

```sql
-- Create a small CPU compute pool (1–3 nodes, auto-suspends after 30 minutes idle)
CREATE COMPUTE POOL IF NOT EXISTS db_explorer_pool
  MIN_NODES = 1
  MAX_NODES = 3
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_SUSPEND_SECS = 1800
  AUTO_RESUME = TRUE
  COMMENT = 'Compute pool for the Database Explorer app';

-- Grant usage to the role that will run the deploy
GRANT USAGE ON COMPUTE POOL db_explorer_pool TO ROLE <your_deploy_role>;
```

Use `db_explorer_pool` (or whatever name you chose) as both `build_compute_pool.name` and `service_compute_pool.name` in `snowflake.yml`.

**Instance family options** — `CPU_X64_XS` is the smallest and cheapest option. It is appropriate for a low-traffic internal tool. Use `CPU_X64_S` if you expect many concurrent users.

> Compute pools bill by node-hour while nodes are active. `AUTO_SUSPEND_SECS = 1800` means idle nodes shut down after 30 minutes and stop accruing cost. `AUTO_RESUME = TRUE` means the pool wakes up automatically when the app receives a request.

#### Other prerequisites

- `CREATE SNOWFLAKE APP` privilege on the target database and schema

Once `snowflake.yml` is filled in, run:

```bash
snow app deploy
```

If your CLI does not support `snow app` for Snowflake App Runtime yet (check with `snow app setup --help`), use the legacy command:

```bash
snow __app deploy
```

### What does `snow app deploy` do?

It packages, builds, and deploys the app entirely inside Snowflake — you never build a Docker image or push to a container registry yourself.

Here is what happens under the hood:

1. **Upload** — The CLI uploads your source files (as defined in the `artifacts` section of `snowflake.yml`) to a Snowflake internal stage.

2. **Build** — Snowflake runs a short-lived build job on the `build_compute_pool`. This job pulls your source files from the stage and runs the install and build commands from `app.yml`:
   ```
   npm ci --include=dev
   next build
   ```
   The `build_eai` (external access integration) allows the build job to reach `registry.npmjs.org` to download npm packages. Without it the build would fail with a network error.

3. **Deploy** — Once the build succeeds, Snowflake creates (or updates) a running service on the `service_compute_pool`. The service starts your app with:
   ```
   node .next/standalone/server.js
   ```

4. **Endpoint** — Snowflake exposes the service at a public HTTPS URL. Because `app.yml` includes `executeAsCaller: true`, Snowflake injects a per-user token into every request so the app can query Snowflake as the person who opened it.

The whole pipeline is driven by two config files — `snowflake.yml` (what to upload and which infrastructure to use) and `app.yml` (how to build and run the app). No Dockerfile required.

### Open the deployed app

```bash
snow app open
```

Or retrieve the URL without opening a browser:

```bash
snow app open --print-only
```

### View logs

```bash
snow app events --last 100
```

## Project Structure

```
snowflake.yml.example          # Template — copy to snowflake.yml and fill in your values
snowflake.yml                  # Your local deployment config (git-ignored — do not commit)
app.yml                        # Build commands, run command, app metadata
package.json                   # Dependencies
next.config.mjs                # Standalone output, workspace root pin
public/
└── icon.svg                   # App icon
app/
├── layout.tsx                 # HTML shell, page title
├── globals.css                # All styles
├── page.tsx                   # Root page — renders <Explorer />
└── api/
    ├── databases/route.ts     # SHOW DATABASES
    ├── schemas/route.ts       # SHOW SCHEMAS IN DATABASE
    ├── tables/route.ts        # SHOW TABLES IN SCHEMA
    └── columns/route.ts       # SHOW COLUMNS IN TABLE
components/
└── Explorer.tsx               # Three-panel UI (databases → schemas → tables → columns)
lib/
└── snowflake.ts               # Snowflake query helper — do not edit
requirements.md                # Full app spec / Cortex Code regeneration prompt
```

## Key Concepts

- **`querySnowflake(sql)`** — runs SQL as the app's managed service identity (owner's rights). All four API routes use this. To control which databases are visible, grant the application's managed role access to the relevant databases after deploying.
- **`export const dynamic = "force-dynamic"`** — required on every route that queries Snowflake; prevents Next.js from trying to pre-render at build time when the database is unreachable.
- **Client components** cannot call `querySnowflake()` directly. `Explorer.tsx` is a `"use client"` component that calls the API routes via `fetch()`.

## Regenerating with Cortex Code

`requirements.md` contains the full application spec. You can use it as a Cortex Code prompt to regenerate the entire app from scratch:

```
Review the requirements in @requirements.md and build the application.
```
