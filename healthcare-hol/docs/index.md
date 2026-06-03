# <h1black>Welcome — </h1black><h1blue>Healthcare AI Hands-On Lab</h1blue>

### <h1sub>Why Are We Here?</h1sub>

Today you'll build a complete AI-powered denial management application inside Snowflake — from raw data to a conversational AI assistant your team can use tomorrow. You'll work with **Cortex Search**, **Cortex Agents**, **Snowflake Intelligence**, and **Streamlit** to create an end-to-end analytics and document intelligence solution.

There are two tracks. **Power Users** write SQL and use the Snowflake UI, then refine with Cortex Code. **Business Users** do everything through Cortex Code using natural language — no SQL required. Both tracks build the same application.

### <h1sub>The Lab Environment</h1sub>

A complete lab environment has been built for you automatically. This includes:

- **Snowflake Account**: `{{ getenv("DATAOPS_SNOWFLAKE_ACCOUNT","unknown") }}`
- **User**: `{{ getenv("EVENT_USER_NAME","unknown") }}`
- **Snowflake Virtual Warehouse**: `{{ getenv("EVENT_WAREHOUSE","unknown") }}`
- **Snowflake Database**: `{{ getenv("DATAOPS_DATABASE","unknown") }}`
- **Schema**: `{{ getenv("EVENT_SCHEMA","unknown") }}`

!!! warning "This lab environment will disappear!"

    This event is due to end at `{{ getenv("EVENT_DECOMMISSION_DATETIME","unknown") }}`, at which point access will be restricted and accounts will be removed.

### <h1sub>Structure of the Session</h1sub>

This walkthrough contains everything you need. We will also demonstrate a number of the key steps live.

### <h1sub>Getting Started</h1sub>

1. [Logging In & Getting Ready](login.md)
2. [Power User Track](power-user-track.md) — SQL/UI first, Cortex Code to refine
3. [Business User Track](business-user-track.md) — Cortex Code does everything
4. [Using Cortex Code](using-cortex-code.md) — Install Snowflake CLI, Cortex Code CLI & Desktop
