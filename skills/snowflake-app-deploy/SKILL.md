---
name: snowflake-app-deploy
description: "Deploy a Next.js or Node.js web app to Snowflake App Runtime (SPCS) using `snow app deploy`. Use when: deploying a local app to Snowflake, setting up Snowflake auth in a Next.js app, generating snowflake.yml or app.yml, injecting caller's rights auth, publishing an app to SPCS. Triggers: deploy my app to Snowflake, snow app deploy, deploy this Next.js app, deploy this app, get this running on Snowflake, publish my app to SPCS, set up Snowflake auth, add caller's rights, configure SPCS deployment."
---

# Snowflake App Runtime — Deploy Skill

Guides the user through deploying a Next.js (or Node.js) app to Snowflake App Runtime via `snow app deploy`. Handles:
- Injecting Snowflake auth code (`lib/snowflake.ts`) with SPCS token support and caller's rights
- Generating `snowflake.yml`, `app.yml`, and patching `next.config.mjs`
- Running `snow app deploy` against the user's active Snowflake connection

Work through each phase in order. Use `system_todo_write` to track progress across phases.

---

## Phase 1 — App Discovery

Run all discovery checks before asking any questions.

### 1a. Verify snow CLI
```bash
snow --version
```
If `snow` is not found, stop and tell the user:
> "The Snowflake CLI (`snow`) is required. Install it from https://docs.snowflake.com/en/developer-guide/snowflake-cli/installation/installation and re-run this skill."

### 1b. Identify the app root
Check if the current working directory has a `package.json`. If not, look one level up and in common subdirectory names. Once found, treat that directory as `APP_ROOT` for all subsequent operations.

Read `package.json` and collect:
- `name` → default app identifier (convert to UPPER_SNAKE_CASE)
- `description` → default app profile description
- Whether `"next"` appears in `dependencies` or `devDependencies` → sets `IS_NEXTJS=true`
- Whether `"snowflake-sdk"` is in `dependencies`
- Whether `"smol-toml"` is in `dependencies`

If `package.json` has no `"next"` dependency and `IS_NEXTJS=false`, inform the user:
> "This skill is optimized for Next.js apps. It will proceed, but the `app.yml` run command may need adjustment for your runtime."

### 1c. Check existing config files
For each file, note whether it already exists:
- `APP_ROOT/snowflake.yml` — `HAS_SNOWFLAKE_YML`
- `APP_ROOT/app.yml` — `HAS_APP_YML`
- `APP_ROOT/lib/snowflake.ts` — `HAS_SNOWFLAKE_TS` (also check `src/lib/snowflake.ts`)
- `APP_ROOT/next.config.mjs` — `HAS_NEXT_CONFIG` (also check `next.config.js`)

If `snowflake.yml` already exists, read it and extract the current values as defaults for Phase 2.

### 1d. Scan artifacts
List the directories and top-level config files that should be included in the `snowflake.yml` artifacts section. Common patterns:

**Directories to include if they exist:** `app/`, `src/`, `components/`, `lib/`, `public/`, `pages/`, `styles/`, `utils/`, `hooks/`

**Root files to include if they exist:** `app.yml`, `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `next.config.mjs`, `next.config.js`, `next-env.d.ts`, `tsconfig.json`, `vite.config.ts`, `vite.config.js`

Build an artifact list in this format:
```yaml
- src: <relative_path>
  dest: ./<relative_path>
