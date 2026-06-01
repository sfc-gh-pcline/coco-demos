# Snowflake Demos

A collection of demo applications built with [Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) on the Snowflake platform.

Each project includes a `requirements.md` that can be used as a prompt for Cortex Code to regenerate the application from scratch.

## Projects

| Folder | Description |
|--------|-------------|
| [`sv_viewer`](sv_viewer/) | **Semantic View Explorer** — Browse, search, and inspect Snowflake Semantic View definitions. React + Flask with local dev and SPCS deployment support. |
| [`db-explorer`](db-explorer/) | **Database Explorer** — Browse the databases, schemas, tables, and columns a user is permitted to see. Uses Caller's Rights so each person's view reflects their own role and grants. Next.js with no Python or Docker required. |

## Cortex Code Skills

Reusable [Cortex Code skills](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) that extend the IDE with Snowflake-specific workflows.

| Folder | Description |
|--------|-------------|
| [`skills/snowflake-app-deploy`](skills/snowflake-app-deploy/) | **Snowflake App Deploy** — Deploy a Next.js app to Snowflake App Runtime via `snow app deploy`. Injects Snowflake auth, generates `snowflake.yml` / `app.yml`, enables Caller's Rights, and runs the deploy — no SPCS knowledge required. |
