# Using Cortex Code

Cortex Code is Snowflake's AI coding agent. It understands your Snowflake environment — databases, schemas, roles, warehouses — and can create, modify, and deploy Snowflake objects from natural language prompts.

Cortex Code is available in three forms:

| Interface | Best For | Requires Install? |
|-----------|----------|-------------------|
| **Cortex Code in Snowsight** | Quick queries, SQL authoring, notebook help | No — built into Snowsight |
| **Cortex Code CLI** | Power users, terminal workflows, local file access | Yes |
| **Cortex Code Desktop** | VS Code-style experience with full agent capabilities | Yes |

For this lab, **Cortex Code in Snowsight** is sufficient. The CLI and Desktop are optional for those who want the full developer experience.

---

## Cortex Code in Snowsight (No Install Required)

Cortex Code is built into Snowsight. To open it:

1. Log in to Snowsight
2. Look for the **Cortex Code** icon in the left navigation bar (it looks like a sparkle/star icon)
3. Click it to open the chat panel
4. Start typing natural language requests

!!! tip "Try it now"

    Type: **"What databases do I have access to?"** to verify your connection.

---

## Installing Snowflake CLI (Prerequisite for Cortex Code CLI)

Cortex Code CLI requires Snowflake CLI (`snow`) to be installed first. Snowflake CLI manages your connections to Snowflake.

### macOS (Homebrew)

```bash
brew tap snowflakedb/snowflake-cli
brew update
brew install snowflake-cli
```

### macOS / Linux (pip)

```bash
pip install snowflake-cli
```

### Windows

Download the installer from the [Snowflake CLI releases page](https://github.com/snowflakedb/snowflake-cli/releases) and run it.

### Verify Installation

```bash
snow --version
```

### Configure a Connection

```bash
snow connection add
```

Follow the prompts to enter your account, username, and authentication method. If you created a PAT in the [login step](login.md), you can use it here:

- **Account**: Your Snowflake account identifier
- **User**: Your username
- **Authenticator**: `PROGRAMMATIC_ACCESS_TOKEN`
- **Token**: Paste your PAT

Alternatively, edit `~/.snowflake/connections.toml` directly:

```toml
[hol]
account = "your-account"
user = "your_username"
authenticator = "PROGRAMMATIC_ACCESS_TOKEN"
token = "<your PAT>"
role = "HEALTHCARE_AI_DEMO"
warehouse = "HEALTHCARE_DEMO_WH"
database = "HEALTHCARE_AI_DEMO"
schema = "DENIALS"
```

Test your connection:

```bash
snow connection test -c hol
```

---

## Installing Cortex Code CLI

Cortex Code CLI is a terminal-based AI agent that connects to your Snowflake account. It can execute SQL, read/write local files, build Streamlit apps, create agents, and more — all from natural language.

### macOS and Linux (including WSL)

```bash
curl -LsS https://ai.snowflake.com/static/cc-scripts/install.sh | sh
```

The `cortex` executable is installed in `~/.local/bin`. The installer adds this to your PATH automatically.

### Windows (PowerShell)

```powershell
irm https://ai.snowflake.com/static/cc-scripts/install.ps1 | iex
```

The `cortex` executable is installed in `%LOCALAPPDATA%\cortex`.

### Connect and Start

```bash
cortex
```

The setup wizard will prompt you to choose a connection. Select the connection you configured with Snowflake CLI (e.g., `hol`), or create a new one.

Once connected, try:

```
What databases do I have access to?
```

```
Show me all tables in HEALTHCARE_AI_DEMO.DENIALS with row counts.
```

---

## Installing Cortex Code Desktop

Cortex Code Desktop provides a VS Code-style experience with the full Cortex Code agent. It supports file editing, diff views, side-by-side code review, and all the same capabilities as the CLI in a graphical interface.

### Prerequisites

- Snowflake CLI installed and configured (see above)
- Cortex Code CLI installed (see above)

### Installation

Cortex Code Desktop uses the Agent Client Protocol (ACP) to embed Cortex Code into editors and IDEs. Supported editors include:

- **VS Code** — Configure Cortex Code as an ACP agent
- **Zed** — Native ACP support
- **JetBrains IDEs** — Via ACP plugin
- **Neovim** — Via ACP integration

To configure your editor, add the following ACP agent configuration (example for VS Code):

```json
{
  "command": "cortex",
  "args": ["acp", "serve", "-c", "hol"]
}
```

Replace `hol` with your connection name. Refer to your editor's documentation for the exact location to add this configuration.

### Verify

Once configured, open your editor and start a Cortex Code session. You should be able to type natural language requests and see the agent respond with Snowflake-aware actions.

---

## Quick Reference

| Command | What It Does |
|---------|-------------|
| `snow --version` | Check Snowflake CLI version |
| `snow connection test -c hol` | Test your Snowflake connection |
| `cortex` | Start Cortex Code CLI |
| `cortex acp serve -c hol` | Start Cortex Code in ACP mode (for editors) |
| `/help` | Show available commands inside a Cortex Code session |
| `/model` | Change the AI model |
| `/connections` | Switch Snowflake connections |

!!! info "For this lab"

    **Business Users**: You'll use Cortex Code (Snowsight or CLI) for all lab steps. Make sure it's connected before starting the [Business User Track](business-user-track.md).

    **Power Users**: You'll use Snowsight worksheets for most steps, then switch to Cortex Code for refinement. Cortex Code in Snowsight is the easiest option.