```

### 1e. Get current Snowflake connection defaults
Run:
```bash
snow connection list
```
Use the default/active connection to pre-fill warehouse and database defaults for Phase 2.

---

## Phase 2 — Parameter Collection

Collect all deployment parameters in two `ask_user_question` calls.

### Batch A — Snowflake location
```json
{
  "questions": [
    {
      "header": "App Name",
      "question": "What should this app be named in Snowflake? (Used as the Snowflake object identifier — UPPER_SNAKE_CASE recommended.)",
      "type": "text",
      "defaultValue": "<UPPER_SNAKE derived from package.json name>"
    },
    {
      "header": "Database",
      "question": "Which Snowflake database should the app be created in?",
      "type": "text",
      "defaultValue": "<from active connection or existing snowflake.yml>"
    },
    {
      "header": "Schema",
      "question": "Which schema within that database?",
      "type": "text",
      "defaultValue": "APPS"
    }
  ]
}
```

### Batch B — Compute and networking
```json
{
  "questions": [
    {
      "header": "Compute Pool",
      "question": "What compute pool should be used to build and run the app? (Must already exist. Use SHOW COMPUTE POOLS to list available pools.)",
      "type": "text",
      "defaultValue": "<from existing snowflake.yml, else leave blank for user to fill>"
    },
    {
      "header": "Warehouse",
      "question": "Which warehouse should the app use for Snowflake queries?",
      "type": "text",
      "defaultValue": "<from active connection>"
    },
    {
      "header": "Build EAI",
      "question": "What is the External Access Integration name that allows outbound access to registry.npmjs.org during the build step? (e.g. NPM_BUILD_EAI)",
      "type": "text",
      "defaultValue": "NPM_BUILD_EAI"
    },
    {
      "header": "Caller's Rights",
      "question": "Enable caller's rights? Each user who opens the app will run queries under their own Snowflake role — they can only see data their role permits.",
      "type": "options",
      "options": [
        {"label": "Yes — enable caller's rights", "description": "Recommended. Each user's queries run under their own Snowflake role."},
        {"label": "No — owner's rights only", "description": "The app service account runs all queries. Users share one set of permissions."}
      ],
      "defaultAnswer": "Yes — enable caller's rights"
    }
  ]
}
```

Store responses as:
- `APP_NAME` — the Snowflake object identifier
- `APP_DATABASE`
- `APP_SCHEMA`
- `COMPUTE_POOL`
- `QUERY_WAREHOUSE`
- `BUILD_EAI`
- `CALLERS_RIGHTS` — boolean (true if "Yes" was selected)
- `ENTITY_KEY` — `APP_NAME` converted to lower_snake_case (used as the YAML entity key)

---

## Phase 3 — Snowflake Auth Code Injection

### 3a. Install missing npm dependencies

Read the current `package.json` `dependencies`. If either is missing, run:
```bash
cd <APP_ROOT> && npm install snowflake-sdk smol-toml
```
If both are already present, skip.

### 3b. Inject lib/snowflake.ts

**If `HAS_SNOWFLAKE_TS` is true:** Read the existing file. If it contains `SPCS_TOKEN_PATH` or `/snowflake/session/token`, it is already configured for SPCS — skip this step and tell the user "Existing lib/snowflake.ts looks SPCS-compatible — leaving it unchanged."

**If the file is missing or has no SPCS token handling:** Create `APP_ROOT/lib/snowflake.ts` with the following content exactly:

```typescript
/**
 * Snowflake query helper. Call from any server component or route handler:
 *   const rows = await querySnowflake("SELECT ...")
 *   const rows = await querySnowflake("SELECT ...", { callersRights: true })
 *
 * Which helper to use:
 *   - querySnowflake — default for simple, fast queries (small lookups, tight filters,
 *     typically well under ~10 seconds end-to-end).
 *   - querySnowflakeLongRunning — use when the work may exceed ~10 seconds or is
 *     warehouse-heavy (large scans, big aggregations, COPY/EXPORT, long-running
 *     procedures, resuming warehouse, etc.). Submits async, polls by query id, then
 *     fetches rows:
 *       const rows = await querySnowflakeLongRunning("CALL MY_LONG_JOB(...)")
 *   Same auth options (callersRights, pools) apply to both.
 *
 * Logging: by default prints concise lines (auth path, timing, truncated SQL, queryId on
 * success). Set SNOWFLAKE_SDK_QUIET=1 to disable. SDK internal logs stay at ERROR unless
 * you change snowflake.configure below.
 *
 * Auth is auto-detected (in priority order):
 *   1. SPCS token file (/snowflake/session/token) — read fresh on every call
 *   2. SNOWFLAKE_USER + SNOWFLAKE_PASSWORD env vars — password auth (local dev)
 *   3. ~/.snowflake/config.toml default connection — zero-config local dev
 *
 * Connection pooling:
 *   Owner's rights: single pool per process, recreated when the service token rotates.
 *   Caller's rights: one pool per user+role (keyed by combined token), all drained
 *     when the service token rotates.
 *   Local dev pools (password / toml) are shared and never rotated.
 *
 * SPCS caller's rights helpers:
 *   queryWithToken(query, token) — runs a query with an explicit OAuth token.
 *   getServiceToken() — reads the SPCS service token from /snowflake/session/token.
 *   buildCallerRightsToken(callerUserToken) — combines service + caller tokens.
 *
 * Cleanup:
 *   closePool() — drains and destroys all active pools on shutdown.
 */

import { headers } from "next/headers"
import fs from "fs"
import path from "path"
import os from "os"
import snowflake from "snowflake-sdk"

snowflake.configure({
  logLevel: "ERROR",
  ...(process.env.SNOWFLAKE_SDK_DISABLE_OCSP === "true" && { disableOCSPChecks: true, ocspFailOpen: true }),
})

const SPCS_TOKEN_PATH = "/snowflake/session/token"

const LOG_PREFIX = "[snowflake]"

/** Single-line SQL preview for logs (keeps log volume small). */
function previewSql(sql: string, maxLen = 200): string {
  const s = sql.replace(/\s+/g, " ").trim()
  if (s.length <= maxLen) return s
  return `${s.slice(0, maxLen)}…`
}

function sfLogQuiet(): boolean {
  const v = process.env.SNOWFLAKE_SDK_QUIET
  return v === "1" || v === "true"
}

