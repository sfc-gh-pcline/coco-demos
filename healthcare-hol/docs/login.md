# Logging In & Getting Ready

## Step 1: Log In to Snowflake

1. Open your browser and navigate to Snowsight:

    ```
    https://{{ getenv("DATAOPS_SNOWFLAKE_ACCOUNT","your-account") }}.snowflakecomputing.com
    ```

2. Enter the credentials provided by your lab administrator:

    - **Username**: `{{ getenv("EVENT_USER_NAME","your_username") }}`
    - **Password**: Provided at the start of the session

3. After logging in, confirm your context by checking the account selector in the bottom-left corner of Snowsight. You should see:

    - **Role**: `HEALTHCARE_AI_DEMO`
    - **Warehouse**: `HEALTHCARE_DEMO_WH`
    - **Database**: `HEALTHCARE_AI_DEMO`

4. If any of these are not set, open a SQL worksheet and run:

    ```sql
    USE ROLE HEALTHCARE_AI_DEMO;
    USE WAREHOUSE HEALTHCARE_DEMO_WH;
    USE DATABASE HEALTHCARE_AI_DEMO;
    USE SCHEMA DENIALS;
    ```

## Step 2: Verify Your Environment

Open a SQL worksheet and run the following to confirm the data is loaded:

```sql
SELECT 'payer_dim' AS table_name, COUNT(*) AS row_count FROM payer_dim
UNION ALL SELECT 'facility_dim', COUNT(*) FROM facility_dim
UNION ALL SELECT 'department_dim', COUNT(*) FROM department_dim
UNION ALL SELECT 'denial_claims_fact', COUNT(*) FROM denial_claims_fact
UNION ALL SELECT 'appeals_fact', COUNT(*) FROM appeals_fact
UNION ALL SELECT 'parsed_content', COUNT(*) FROM parsed_content
ORDER BY row_count DESC;
```

You should see ~8,000 denial claims, ~5,100 appeals, and 9 parsed documents.

!!! success "You're ready!"

    Once you see the row counts, you're all set. Choose your track:

    - **Power Users** (developers, analysts comfortable with SQL): [Power User Track](power-user-track.md)
    - **Business Users** (clinical ops, revenue cycle, no SQL required): [Business User Track](business-user-track.md)

---

## Optional: Create a Programmatic Access Token (PAT)

A Programmatic Access Token (PAT) lets you authenticate to Snowflake from command-line tools like the Snowflake CLI and Cortex Code CLI without entering your password each time. This is **optional** — you only need it if you plan to use Cortex Code CLI or Cortex Code Desktop on your laptop.

### Create a PAT via Snowsight

1. In Snowsight, click your **user icon** in the bottom-left corner
2. Select **My Profile**
3. Scroll down to **Programmatic Access Tokens** and click **Generate New Token**
4. Configure the token:
    - **Name**: `HOL_TOKEN`
    - **Expires in**: 1 day (sufficient for this lab)
    - **Role restriction**: Select **One specific role** → `HEALTHCARE_AI_DEMO`
5. Click **Generate**
6. **Copy the token immediately** — you will not be able to see it again after closing the dialog

!!! warning "Copy your token now!"

    The token secret is shown only once. Copy it and save it somewhere safe (a text file, password manager, etc.). You'll need it when configuring Cortex Code CLI.

### Create a PAT via SQL

Alternatively, run this in a SQL worksheet:

```sql
ALTER USER ADD PROGRAMMATIC ACCESS TOKEN HOL_TOKEN
  ROLE_RESTRICTION = 'HEALTHCARE_AI_DEMO'
  DAYS_TO_EXPIRY = 1
  COMMENT = 'Hands-on lab token';
```

Copy the `token_secret` value from the output.

### Use Your PAT

When configuring a Snowflake connection (in `~/.snowflake/connections.toml` or during `cortex` setup), use:

```toml
[hol]
account = "{{ getenv("DATAOPS_SNOWFLAKE_ACCOUNT","your-account") }}"
user = "{{ getenv("EVENT_USER_NAME","your_username") }}"
authenticator = "PROGRAMMATIC_ACCESS_TOKEN"
token = "<paste your token here>"
role = "HEALTHCARE_AI_DEMO"
warehouse = "HEALTHCARE_DEMO_WH"
database = "HEALTHCARE_AI_DEMO"
schema = "DENIALS"
```

See [Using Cortex Code](using-cortex-code.md) for full installation and connection instructions.
