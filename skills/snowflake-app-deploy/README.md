# snowflake-app-deploy — Cortex Code Skill

A [Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) skill that deploys a Next.js (or Node.js) web app to [Snowflake App Runtime](https://docs.snowflake.com/en/developer-guide/snowflake-apps/overview) via `snow app deploy`.

Aimed at developers who have vibe-coded an app in Cortex Code and want to ship it to Snowflake without needing to understand SPCS, Docker registries, or service spec files.

---

## What it does

When you describe your app and say something like "deploy this to Snowflake", the skill:

1. **Discovers** your project — reads `package.json`, checks for existing config files, scans directories to build an artifact list
2. **Collects parameters** — asks for your app name, database, schema, compute pool, warehouse, and build EAI through a guided prompt sequence
3. **Injects Snowflake auth** — writes `lib/snowflake.ts`, a production-ready helper that handles SPCS token auth, caller's rights (each user queries Snowflake under their own role), and local-dev fallbacks
4. **Generates config files** — creates `snowflake.yml`, `app.yml`, and patches `next.config.mjs` to set `output: 'standalone'`
5. **Deploys** — runs `snow app deploy` and reports the live URL, access grant SQL, and log commands

On failure, it maps common error patterns (pool suspended, EAI missing, missing privileges) to specific remediation steps.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/installation/installation) (`snow`) | Install via `pip install snowflake-cli` or Homebrew |
| Active `snow` connection | Run `snow connection list` to verify |
| Snowflake compute pool | Must already exist. `SHOW COMPUTE POOLS;` lists available ones. |
| External Access Integration (EAI) | Needs outbound access to `registry.npmjs.org:443` for the `npm ci` build step |
| Node.js + npm | For local `npm install` of Snowflake SDK deps |

The active Snowflake role needs:
- `CREATE SERVICE` on the target schema
- `USAGE ON COMPUTE POOL <pool>`
- `USAGE ON INTEGRATION <eai>`

---

## Installation

### Option A — Cortex Code `github-plugin-installer` skill

Open Cortex Code and run:

```
Install a skill from GitHub: https://github.com/<your-org>/demos/tree/main/skills/snowflake-app-deploy
```

Cortex Code will clone the directory and install it automatically.

### Option B — Manual install (one command)

```bash
mkdir -p ~/.snowflake/cortex/skills/snowflake-app-deploy
curl -fsSL https://raw.githubusercontent.com/<your-org>/demos/main/skills/snowflake-app-deploy/SKILL.md \
  -o ~/.snowflake/cortex/skills/snowflake-app-deploy/SKILL.md
```

### Option C — Clone and symlink (for local development)

```bash
git clone https://github.com/<your-org>/demos.git ~/demos
mkdir -p ~/.snowflake/cortex/skills
ln -s ~/demos/skills/snowflake-app-deploy ~/.snowflake/cortex/skills/snowflake-app-deploy
```

Changes to the cloned `SKILL.md` take effect immediately — no reinstall needed.

---

## Usage

Open a project directory in Cortex Code (the folder containing `package.json`) and say any of:

```
Deploy this app to Snowflake
Set up Snowflake auth and deploy
Add caller's rights and publish to SPCS
snow app deploy — walk me through it
```

The skill will ask for the values it needs and handle the rest.

### Example conversation

```
You:  Deploy this Next.js app to Snowflake

CoCo: [reads package.json, scans directories, checks for snowflake.yml]

      I found a Next.js app: "inventory-dashboard".
      Let me collect a few deployment details.

      [asks: App Name, Database, Schema]
      [asks: Compute Pool, Warehouse, Build EAI, Caller's Rights]

      Writing lib/snowflake.ts... done
      Writing snowflake.yml... done
      Writing app.yml... done
      Patching next.config.mjs (output: standalone)... done

      Running: snow app deploy

      Deployment complete.
      App URL: https://acme-aws-us-east-1.snowflakecomputing.app

      To grant access:
        GRANT SERVICE ROLE MY_DB.APPS.INVENTORY_DASHBOARD!APP_PUBLIC TO ROLE ANALYST;
```

---

## Configuration files generated

### `snowflake.yml`

The top-level Snowflake CLI project file. Declares the app identifier, compute pools, warehouse, build EAI, and which source files to upload.