function sfLog(message: string): void {
  if (sfLogQuiet()) return
  console.log(`${LOG_PREFIX} ${message}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** SDK v2 supports these; @types/snowflake-sdk may lag — keep cast at boundary. */
type PollingConnection = snowflake.Connection & {
  getQueryStatus: (queryId: string) => Promise<string>
  getResultsFromQueryId: (opts: { queryId: string }) => Promise<{ streamRows: () => NodeJS.ReadableStream }>
  isStillRunning: (status: string) => boolean
  isAnError: (status: string) => boolean
  getQueryStatusThrowIfError: (queryId: string) => Promise<string>
}

type ExecuteOptions = Parameters<snowflake.Connection["execute"]>[0] & { asyncExec?: boolean }

function streamRowsToArray(statement: { streamRows: () => NodeJS.ReadableStream }): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, any>[] = []
    statement
      .streamRows()
      .on("error", (err: Error) => reject(err))
      .on("data", (row: Record<string, any>) => rows.push(row))
      .on("end", () => resolve(rows))
  })
}

/**
 * Submit `asyncExec`, poll `getQueryStatus` until the warehouse finishes, then fetch rows.
 * Keeps status logs sparse (default: at most once per minute while running).
 */
async function runLongRunningOnConnection(
  conn: PollingConnection,
  query: string,
  options: {
    pollIntervalMs: number
    statusLogIntervalMs: number
    maxWaitMs?: number
  },
): Promise<Record<string, any>[]> {
  const queryId = await new Promise<string>((resolve, reject) => {
    conn.execute({
      sqlText: query,
      asyncExec: true,
      complete: (err, stmt) => {
        if (err) reject(new Error(`Async submit failed: ${err.message}`))
        else resolve(stmt!.getQueryId())
      },
    } as ExecuteOptions)
  })

  const t0 = Date.now()
  sfLog(`long-running submitted queryId=${queryId} sql=${JSON.stringify(previewSql(query))}`)

  let lastStatusLog = t0
  while (true) {
    if (options.maxWaitMs !== undefined && Date.now() - t0 > options.maxWaitMs) {
      throw new Error(
        `Long-running query timed out after ${options.maxWaitMs}ms (queryId=${queryId})`,
      )
    }

    const status = await conn.getQueryStatus(queryId)
    if (conn.isAnError(status)) {
      try {
        await conn.getQueryStatusThrowIfError(queryId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Query failed (queryId=${queryId}): ${msg}`)
      }
      throw new Error(`Query failed (queryId=${queryId}): ${status}`)
    }
    if (!conn.isStillRunning(status)) break

    const now = Date.now()
    if (now - lastStatusLog >= options.statusLogIntervalMs) {
      sfLog(
        `long-running poll queryId=${queryId} status=${status} elapsedMs=${now - t0}`,
      )
      lastStatusLog = now
    }
    await sleep(options.pollIntervalMs)
  }

  const statement = await conn.getResultsFromQueryId({ queryId })
  const rows = await streamRowsToArray(statement)
  sfLog(
    `long-running complete queryId=${queryId} rows=${rows.length} totalMs=${Date.now() - t0}`,
  )
  return rows
}

// --- Connection pool configuration ---

const POOL_CONFIG = {
  min: 0, // Start with no connections (lazy init)
  max: 10, // Scale up to 10 concurrent connections
}

// Owner's rights: single pool, recreated when the service token rotates.
let ownersPool: ReturnType<typeof snowflake.createPool> | null = null
let ownersPoolToken = ""

// Caller's rights: one pool per combined token (user+role), keyed by combined token.
// All pools are drained when the service token rotates.
const callersPool = new Map<string, ReturnType<typeof snowflake.createPool>>()
let callersServiceToken = ""

// Local dev pools.
let passwordPool: ReturnType<typeof snowflake.createPool> | null = null
let tomlPool: ReturnType<typeof snowflake.createPool> | null = null

function baseConfig(): snowflake.ConnectionOptions {
  const application = "SnowflakeAppRuntime"
  const base: snowflake.ConnectionOptions = { application }
  if (process.env.SNOWFLAKE_ACCOUNT) base.account = process.env.SNOWFLAKE_ACCOUNT
  if (process.env.SNOWFLAKE_WAREHOUSE) base.warehouse = process.env.SNOWFLAKE_WAREHOUSE
  if (process.env.SNOWFLAKE_ACCOUNT_URL) base.accessUrl = process.env.SNOWFLAKE_ACCOUNT_URL
  if (!base.accessUrl && process.env.SNOWFLAKE_HOST) {
    base.accessUrl = `https://${process.env.SNOWFLAKE_HOST}`
  }
  if (process.env.SNOWFLAKE_ROLE) base.role = process.env.SNOWFLAKE_ROLE
  if (process.env.SNOWFLAKE_DATABASE) base.database = process.env.SNOWFLAKE_DATABASE
  if (process.env.SNOWFLAKE_SCHEMA) base.schema = process.env.SNOWFLAKE_SCHEMA
  return base
}

