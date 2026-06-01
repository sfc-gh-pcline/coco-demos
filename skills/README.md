# Cortex Code Skills

Reusable [Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) skills for Snowflake development workflows. Each skill is a self-contained directory with a `SKILL.md` (the skill itself) and a `README.md` (human docs).

## Skills

| Skill | Description |
|-------|-------------|
| [`snowflake-app-deploy`](snowflake-app-deploy/) | Deploy a Next.js or Node.js app to Snowflake App Runtime via `snow app deploy`. Handles Snowflake auth injection, `snowflake.yml` / `app.yml` generation, `next.config.mjs` patching, and caller's rights — no SPCS knowledge required. |

## Installing a skill

### Option A — Cortex Code `github-plugin-installer` skill

Open Cortex Code and say:
```
Install a skill from GitHub: https://github.com/<your-org>/demos/tree/main/skills/<skill-name>
```

### Option B — curl one-liner

```bash
SKILL=snowflake-app-deploy
mkdir -p ~/.snowflake/cortex/skills/$SKILL
curl -fsSL https://raw.githubusercontent.com/<your-org>/demos/main/skills/$SKILL/SKILL.md \
  -o ~/.snowflake/cortex/skills/$SKILL/SKILL.md
```

### Option C — clone and symlink

```bash
git clone https://github.com/<your-org>/demos.git ~/demos
ln -s ~/demos/skills/<skill-name> ~/.snowflake/cortex/skills/<skill-name>
```

Skills load on the next Cortex Code session start.
