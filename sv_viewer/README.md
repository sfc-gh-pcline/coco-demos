# Semantic View Explorer

A web application for browsing, searching, and inspecting [Snowflake Semantic View](https://docs.snowflake.com/en/sql-reference/sql/create-semantic-view) definitions. View logical tables, dimensions, facts, metrics, relationships, and verified queries across all semantic views in your account.

## Building from Requirements with Cortex Code

This repo includes a detailed [`requirements.md`](requirements.md) that describes the full application — functional requirements, technical stack, SPCS deployment, and RBAC patterns. You can use it as a prompt for [Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) to generate the entire application from scratch or to extend it:

```
Review the requirements in @requirements.md and build the application.
```

This is how this application was originally built. The requirements doc serves as both documentation and a reproducible prompt.

## Architecture

```
app/          React 19 + TypeScript + Vite + Tailwind CSS v4
server/       Python Flask API (dual-mode: local dev + SPCS)
Dockerfile    Multi-stage build for SPCS deployment
```

**Local deployment:** The Flask backend connects to Snowflake via the Python connector using a named connection from `~/.snowflake/connections.toml`.

**SPCS deployment:** The same Flask backend detects the SPCS environment and switches to the SQL REST API with the auto-injected OAuth token at `/snowflake/session/token`.

## Prerequisites

- [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/index) (`snow`) with a configured connection
- Node.js 22+
- Python 3.12+
- Docker Desktop (for SPCS deployment)

## Local Deployment

### 1. Install dependencies

```bash
cd app && npm install
```

For the Python backend, use a virtual environment to ensure you get a recent version of the Snowflake connector (3.x versions do not support `connection_name` with PAT authentication):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask snowflake-connector-python
```

### 2. Start the backend

```bash
source .venv/bin/activate   # if not already active
SNOWFLAKE_CONNECTION_NAME=<your-connection> python server/app.py
```

`<your-connection>` is the name of a connection section in your `~/.snowflake/connections.toml` file. For example, if your file contains `[myaccount]`, use `myaccount`.

The Flask server starts on port 3001.

### 3. Start the frontend

```bash
cd app && npx vite
```

The Vite dev server starts on port 5173 and proxies `/api` requests to the Flask backend.

### 4. Open the app

Navigate to http://localhost:5173

### 5. Tear down

When finished, deactivate the virtual environment:

```bash
deactivate
```

This returns your shell to the system Python. The `.venv` directory remains on disk so you can reactivate it later without reinstalling packages. To remove it entirely:

```bash
rm -rf .venv
```

---

## Deploy to SPCS

Snowpark Container Services (SPCS) runs your Docker container inside Snowflake's managed infrastructure. The deployment process has four phases: creating the required Snowflake objects, building and pushing the Docker image, deploying the service, and granting access.

### Required permissions

The role you use to run these steps needs the following privileges:

| Privilege | Object | Required for |
|---|---|---|
| `CREATE DATABASE` | Account | Step 1 (if creating a new database) |
| `CREATE SCHEMA` | Database | Step 1 (if creating a new schema) |
| `CREATE IMAGE REPOSITORY` | Schema | Step 2 |
| `CREATE COMPUTE POOL` | Account | Step 3 |
| `BIND SERVICE ENDPOINT` | Account | Step 6 (required for `public: true` endpoints) |
| `CREATE SERVICE` | Schema | Step 6 |
| `USAGE` | Warehouse | Step 6 (warehouse used by the service) |

The easiest path for a first deployment is to use the `SYSADMIN` or `ACCOUNTADMIN` role, which has all of these by default.

---

Throughout this section, replace the following placeholders with your actual values:

| Placeholder | Example | Description |
|---|---|---|
| `<connection>` | `myaccount` | Your Snowflake CLI connection name |
| `<db>` | `MY_DB` | Database to deploy into |
| `<schema>` | `APPS` | Schema to deploy into |
| `<repo>` | `SV_IMAGE_REPO` | Name for the image repository |
| `<pool>` | `SV_COMPUTE_POOL` | Name for the compute pool |
| `<warehouse>` | `COMPUTE_WH` | Warehouse the service uses for queries |

---

### Step 1 — Create the database and schema

Skip this step if you already have a database and schema to deploy into.

```sql
CREATE DATABASE IF NOT EXISTS <db>;
CREATE SCHEMA IF NOT EXISTS <db>.<schema>;
```

---

### Step 2 — Create an image repository

An image repository is a private Docker registry hosted inside Snowflake. It stores the container images that SPCS pulls when starting your service.

First, check whether a repository already exists in the schema:

```sql
SHOW IMAGE REPOSITORIES IN SCHEMA <db>.<schema>;
```

If the output is empty, or if you want a dedicated repository for this app, create one:

```sql
CREATE IMAGE REPOSITORY IF NOT EXISTS <db>.<schema>.<repo>;
```

Then retrieve the registry URL from the `repository_url` column — you will need it to tag and push your image:

```sql
SHOW IMAGE REPOSITORIES IN SCHEMA <db>.<schema>;
```

The URL looks like:

```
<org>-<account>.registry.snowflakecomputing.com/<db>/<schema>/<repo>
```

Copy the full value for use in Step 5.

---

### Step 3 — Create a compute pool

A compute pool is a set of virtual machines that runs your containers. `CPU_X64_XS` is the smallest instance type and is sufficient for this application.

```sql
CREATE COMPUTE POOL IF NOT EXISTS <pool>
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = CPU_X64_XS;
```

Wait for the pool to reach `ACTIVE` status before continuing. This typically takes 2–5 minutes the first time:

```sql
DESCRIBE COMPUTE POOL <pool>;
```

Look for `state = ACTIVE` in the output. Re-run the command until it appears.

---

### Step 4 — Authenticate Docker with the Snowflake registry

Log Docker in to your Snowflake image registry using the Snowflake CLI:

```bash
snow spcs image-registry login --connection <connection>
```

---

### Step 5 — Build and push the Docker image

Build the image for the `linux/amd64` platform (required by SPCS regardless of your local machine architecture), tag it with the full registry URL, and push it:

```bash
docker build --platform linux/amd64 -t sv-viewer:latest .

docker tag sv-viewer:latest <repository_url>/sv-viewer:latest

docker push <repository_url>/sv-viewer:latest
```

Replace `<repository_url>` with the value you copied in Step 2.

---

### Step 6 — Create the service

The service spec tells SPCS how to run your container. Replace `<db>`, `<schema>`, `<repo>`, `<pool>`, and `<warehouse>` with your values.

```sql
CREATE SERVICE <db>.<schema>.SV_VIEWER_SERVICE
  IN COMPUTE POOL <pool>
  FROM SPECIFICATION $$
spec:
  containers:
  - name: sv-viewer
    image: /<db>/<schema>/<repo>/sv-viewer:latest
    env:
      PORT: "8080"
      SNOWFLAKE_WAREHOUSE: "<warehouse>"
    resources:
      requests:
        memory: 512Mi
        cpu: 500m
      limits:
        memory: 1Gi
        cpu: 1000m
    readinessProbe:
      port: 8080
      path: /
  endpoints:
  - name: app
    port: 8080
    public: true
$$
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1;
```

> **Note:** The image path in the spec starts with a `/` and uses the path portion of the registry URL (without the hostname).

---

### Step 7 — Wait for the service to start

SPCS pulls the image and starts the container, which takes a few minutes. Monitor the service status:

```sql
SELECT SYSTEM$GET_SERVICE_STATUS('<db>.<schema>.SV_VIEWER_SERVICE');
```

Wait until the status shows `READY`. You can also view recent container logs to confirm the app started:

```sql
CALL SYSTEM$GET_SERVICE_LOGS('<db>.<schema>.SV_VIEWER_SERVICE', 0, 'sv-viewer', 100);
```

You should see a line like `Listening at: http://0.0.0.0:8080` in the output.

---

### Step 8 — Grant access

By default, only the role that created the service can access it. Grant `USAGE` on the service to any role that should be able to reach the app:

```sql
GRANT USAGE ON SERVICE <db>.<schema>.SV_VIEWER_SERVICE TO ROLE <role>;
```

The app shows only the semantic views that the **service owner's role** has access to. If your semantic views live in other databases, grant the service owner's role the necessary `USAGE` and `SELECT` privileges on those databases, schemas, and semantic views.

---

### Step 9 — Get the URL and log in

Retrieve the public endpoint URL:

```sql
SHOW ENDPOINTS IN SERVICE <db>.<schema>.SV_VIEWER_SERVICE;
```

Copy the `ingress_url` value and open it in your browser. Snowflake will redirect you to authenticate with your Snowflake credentials. After logging in you will be taken directly to the app.

---

## Updating the Service

After making code changes, rebuild and push the image (Steps 4–5 above), then reload the service from the updated spec:

```sql
ALTER SERVICE <db>.<schema>.SV_VIEWER_SERVICE
  FROM SPECIFICATION $$
spec:
  containers:
  - name: sv-viewer
    image: /<db>/<schema>/<repo>/sv-viewer:latest
    env:
      PORT: "8080"
      SNOWFLAKE_WAREHOUSE: "<warehouse>"
    resources:
      requests:
        memory: 512Mi
        cpu: 500m
      limits:
        memory: 1Gi
        cpu: 1000m
    readinessProbe:
      port: 8080
      path: /
  endpoints:
  - name: app
    port: 8080
    public: true
$$;
```

SPCS will pull the new image and restart the container automatically.