// --- ~/.snowflake/connections.toml + config.toml reader ---

interface TomlConnection {
  account?: string
  user?: string
  password?: string
  host?: string
  port?: string | number
  warehouse?: string
  database?: string
  schema?: string
  region?: string
  role?: string
  authenticator?: string
  protocol?: string
  [key: string]: unknown
}

let _tomlConfigCache: { defaultName: string; connections: Record<string, TomlConnection> } | null | undefined

function normalizeConnectionsToml(doc: Record<string, any>): Record<string, TomlConnection> {
  const result: Record<string, TomlConnection> = {}
  for (const [key, val] of Object.entries(doc)) {
    if (key === "default_connection_name" || key === "connections") continue
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      result[key] = val as TomlConnection
    }
  }
  if (typeof doc.connections === "object" && doc.connections !== null && !Array.isArray(doc.connections)) {
    Object.assign(result, doc.connections as Record<string, TomlConnection>)
  }
  return result
}

/**
 * Resolve a Snowflake connection from local TOML config files.
 * Tries connections.toml then config.toml. Result is cached.
 */
export function readTomlDefaultConnection(): TomlConnection | null {
  if (_tomlConfigCache === undefined) {
    _tomlConfigCache = null
    try {
      const { parse } = require("smol-toml") as { parse: (s: string) => Record<string, any> }
      const snowDir = process.env.SNOWFLAKE_HOME ?? path.join(os.homedir(), ".snowflake")

      let defaultName = ""
      let connections: Record<string, TomlConnection> = {}

      const connPath = path.join(snowDir, "connections.toml")
      if (fs.existsSync(connPath)) {
        const doc = parse(fs.readFileSync(connPath, "utf8"))
        if (typeof doc.default_connection_name === "string") defaultName = doc.default_connection_name
        connections = normalizeConnectionsToml(doc)
      }

      const configPath = path.join(snowDir, "config.toml")
      if (fs.existsSync(configPath)) {
        const doc = parse(fs.readFileSync(configPath, "utf8"))
        if (!defaultName && typeof doc.default_connection_name === "string") {
          defaultName = doc.default_connection_name
        }
        if (Object.keys(connections).length === 0) {
          connections = (doc.connections ?? {}) as Record<string, TomlConnection>
        }
      }

      const envOverlay: Partial<TomlConnection> = {}
      const CONN_KEYS = new Set(["account","user","password","database","schema","role","warehouse","protocol","host","port","region","authenticator"])
      for (const [k, v] of Object.entries(process.env)) {
        if (!k.startsWith("SNOWFLAKE_") || k === "SNOWFLAKE_CONNECTION_NAME" || k === "SNOWFLAKE_DEFAULT_CONNECTION_NAME" || k === "SNOWFLAKE_HOME") continue
        const field = k.slice("SNOWFLAKE_".length).toLowerCase()
        if (CONN_KEYS.has(field)) (envOverlay as Record<string, string>)[field] = v!
      }
      if (Object.keys(envOverlay).length > 0) {
        for (const name of Object.keys(connections)) {
          connections[name] = { ...connections[name], ...envOverlay }
        }
      }

      if (process.env.SNOWFLAKE_CONNECTION_NAME) {
        defaultName = process.env.SNOWFLAKE_CONNECTION_NAME
      } else if (process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME) {
        defaultName = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME
      }

      _tomlConfigCache = { defaultName, connections }
    } catch {
      return null
    }
  }

  if (!_tomlConfigCache) return null
  const { defaultName, connections } = _tomlConfigCache
  const names = Object.keys(connections)
  if (names.length === 0) return null
  const conn = (defaultName && connections[defaultName]) || connections[names[0]]
  return conn ?? null
}

/** Reset the connection config cache. Exported for testing only. */
export function resetTomlConfigCache() {
  _tomlConfigCache = undefined
}

function tomlConnectionConfig(conn: TomlConnection): snowflake.ConnectionOptions {
  const normalize = (snowflake as unknown as { normalizeConnectionOptions: (o: Record<string, unknown>) => snowflake.ConnectionOptions }).normalizeConnectionOptions
  const normalized = normalize(conn as Record<string, unknown>)
  if (conn.host && !normalized.accessUrl) {
    const protocol = conn.protocol ?? "https"
    const port = conn.port ? `:${conn.port}` : ""
    normalized.accessUrl = `${protocol}://${conn.host}${port}`
  }
  return normalized
}

// --- Pool helpers ---