```yaml
definition_version: "2"

entities:
  inventory_dashboard:
    type: snowflake-app
    identifier:
      name: INVENTORY_DASHBOARD
      database: MY_DB
      schema: APPS
    artifacts:
      - src: app
        dest: ./app
      - src: lib
        dest: ./lib
      - src: app.yml
        dest: ./app.yml
      - src: package.json
        dest: ./package.json
      # ... more files
    query_warehouse: MY_WAREHOUSE
    build_compute_pool:
      name: MY_COMPUTE_POOL
    service_compute_pool:
      name: MY_COMPUTE_POOL
    build_eai:
      name: NPM_BUILD_EAI
```

### `app.yml`

Runtime configuration for the deployed service.

```yaml
install:
  commands:
    - ["npm", "ci", "--include=dev"]

run:
  command: ["node", ".next/standalone/server.js"]

profile:
  label: "Inventory Dashboard"
  description: "Real-time inventory tracking"
  icon: public/icon.svg
```

### `lib/snowflake.ts`

A production-ready Snowflake connection helper. Automatically:
- Uses the SPCS OAuth token (`/snowflake/session/token`) when running in production
- Combines the service token with the per-user `sf-context-current-user-token` header for caller's rights
- Falls back to `SNOWFLAKE_USER` + `SNOWFLAKE_PASSWORD` env vars or `~/.snowflake/config.toml` for local development

Import it in any Next.js API route or server component:

```typescript
import { querySnowflake } from "@/lib/snowflake"

// Owner's rights (service account)
const rows = await querySnowflake("SELECT * FROM MY_TABLE LIMIT 10")

// Caller's rights (runs as the logged-in user's role)
const rows = await querySnowflake("SHOW DATABASES", { callersRights: true })
```

---

## Caller's rights — how it works

Caller's rights requires no special `app.yml` configuration. It is handled entirely in `lib/snowflake.ts`.

When `callersRights: true` is passed to `querySnowflake`:

1. Snowflake injects a service token into the container at `/snowflake/session/token`
2. For each web request, Snowflake App Runtime automatically injects a per-user token in the `sf-context-current-user-token` HTTP header
3. `lib/snowflake.ts` combines both tokens and authenticates with the Snowflake SDK
4. The query runs under the calling user's active role — they can only see what their grants allow

This means you can ship one app to everyone and Snowflake's existing RBAC handles data access automatically.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `snow: command not found` | Install Snowflake CLI: `pip install snowflake-cli` |
| `Compute pool does not exist` | Run `SHOW COMPUTE POOLS;` to find the correct name, or create one (see below) |
| `Compute pool is SUSPENDED` | Run `ALTER COMPUTE POOL <NAME> RESUME;` and wait for it to reach ACTIVE state |
| `External access integration not found` | Run `SHOW INTEGRATIONS;` — the EAI must allow outbound to `registry.npmjs.org:443` |
| `npm ENOTFOUND registry.npmjs.org` | The build EAI is missing or incorrectly scoped |
| `Insufficient privileges` | Grant the deploying role: `USAGE ON COMPUTE POOL`, `USAGE ON INTEGRATION`, `CREATE SERVICE` |
| App builds but crashes on start | Check `next.config.mjs` has `output: 'standalone'` |

**Create a compute pool (if you need one):**
```sql
CREATE COMPUTE POOL MY_COMPUTE_POOL
  MIN_NODES = 1
  MAX_NODES = 3
  INSTANCE_FAMILY = CPU_X64_XS;
```

**View live service logs:**
```bash
snow app logs
```
```sql
CALL SYSTEM$GET_SERVICE_LOGS('MY_DB.APPS.MY_APP', 0, 'app');
```

---

## Redeploy after code changes

```bash
snow app deploy
```

The skill does not need to be re-invoked. `snow app deploy` is idempotent — it rebuilds the image and updates the running service.

---

## Scope and limitations (v1)

- Optimized for **Next.js** apps. Other Node runtimes work but the `app.yml` run command may need manual adjustment.
- Assumes a **single compute pool** for both build and service. Separate pools can be specified by editing `snowflake.yml` after generation.
- Does not create compute pools or EAIs — these must exist before deploying.
- Targets the **Snowflake App Runtime** (`snow app deploy`). For raw Docker/SPCS deployments without the App Runtime layer, use the `deploy-to-spcs` skill instead.
