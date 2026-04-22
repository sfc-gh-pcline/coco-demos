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

**Local development:** The Flask backend connects to Snowflake via the Python connector using a named connection from `~/.snowflake/connections.toml`.

**SPCS deployment:** The same Flask backend detects the SPCS environment and switches to the SQL REST API with the auto-injected OAuth token at `/snowflake/session/token`.

## Prerequisites

- [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/index) (`snow`) with a configured connection
- Node.js 22+
- Python 3.12+
- Docker (for SPCS deployment)

## Local Development

### 1. Install dependencies

```bash
cd app && npm install
pip install flask snowflake-connector-python
```

### 2. Start the backend

```bash
SNOWFLAKE_CONNECTION_NAME=<your-connection> python server/app.py
```

The Flask server starts on port 3001.

### 3. Start the frontend

```bash
cd app && npx vite
```

The Vite dev server starts on port 5173 and proxies `/api` requests to the Flask backend.

### 4. Open the app

Navigate to http://localhost:5173

## Deploy to SPCS

### 1. Build and push the Docker image

```bash
docker build --platform linux/amd64 -t sv-viewer:latest .
docker tag sv-viewer:latest <registry-url>/<db>/<schema>/<repo>/sv-viewer:latest
snow spcs image-registry login --connection <your-connection>
docker push <registry-url>/<db>/<schema>/<repo>/sv-viewer:latest
```

### 2. Create the service

```sql
CREATE SERVICE <db>.<schema>.SV_VIEWER_SERVICE
  IN COMPUTE POOL <pool_name>
  FROM SPECIFICATION $$
spec:
  containers:
  - name: sv-viewer
    image: /<db>/<schema>/<repo>/sv-viewer:latest
    env:
      PORT: "8080"
      SNOWFLAKE_WAREHOUSE: "COMPUTE_WH"
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

### 3. Get the endpoint URL

```sql
SHOW ENDPOINTS IN SERVICE <db>.<schema>.SV_VIEWER_SERVICE;
```

### RBAC

The service only shows semantic views that the service owner role has privileges on. See [`requirements.md`](requirements.md) for detailed grant examples.

## Updating the Service

After code changes, rebuild and push the image, then:

```sql
ALTER SERVICE <db>.<schema>.SV_VIEWER_SERVICE FROM SPECIFICATION $$ ... $$;
```