function getOwnersPool(serviceToken: string): ReturnType<typeof snowflake.createPool> {
  if (ownersPool && ownersPoolToken !== serviceToken) {
    sfLog("pool: draining owner's-rights pool (SPCS service token rotated)")
    ownersPool.drain()
    ownersPool = null
  }
  if (!ownersPool) {
    sfLog("pool: creating owner's-rights OAuth pool (SPCS)")
    ownersPool = snowflake.createPool(
      { ...baseConfig(), authenticator: "OAUTH", token: serviceToken },
      POOL_CONFIG,
    )
    ownersPoolToken = serviceToken
  }
  return ownersPool
}

function getCallersPool(combinedToken: string, serviceToken: string): ReturnType<typeof snowflake.createPool> {
  if (callersServiceToken !== serviceToken) {
    if (callersPool.size > 0) {
      sfLog(`pool: draining ${callersPool.size} caller's-rights pool(s) (SPCS service token rotated)`)
    }
    for (const pool of callersPool.values()) pool.drain()
    callersPool.clear()
    callersServiceToken = serviceToken
  }
  if (!callersPool.has(combinedToken)) {
    sfLog("pool: creating caller's-rights OAuth pool (SPCS)")
    callersPool.set(
      combinedToken,
      snowflake.createPool(
        { ...baseConfig(), authenticator: "OAUTH", token: combinedToken },
        POOL_CONFIG,
      ),
    )
  }
  return callersPool.get(combinedToken)!
}

function getPasswordPool(): ReturnType<typeof snowflake.createPool> {
  if (!passwordPool) {
    sfLog("pool: creating password-auth pool (SNOWFLAKE_USER)")
    passwordPool = snowflake.createPool(
      {
        ...baseConfig(),
        username: process.env.SNOWFLAKE_USER,
        password: process.env.SNOWFLAKE_PASSWORD,
      },
      POOL_CONFIG,
    )
  }
  return passwordPool
}

function getTomlPool(conn: TomlConnection): ReturnType<typeof snowflake.createPool> {
  if (!tomlPool) {
    sfLog("pool: creating TOML default-connection pool (~/.snowflake)")
    tomlPool = snowflake.createPool({ ...tomlConnectionConfig(conn), ...baseConfig() }, POOL_CONFIG)
  }
  return tomlPool
}

function queryWithPool(
  pool: ReturnType<typeof snowflake.createPool>,
  query: string,
  authTag: string,
): Promise<Record<string, any>[]> {
  return pool.use(async (conn) => {
    const t0 = Date.now()
    sfLog(`query start mode=${authTag} sql=${JSON.stringify(previewSql(query))}`)
    return new Promise<Record<string, any>[]>((res, rej) => {
      conn.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          const ms = Date.now() - t0
          const qid =
            stmt && typeof stmt.getQueryId === "function" ? ` queryId=${stmt.getQueryId()}` : ""
          if (err) {
            sfLog(`query error mode=${authTag} afterMs=${ms}${qid}: ${err.message}`)
            rej(new Error(`Query failed: ${err.message}`))
          } else {
            const out = (rows ?? []) as Record<string, any>[]
            sfLog(`query ok mode=${authTag} rows=${out.length} afterMs=${ms}${qid}`)
            res(out)
          }
        },
      })
    })
  })
}

function queryWithPoolLongRunning(
  pool: ReturnType<typeof snowflake.createPool>,
  query: string,
  authTag: string,
  longOpts: { pollIntervalMs: number; statusLogIntervalMs: number; maxWaitMs?: number },
): Promise<Record<string, any>[]> {
  return pool.use(async (conn) => {
    sfLog(`long-running start mode=${authTag} sql=${JSON.stringify(previewSql(query))}`)
    return runLongRunningOnConnection(conn as unknown as PollingConnection, query, longOpts)
  })
}

// --- One-shot connection helper (used for per-request tokens) ---

function connectAndQuery(
  config: snowflake.ConnectionOptions,
  query: string,
  authTag: string,
): Promise<Record<string, any>[]> {
  const conn = snowflake.createConnection(config)
  const t0 = Date.now()
  sfLog(`query start mode=${authTag} (one-shot) sql=${JSON.stringify(previewSql(query))}`)
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) {
        sfLog(`connect failed mode=${authTag}: ${err.message}`)
        return reject(new Error(`Snowflake connection failed: ${err.message}`))
      }
      conn.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          conn.destroy(() => {})
          const ms = Date.now() - t0
          const qid =
            stmt && typeof stmt.getQueryId === "function" ? ` queryId=${stmt.getQueryId()}` : ""
          if (err) {
            sfLog(`query error mode=${authTag} afterMs=${ms}${qid}: ${err.message}`)
            reject(new Error(`Query failed: ${err.message}`))
          } else {
            const out = (rows ?? []) as Record<string, any>[]
            sfLog(`query ok mode=${authTag} rows=${out.length} afterMs=${ms}${qid}`)
            resolve(out)
          }
        },
      })
    })
  })
}

