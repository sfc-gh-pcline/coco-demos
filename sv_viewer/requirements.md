# Semantic View Definitions Viewer — Requirements

## Overview

A React-based web application that allows users to browse, search, and inspect Semantic View definitions in a structured and readable interface.

---

## Functional Requirements

### 1. View Listing
- Display a list/catalog of all available Semantic View definitions
- Show key metadata for each view (e.g., name, database, schema, description, version, last modified)
- Support pagination or infinite scroll for large collections

### 2. View Detail
- Display the full definition of a selected Semantic View
- Render structured fields such as:
  - Name and description
  - Schema / field definitions
  - Data types and constraints
  - Relationships and references to other views
  - Metadata (author, version, timestamps)

### 3. Search & Filter
- Full-text search across view names and descriptions
- Filter by tags, categories, data types, or other metadata
- Sort results by name, date modified, or relevance

### 4. Navigation
- Breadcrumb navigation for drilling into nested definitions
- Ability to navigate between related/referenced views
- Browser history support (back/forward)

### 5. Detail View Interactivity
- **Table Detail Panels**: Each logical table card is expandable to reveal full details — description (comment), synonyms, and primary key
- **Dimension/Fact/Metric Descriptions**: Rows with metadata (comment, synonyms) are expandable — clicking reveals an inline detail panel below the row
- **Sortable Columns**: All tabular lists (dimensions, facts, metrics) support click-to-sort on column headers (ascending/descending toggle)

### 6. Visualization (Optional / Future)
- Graphical representation of relationships between views
- Expandable/collapsible tree or graph view of field hierarchies

---

## Non-Functional Requirements

### Performance
- Initial page load under 2 seconds
- Search results returned within 500ms

### Usability
- Responsive design supporting desktop and tablet viewports
- Accessible UI following WCAG 2.1 AA standards
- Clear visual hierarchy for nested or complex definitions

### Maintainability
- Component-based architecture using React functional components and hooks
- Well-documented components and utilities
- Unit tests for core components and logic

---

## Technical Requirements

### Frontend
- **Framework:** React (v18+)
- **Language:** TypeScript
- **Styling:** CSS Modules or a utility-first framework (e.g., Tailwind CSS)
- **State Management:** React Context or a lightweight library (e.g., Zustand)
- **Routing:** React Router v6+

### Data
- Consume Semantic View definitions via the Snowflake SQL REST API (`/api/v2/statements`)
- Use `SHOW SEMANTIC VIEWS IN ACCOUNT` to enumerate available views (filtered by service role privileges)
- Use `DESCRIBE SEMANTIC VIEW <name>` to retrieve full definitions (logical tables, dimensions, facts, metrics, relationships, verified queries)
- Support for JSON formatted API responses
- Handle loading, error, and empty states gracefully

### Testing
- Unit tests with Jest and React Testing Library
- End-to-end tests with Playwright or Cypress (optional)

---

## Deployment — Snowpark Container Services (SPCS)

### Container Architecture
- Package as a Docker container with a multi-stage build (Node build stage → lightweight serve stage)
- Serve the built React SPA via a static file server (e.g., Nginx or `serve`)
- Include an API proxy/backend layer (e.g., Express or Nginx reverse proxy) to call the Snowflake SQL REST API on behalf of the frontend
- Authenticate to Snowflake using the auto-injected SPCS OAuth token at `/snowflake/session/token`
- Connect using the `SNOWFLAKE_HOST` environment variable (auto-injected by SPCS)

### Service Spec
- Define a `spec.yaml` for `CREATE SERVICE` with:
  - A single container running the app image
  - A public HTTP endpoint for user access
  - Resource limits appropriate for a lightweight web app (e.g., 1 CPU, 2 GiB memory)

### Role-Based View Filtering
- The SPCS service runs under the **owner role of the service** (the role used in the `CREATE SERVICE` statement)
- `SHOW SEMANTIC VIEWS IN ACCOUNT` returns only the semantic views for which the service role has at least one privilege — this inherently filters the catalog to only views the role can see
- `DESCRIBE SEMANTIC VIEW` also requires at least one privilege on the semantic view — views without access will be excluded automatically
- No application-level authorization logic is needed; Snowflake's RBAC enforces the filter

### Required Permissions for the Service Role

The role under which the service is created needs the following grants:

#### Snowflake Object Privileges
| Privilege | Object | Purpose |
|-----------|--------|---------|
| `USAGE` | Compute pool | Run the service containers |
| `USAGE` | Warehouse | Execute SQL statements via the REST API |
| `USAGE` | Database(s) containing semantic views | Access parent database |
| `USAGE` | Schema(s) containing semantic views | Access parent schema |
| Any privilege (e.g., `SELECT`, `USAGE`, or ownership) | Each semantic view | Required for `SHOW` and `DESCRIBE` to return the view |
| `READ` | Image repository stage | Pull the container image |

#### Example Grant Statements
```sql
CREATE ROLE IF NOT EXISTS SV_VIEWER_ROLE;

-- Compute pool and warehouse
GRANT USAGE ON COMPUTE POOL sv_viewer_pool TO ROLE SV_VIEWER_ROLE;
GRANT USAGE ON WAREHOUSE compute_wh TO ROLE SV_VIEWER_ROLE;

-- Access to databases/schemas containing semantic views
GRANT USAGE ON DATABASE my_db TO ROLE SV_VIEWER_ROLE;
GRANT USAGE ON SCHEMA my_db.my_schema TO ROLE SV_VIEWER_ROLE;

-- Grant SELECT on specific semantic views (controls which views appear in the app)
GRANT SELECT ON SEMANTIC VIEW my_db.my_schema.sales_analytics TO ROLE SV_VIEWER_ROLE;
GRANT SELECT ON SEMANTIC VIEW my_db.my_schema.hr_analytics TO ROLE SV_VIEWER_ROLE;

-- Or grant on all semantic views in a schema
GRANT SELECT ON ALL SEMANTIC VIEWS IN SCHEMA my_db.my_schema TO ROLE SV_VIEWER_ROLE;
GRANT SELECT ON FUTURE SEMANTIC VIEWS IN SCHEMA my_db.my_schema TO ROLE SV_VIEWER_ROLE;

-- Image repository access
GRANT READ ON IMAGE REPOSITORY my_db.my_schema.sv_viewer_repo TO ROLE SV_VIEWER_ROLE;

-- Create the service under this role
USE ROLE SV_VIEWER_ROLE;
CREATE SERVICE sv_viewer_service
  IN COMPUTE POOL sv_viewer_pool
  FROM SPECIFICATION_FILE = 'spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = ()
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1;
```

### SPCS OAuth Connection Pattern
```python
import os
import requests

def get_login_token():
    with open('/snowflake/session/token', 'r') as f:
        return f.read().strip()

def execute_sql(statement):
    token = get_login_token()
    host = os.getenv('SNOWFLAKE_HOST')
    resp = requests.post(
        f'https://{host}/api/v2/statements',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'X-Snowflake-Authorization-Token-Type': 'OAUTH',
        },
        json={
            'statement': statement,
            'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
        }
    )
    return resp.json()
```

---

## Out of Scope

- Editing or creating Semantic View definitions
- Real-time collaboration features