function connectAndQueryLongRunning(
  config: snowflake.ConnectionOptions,
  query: string,
  authTag: string,
  longOpts: { pollIntervalMs: number; statusLogIntervalMs: number; maxWaitMs?: number },
): Promise<Record<string, any>[]> {
  const conn = snowflake.createConnection(config)
  const t0 = Date.now()
  sfLog(`long-running start mode=${authTag} (one-shot) sql=${JSON.stringify(previewSql(query))}`)
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) {
        sfLog(`connect failed mode=${authTag}: ${err.message}`)
        return reject(new Error(`Snowflake connection failed: ${err.message}`))
      }
      runLongRunningOnConnection(conn as unknown as PollingConnection, query, longOpts)
        .then((rows) => {
          conn.destroy(() => {})
          sfLog(`long-running one-shot done mode=${authTag} totalMs=${Date.now() - t0}`)
          resolve(rows)
        })
        .catch((e) => {
          conn.destroy(() => {})
          reject(e)
        })
    })
  })
}

interface QueryOptions {
  callersRights?: boolean
}

/** Extra options for `querySnowflakeLongRunning` / `queryWithTokenLongRunning`. */
export interface LongRunningQueryOptions extends QueryOptions {
  pollIntervalMs?: number
  statusLogIntervalMs?: number
  maxWaitMs?: number
}

function resolveLongRunningOpts(
  o: LongRunningQueryOptions,
): { pollIntervalMs: number; statusLogIntervalMs: number; maxWaitMs?: number } {
  return {
    pollIntervalMs: o.pollIntervalMs ?? 5000,
    statusLogIntervalMs: o.statusLogIntervalMs ?? 60_000,
    maxWaitMs: o.maxWaitMs,
  }
}

export async function querySnowflake(query: string, options: QueryOptions = {}): Promise<Record<string, any>[]> {
  const { callersRights = false } = options
  const serviceToken = getServiceToken()

  if (serviceToken) {
    if (callersRights) {
      const callerToken = (await headers()).get("sf-context-current-user-token") ?? ""
      if (!callerToken) {
        throw new Error(
          "No sf-context-current-user-token header. Ensure the app is running in SPCS with caller's rights enabled.",
        )
      }
      const combinedToken = serviceToken + "." + callerToken
      return queryWithPool(getCallersPool(combinedToken, serviceToken), query, "spcs-caller")
    }
    return queryWithPool(getOwnersPool(serviceToken), query, "spcs-owner")
  }

  if (callersRights) {
    console.warn("[snowflake] useCallersRights=true has no effect outside SPCS — using local dev credentials")
  }

  if (process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PASSWORD) {
    return queryWithPool(getPasswordPool(), query, "password")
  }

  const tomlConn = readTomlDefaultConnection()
  if (tomlConn) {
    return queryWithPool(getTomlPool(tomlConn), query, "toml")
  }

  throw new Error(
    "No Snowflake credentials found. Provide one of:\n" +
    "  1. SPCS token file at /snowflake/session/token\n" +
    "  2. SNOWFLAKE_USER + SNOWFLAKE_PASSWORD env vars\n" +
    "  3. ~/.snowflake/config.toml with a default connection"
  )
}

export async function querySnowflakeLongRunning(
  query: string,
  options: LongRunningQueryOptions = {},
): Promise<Record<string, any>[]> {
  const { callersRights = false, ...longRest } = options
  const longOpts = resolveLongRunningOpts({ callersRights, ...longRest })
  const serviceToken = getServiceToken()

  if (serviceToken) {
    if (callersRights) {
      const callerToken = (await headers()).get("sf-context-current-user-token") ?? ""
      if (!callerToken) {
        throw new Error(
          "No sf-context-current-user-token header. Ensure the app is running in SPCS with caller's rights enabled.",
        )
      }
      const combinedToken = serviceToken + "." + callerToken
      return queryWithPoolLongRunning(
        getCallersPool(combinedToken, serviceToken),
        query,
        "spcs-caller",
        longOpts,
      )
    }
    return queryWithPoolLongRunning(getOwnersPool(serviceToken), query, "spcs-owner", longOpts)
  }

  if (callersRights) {
    console.warn("[snowflake] useCallersRights=true has no effect outside SPCS — using local dev credentials")
  }

  if (process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PASSWORD) {
    return queryWithPoolLongRunning(getPasswordPool(), query, "password", longOpts)
  }

  const tomlConn = readTomlDefaultConnection()
  if (tomlConn) {
    return queryWithPoolLongRunning(getTomlPool(tomlConn), query, "toml", longOpts)
  }

  throw new Error(
    "No Snowflake credentials found. Provide one of:\n" +
    "  1. SPCS token file at /snowflake/session/token\n" +
    "  2. SNOWFLAKE_USER + SNOWFLAKE_PASSWORD env vars\n" +
    "  3. ~/.snowflake/config.toml with a default connection"
  )
}

// --- SPCS caller's rights helpers ---

export function getServiceToken(): string {
  try {
    return fs.readFileSync(SPCS_TOKEN_PATH, "utf8").trim()
  } catch {
    return ""
  }
}

export function buildCallerRightsToken(callerUserToken: string): string {
  const serviceToken = getServiceToken()
  if (!serviceToken) {
    throw new Error("No SPCS service token available at " + SPCS_TOKEN_PATH)
  }
  return serviceToken + "." + callerUserToken
}

export async function queryWithToken(query: string, token: string): Promise<Record<string, any>[]> {
  return connectAndQuery({ ...baseConfig(), authenticator: "OAUTH", token }, query, "oauth-token")
}

export async function queryWithTokenLongRunning(
  query: string,
  token: string,
  options: Omit<LongRunningQueryOptions, "callersRights"> = {},
): Promise<Record<string, any>[]> {
  const longOpts = resolveLongRunningOpts({ callersRights: false, ...options })
  return connectAndQueryLongRunning(
    { ...baseConfig(), authenticator: "OAUTH", token },
    query,
    "oauth-token",
    longOpts,
  )
}

// --- Pool lifecycle ---

export async function closePool(): Promise<void> {
  const drainPromises: Promise<void>[] = []

  if (ownersPool) {
    const p = ownersPool
    ownersPool = null
    ownersPoolToken = ""
    drainPromises.push(p.drain())
  }

  for (const pool of callersPool.values()) {
    drainPromises.push(pool.drain())
  }
  callersPool.clear()

  if (passwordPool) {
    const p = passwordPool
    passwordPool = null
    drainPromises.push(p.drain())
  }

  if (tomlPool) {
    const p = tomlPool
    tomlPool = null
    drainPromises.push(p.drain())
  }

  await Promise.all(drainPromises)
}
```

> **Note for non-Next.js apps:** If `headers` from `"next/headers"` is not available, replace the import with a custom request-context mechanism or remove the caller's rights section and use owner's rights only.

---

## Phase 4 — Config File Generation

### 4a. Patch next.config.mjs (Next.js only)

**Required for SPCS:** Next.js must be built with `output: 'standalone'` so the server can run as a single Node process.

If `next.config.mjs` (or `next.config.js`) exists, read it. If it already contains `output: 'standalone'`, skip. If not, add it.

**Minimal next.config.mjs if the file does not exist:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

export default nextConfig
```

**If the file exists but lacks `output: 'standalone'`**, patch it by inserting `output: 'standalone',` into the config object. Show the diff to the user before writing.

### 4b. Generate snowflake.yml

If `HAS_SNOWFLAKE_YML` is true, ask:
```json
{
  "questions": [{
    "header": "Overwrite?",
    "question": "snowflake.yml already exists. What would you like to do?",
    "type": "options",
    "options": [
      {"label": "Overwrite with new config", "description": "Replace with the values you just provided."},
      {"label": "Keep existing", "description": "Skip regeneration — use the file as-is."}
    ]
  }]
}
```

Write `APP_ROOT/snowflake.yml`:
```yaml
definition_version: "2"

entities:
  <ENTITY_KEY>:
    type: snowflake-app
    identifier:
      name: <APP_NAME>
      database: <APP_DATABASE>
      schema: <APP_SCHEMA>
    artifacts:
<ARTIFACT_LIST — one "- src: / dest:" pair per detected directory/file>
    query_warehouse: <QUERY_WAREHOUSE>
    build_compute_pool:
      name: <COMPUTE_POOL>
    service_compute_pool:
      name: <COMPUTE_POOL>
    build_eai:
      name: <BUILD_EAI>
```

Always include `app.yml` in the artifacts list regardless of what was auto-detected.

### 4c. Generate app.yml

If `HAS_APP_YML` is true and it already contains a `run:` section, confirm before overwriting (same pattern as 4b).

Write `APP_ROOT/app.yml`:
```yaml
install:
  commands:
    - ["npm", "ci", "--include=dev"]

run:
  command: ["node", ".next/standalone/server.js"]

profile:
  label: "<package.json name or APP_NAME in Title Case>"
  description: "<package.json description, or 'Snowflake App Runtime application'>"
<if public/icon.svg exists:>
  icon: public/icon.svg
<end if>
```

**If `IS_NEXTJS` is false**, warn the user that the run command above is for Next.js and ask them to specify the correct start command for their app (e.g., `node server.js`, `node dist/index.js`). Substitute their answer for `["node", ".next/standalone/server.js"]`.

**Note on caller's rights:** There is no `executeAsCaller` field in `app.yml`. Caller's rights is handled entirely in `lib/snowflake.ts` — Snowflake App Runtime automatically injects a per-user `sf-context-current-user-token` header on every request, and the helper combines it with the service token to authenticate as the calling user. No `app.yml` configuration is needed. To use caller's rights in an API route, pass `{ callersRights: true }` to `querySnowflake`. If `CALLERS_RIGHTS` is true, tell the user this after writing the file.

---

## Phase 5 — Deploy

### 5a. Pre-flight summary

Before running the deploy, print a summary of exactly what will happen:

```
Ready to deploy:
  App:           <APP_DATABASE>.<APP_SCHEMA>.<APP_NAME>
  Compute pool:  <COMPUTE_POOL>
  Warehouse:     <QUERY_WAREHOUSE>
  Build EAI:     <BUILD_EAI>
  Caller's rights: <yes/no>

Files written:
  ✓ snowflake.yml
  ✓ app.yml
  ✓ next.config.mjs (standalone output)
  ✓ lib/snowflake.ts (Snowflake auth helper)

Running: snow app deploy
```

### 5b. Run deploy

```bash
cd <APP_ROOT> && snow app deploy
```

Run this with `run_in_background: false` so output streams in real time. Capture exit code.

**On success (exit code 0):**

Print:
```
Deployment complete.

Your app is available at:
  https://<account-url>.snowflakecomputing.app

To check service status:
  SHOW SERVICES IN SCHEMA <APP_DATABASE>.<APP_SCHEMA>;

To grant a role access to the app:
  GRANT SERVICE ROLE <APP_DATABASE>.<APP_SCHEMA>.<APP_NAME>!APP_PUBLIC TO ROLE <ROLE_NAME>;

To view live logs:
  snow app logs
  -- or --
  CALL SYSTEM$GET_SERVICE_LOGS('<APP_DATABASE>.<APP_SCHEMA>.<APP_NAME>', 0, 'app');

To redeploy after code changes:
  snow app deploy
```

Obtain the real app URL by running:
```bash
snow app open --url-only 2>/dev/null || snow connection show
```
If that fails, instruct the user to find the URL in Snowsight under Apps > Snowflake App Runtime.

**On failure (non-zero exit code):**

Parse the error output and provide targeted remediation:

| Error contains | Likely cause | Fix |
|---|---|---|
| `compute pool.*not found` or `does not exist` | Pool name is wrong or pool not created | Run `SHOW COMPUTE POOLS;` to list pools. Create one if needed (see below). |
| `compute pool.*suspended` or `SUSPENDED` | Pool is stopped | Run `ALTER COMPUTE POOL <POOL> RESUME;` then retry. |
| `external access integration.*not found` | EAI name is wrong | Run `SHOW INTEGRATIONS;` to list available EAIs. |
| `npm.*ENOTFOUND` or `network` during build | EAI missing or not allowing registry.npmjs.org | Verify the EAI allows outbound to `registry.npmjs.org:443`. |
| `Insufficient privileges` | Missing role grants | The active role needs `CREATE SERVICE`, `USAGE ON COMPUTE POOL`, `USAGE ON INTEGRATION`. |
| `output.*standalone` | next.config.mjs not patched | Re-check the next.config.mjs patch from Phase 4a. |

**Compute pool creation hint** (print if pool-not-found error occurs):
```sql
-- Create a small CPU compute pool suitable for most web apps:
CREATE COMPUTE POOL <COMPUTE_POOL>
  MIN_NODES = 1
  MAX_NODES = 3
  INSTANCE_FAMILY = CPU_X64_XS;
```

---

## Edge Cases

- **No `lib/` directory:** Create it before writing `lib/snowflake.ts`.
- **`src/lib/` layout:** Some Next.js apps use `src/app/`, `src/components/`, etc. If detected, write to `src/lib/snowflake.ts` instead and include `src/` in artifacts rather than subdirectories.
- **Monorepo:** If `package.json` is not in the current directory (e.g., apps are under `apps/my-app/`), ask the user to `cd` into the app directory first.
- **`snowflake-sdk` native modules in Alpine builds:** The SDK v2 compiles native bindings. This works in the Snowflake App Runtime build environment. No action needed.
- **Existing `app.yml` with different run command:** Read and show the existing content, then ask before overwriting.

---

## Important Notes

- Always run `snow app deploy` from `APP_ROOT` (the directory containing `snowflake.yml`).
- `snow app deploy` uses the active `snow` CLI connection. Confirm with `snow connection list` that the correct connection is active.
- Caller's rights requires no special `app.yml` configuration. It is controlled entirely in `lib/snowflake.ts` by combining the SPCS service token with the `sf-context-current-user-token` header that Snowflake automatically injects on every request. Pass `{ callersRights: true }` to `querySnowflake` in any route that should run under the calling user's Snowflake role.
- The Snowflake App Runtime build step runs `npm ci --include=dev` inside the compute pool. `node_modules/` should NOT be in the artifacts list — it will be rebuilt from `package.json` during the build.
