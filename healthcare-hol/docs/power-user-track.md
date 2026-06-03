# Power User Track: Building AI-Powered Healthcare Analytics

> **Duration:** ~3 hours
> **Audience:** Developers, analysts comfortable with SQL and the Snowflake UI
> **Database:** `HEALTHCARE_AI_DEMO.DENIALS`
> **Warehouse:** `HEALTHCARE_DEMO_WH`

!!! info "Prerequisite"
    You should be logged in and verified per the [Login Page](login.md). You need access to a Snowsight worksheet and the `HEALTHCARE_AI_DEMO` role.

Over the next three hours, you will build a complete AI application for healthcare denial management from scratch. You will write SQL, use the Snowsight UI, and then use Cortex Code (CoCo) to refine and accelerate.

You will build four things in order:

1. **Cortex Search** — semantic search over payer policy documents
2. **Cortex Agent** — an AI that can query both your data and your documents
3. **Snowflake Intelligence** — a chat interface for business users to talk to the agent
4. **Streamlit App** — an interactive denial analytics dashboard

The data is already loaded. You have a star schema with ~8,000 denied claims, ~5,100 appeals, 10 payers, 15 departments, 8 facilities, and 9 unstructured policy and clinical guideline documents — all in `HEALTHCARE_AI_DEMO.DENIALS`.

---

## Module 0: Data Exploration (15 min)

Before building anything, take a few minutes to explore the database schema and the unstructured documents. This is important context for everything that follows.

### Step 0.1: Set Your Context

Run this SQL in a Snowsight worksheet:

```sql
USE ROLE HEALTHCARE_AI_DEMO;
USE DATABASE HEALTHCARE_AI_DEMO;
USE SCHEMA DENIALS;
USE WAREHOUSE HEALTHCARE_DEMO_WH;
```

!!! warning
    Pause and confirm your context is set correctly. If you have role or warehouse issues, resolve them now before proceeding.

### Step 0.2: Explore the Tables

The schema uses a star schema — dimension tables describe entities like payers, departments, and procedures, and fact tables hold the actual denial claims and appeals.

```sql
SHOW TABLES IN SCHEMA DENIALS;
```

```sql
-- Quick row counts for all tables
SELECT 'payer_dim' AS table_name, COUNT(*) AS row_count FROM payer_dim
UNION ALL SELECT 'facility_dim', COUNT(*) FROM facility_dim
UNION ALL SELECT 'department_dim', COUNT(*) FROM department_dim
UNION ALL SELECT 'provider_dim', COUNT(*) FROM provider_dim
UNION ALL SELECT 'procedure_dim', COUNT(*) FROM procedure_dim
UNION ALL SELECT 'denial_reason_dim', COUNT(*) FROM denial_reason_dim
UNION ALL SELECT 'appeal_status_dim', COUNT(*) FROM appeal_status_dim
UNION ALL SELECT 'date_dim', COUNT(*) FROM date_dim
UNION ALL SELECT 'denial_claims_fact', COUNT(*) FROM denial_claims_fact
UNION ALL SELECT 'appeals_fact', COUNT(*) FROM appeals_fact
UNION ALL SELECT 'monthly_denial_summary', COUNT(*) FROM monthly_denial_summary
UNION ALL SELECT 'parsed_content', COUNT(*) FROM parsed_content
ORDER BY row_count DESC;
```

You should see 8 dimension tables and 3 fact tables, plus a `parsed_content` table that holds parsed unstructured documents. The `denial_claims_fact` table has about 8,000 rows (denied claims) and the `appeals_fact` table has about 5,100 rows (appeals filed against those denials).

### Step 0.3: Explore the Star Schema

Start with the key dimensions to understand the data:

```sql
SELECT * FROM payer_dim ORDER BY payer_key;
```

```sql
SELECT * FROM denial_reason_dim ORDER BY denial_reason_key;
```

```sql
SELECT * FROM department_dim ORDER BY department_key;
```

!!! info
    Notice the payer types — Commercial (Aetna, Blue Cross, UHC, Cigna, Humana), Government (Medicare, Medicaid, Tricare), Marketplace (Ambetter), and Managed Care (Molina). The denial reasons use CARC codes — industry standard. CO-4 is modifier issues, CO-16 is missing information, CO-197 is prior authorization required, CO-29 is timely filing. You also have 15 clinical departments — Cardiology, Orthopedics, Primary Care, Emergency Medicine, and more.

### Step 0.4: Preview the Fact Data

Look at the actual denial claims — what does a row look like?

```sql
SELECT
    f.claim_id,
    p.payer_name,
    proc.procedure_description,
    dr.denial_reason_code,
    dr.denial_reason_description,
    f.claim_amount,
    f.denied_amount,
    f.date_of_service,
    f.denial_date,
    ast.appeal_status,
    d.department_name
FROM denial_claims_fact f
JOIN payer_dim p ON f.payer_key = p.payer_key
JOIN procedure_dim proc ON f.procedure_key = proc.procedure_key
JOIN denial_reason_dim dr ON f.denial_reason_key = dr.denial_reason_key
JOIN appeal_status_dim ast ON f.appeal_status_key = ast.appeal_status_key
JOIN department_dim d ON f.department_key = d.department_key
LIMIT 10;
```

Each row is a single denied claim. You can see the full picture — who the payer is, what procedure was performed, why it was denied, how much money is at stake, and whether it was appealed.

### Step 0.5: Quick Summary Statistics

Get a high-level picture of the denial landscape:

```sql
SELECT
    COUNT(*) AS total_denials,
    TO_CHAR(SUM(denied_amount), '$999,999,999.00') AS total_denied_dollars,
    TO_CHAR(AVG(denied_amount), '$999,999.00') AS avg_denied_per_claim,
    MIN(denial_date) AS earliest_denial,
    MAX(denial_date) AS latest_denial,
    COUNT(DISTINCT p.payer_name) AS unique_payers,
    COUNT(DISTINCT d.department_name) AS unique_departments
FROM denial_claims_fact f
JOIN payer_dim p ON f.payer_key = p.payer_key
JOIN department_dim d ON f.department_key = d.department_key;
```

### Step 0.6: Explore the Unstructured Documents

You have payer policy documents and internal clinical guidelines stored in an internal stage. They have been parsed using Cortex Parse Document into a `parsed_content` table.

```sql
-- See what documents we have
SELECT
    title,
    doc_category,
    LENGTH(content) AS content_length_chars,
    LEFT(content, 200) AS content_preview
FROM parsed_content
ORDER BY doc_category, title;
```

```sql
-- List the raw files in the internal stage
LS @INTERNAL_DATA_STAGE/unstructured_docs/;
```

You should see 9 documents — 6 payer policies (Aetna, Blue Cross, UnitedHealthcare, Cigna, CMS Medicare, Georgia Medicaid) and 3 internal clinical guidelines (imaging prior auth, ED visit documentation, denial management workflow).

These are real-world document types your revenue cycle and clinical teams reference daily. The text has been parsed and is ready for Cortex Search to index. Right now, you would have to manually read through these to find the right policy. After this lab, the AI agent will search them for you.

!!! success "Checkpoint"
    You should understand the star schema structure, the fact data, the dimension tables, and the unstructured documents. You are ready to start building.

---

## Module 1: Cortex Search (30 min)

**Cortex Search** is a fully managed semantic search engine. You are going to index those policy documents so that instead of keyword-matching through PDFs, you can ask a question in natural language and get the relevant policy section back.

Cortex Search combines three techniques — semantic search (understands meaning), keyword search (catches exact codes and terms), and a reranker (puts the best results on top). You create it with a single SQL statement.

### Step 1.1: Create the Search Service

Create a search service over the payer policy documents. You will index the `content` column from `parsed_content`, and add `title` and `doc_category` as filterable attributes so you can narrow results by payer or document type.

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE search_payer_policies
  ON content
  ATTRIBUTES relative_path, file_url, title, doc_category
  WAREHOUSE = HEALTHCARE_DEMO_WH
  TARGET_LAG = '30 day'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
    SELECT relative_path, file_url, title, doc_category, content
    FROM parsed_content
    WHERE doc_category = 'payer_policies'
);
```

!!! info "What's happening"
    Snowflake is embedding each document chunk into vector space for semantic search, building a keyword index for lexical matching, and creating a reranker pipeline. The `TARGET_LAG` means when you add new documents, the index auto-refreshes within an hour. This will take 1-2 minutes to initialize.

### Step 1.2: Create the Clinical Guidelines Search Service

Now create a second search service — this one indexes the internal clinical guidelines (imaging prior auth, ED visit documentation, denial management workflow).

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE search_clinical_guidelines
  ON content
  ATTRIBUTES relative_path, file_url, title, doc_category
  WAREHOUSE = HEALTHCARE_DEMO_WH
  TARGET_LAG = '30 day'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
    SELECT relative_path, file_url, title, doc_category, content
    FROM parsed_content
    WHERE doc_category = 'clinical_guidelines'
);
```

### Step 1.3: Verify the Services

Confirm both services were created successfully:

```sql
SHOW CORTEX SEARCH SERVICES;

DESCRIBE CORTEX SEARCH SERVICE search_payer_policies;
DESCRIBE CORTEX SEARCH SERVICE search_clinical_guidelines;
```

### Step 1.4: Test a Basic Search

Ask about prior authorization for surgical procedures and see if it finds the Blue Cross surgical prior auth guidelines, even though you are not using the exact same words:

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.SEARCH_PAYER_POLICIES',
      '{
        "query": "What are the prior authorization requirements for surgical procedures?",
        "columns": ["title", "doc_category", "content"],
        "limit": 3
      }'
  )
)['results'] AS results;
```

The Blue Cross surgical prior auth guidelines should come back as the top hit — even though you did not search for "Blue Cross" or "BCBS." That is semantic search in action. It understands the *meaning* of the question.

### Step 1.5: Test a Filtered Search

Add a filter to narrow the semantic search to a specific payer. Search only Aetna's policies:

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.SEARCH_PAYER_POLICIES',
      '{
        "query": "What are the modifier requirements for cardiac catheterization?",
        "columns": ["title", "doc_category", "content"],
        "filter": {"@eq": {"title": "Aetna_Cardiac_Catheterization_Policy.txt"}},
        "limit": 2
      }'
  )
)['results'] AS results;
```

### Step 1.6: Test the Clinical Guidelines Service

Now test the clinical guidelines service — your internal operational documents:

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.SEARCH_CLINICAL_GUIDELINES',
      '{
        "query": "What is the imaging prior authorization process?",
        "columns": ["title", "doc_category", "content"],
        "limit": 3
      }'
  )
)['results'] AS results;
```

### Step 1.7: Try Additional Searches (5 min — self-paced)

Try modifying the query and filter values in the SQL templates above. Some questions to try:

- `"timely filing requirements for Medicare claims"` (payer policies service)
- `"what documentation is required for specialist visit claims"` (filter to UnitedHealthcare)
- `"coverage exclusions for cosmetic procedures"` (filter to Cigna)
- `"ED visit documentation levels"` (clinical guidelines service)
- `"denial management appeals workflow"` (clinical guidelines service)
- `"coverage exclusions for cosmetic procedures"` (filter to Cigna)
- `"Georgia Medicaid claims submission guidelines"`

!!! success "Checkpoint"
    You should be able to search policy documents by meaning and get relevant results. You created a semantic search engine in one SQL statement — no vector database, no embedding pipeline, no MLOps. Snowflake handles all of it.

---

## Module 2: Cortex Agent (30 min)

Now you are going to build an **agent** — an AI that can answer questions from BOTH your denial data (numbers) AND your policy documents (text).

A Cortex Agent uses multiple tools. When you ask a question, the agent figures out which tool to use:

- **Data question** (counts, trends, dollars) → routes to Cortex Analyst (text-to-SQL via a Semantic View)
- **Document question** (payer policies, guidelines) → routes to Cortex Search
- **Both** → uses both tools and synthesizes the answer

You need to build two things: first, a Semantic View so the agent can query your denial data, then the agent itself.

### Step 2.1: Create a Semantic View

A Semantic View is a business-level description of your data model. It tells Cortex Analyst what each column means, how tables relate, and what metrics to calculate. Think of it as a translator between "What's our denial rate by payer?" and the actual SQL with joins and aggregations.

You have two options — use whichever you prefer:

**Option A: Snowsight UI**

1. Navigate to **AI & ML → Semantic Views → Create**
2. Location: `HEALTHCARE_AI_DEMO.DENIALS`
3. Name: `DENIAL_ANALYTICS_SV`
4. Description: `Semantic view for healthcare denial claims analytics — covers denial volumes, reason codes, payer comparisons, appeal outcomes, financial impact, and resolution timelines.`
5. Click **Next**, then **Skip** (verified queries for now)
6. Select the `HEALTHCARE_AI_DEMO.DENIALS` schema
7. Select tables: `DENIAL_CLAIMS_FACT`, `PAYER_DIM`, `PROCEDURE_DIM`, `DEPARTMENT_DIM`, `FACILITY_DIM`, `DENIAL_REASON_DIM`, `APPEAL_STATUS_DIM`, `PROVIDER_DIM`
8. Select all columns, accept suggested relationships and metrics
9. Click **Save**

**Option B: SQL (copy-paste the full statement)**

```sql
CREATE OR REPLACE SEMANTIC VIEW HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_SV
  TABLES (
    CLAIMS AS DENIAL_CLAIMS_FACT PRIMARY KEY (CLAIM_ID)
      WITH SYNONYMS=('denials','denied claims','claim denials')
      COMMENT='Fact table of all denied claims with financial and resolution data',
    PAYERS AS PAYER_DIM PRIMARY KEY (PAYER_KEY)
      WITH SYNONYMS=('insurance companies','health plans','payers')
      COMMENT='Insurance payer dimension',
    PROCEDURES AS PROCEDURE_DIM PRIMARY KEY (PROCEDURE_KEY)
      WITH SYNONYMS=('CPT codes','medical procedures','services')
      COMMENT='Medical procedure and CPT code dimension',
    DEPARTMENTS AS DEPARTMENT_DIM PRIMARY KEY (DEPARTMENT_KEY)
      WITH SYNONYMS=('clinical departments','specialties')
      COMMENT='Hospital department dimension',
    FACILITIES AS FACILITY_DIM PRIMARY KEY (FACILITY_KEY)
      WITH SYNONYMS=('locations','sites','hospitals','clinics')
      COMMENT='Facility and care setting dimension',
    DENIAL_REASONS AS DENIAL_REASON_DIM PRIMARY KEY (DENIAL_REASON_KEY)
      WITH SYNONYMS=('reason codes','CARC codes','denial codes')
      COMMENT='Claim Adjustment Reason Code (CARC) dimension',
    APPEAL_STATUSES AS APPEAL_STATUS_DIM PRIMARY KEY (APPEAL_STATUS_KEY)
      WITH SYNONYMS=('appeal outcomes','appeal results')
      COMMENT='Appeal status and outcome dimension',
    PROVIDERS AS PROVIDER_DIM PRIMARY KEY (PROVIDER_KEY)
      WITH SYNONYMS=('doctors','physicians','rendering providers')
      COMMENT='Rendering provider dimension'
  )
  RELATIONSHIPS (
    CLAIMS_TO_PAYERS AS CLAIMS(PAYER_KEY) REFERENCES PAYERS(PAYER_KEY),
    CLAIMS_TO_PROCEDURES AS CLAIMS(PROCEDURE_KEY) REFERENCES PROCEDURES(PROCEDURE_KEY),
    CLAIMS_TO_DEPARTMENTS AS CLAIMS(DEPARTMENT_KEY) REFERENCES DEPARTMENTS(DEPARTMENT_KEY),
    CLAIMS_TO_FACILITIES AS CLAIMS(FACILITY_KEY) REFERENCES FACILITIES(FACILITY_KEY),
    CLAIMS_TO_REASONS AS CLAIMS(DENIAL_REASON_KEY) REFERENCES DENIAL_REASONS(DENIAL_REASON_KEY),
    CLAIMS_TO_APPEALS AS CLAIMS(APPEAL_STATUS_KEY) REFERENCES APPEAL_STATUSES(APPEAL_STATUS_KEY),
    CLAIMS_TO_PROVIDERS AS CLAIMS(PROVIDER_KEY) REFERENCES PROVIDERS(PROVIDER_KEY)
  )
  FACTS (
    CLAIMS.CLAIM_AMOUNT AS claim_amount COMMENT = 'Original billed charge amount in dollars',
    CLAIMS.DENIED_AMOUNT AS denied_amount COMMENT = 'Amount denied by payer in dollars',
    CLAIMS.CLAIM_RECORD AS 1 COMMENT = 'Count of denial claims',
    CLAIMS.DAYS_TO_RESOLUTION AS days_to_resolution COMMENT = 'Days from denial to resolution (appeals only)'
  )
  DIMENSIONS (
    CLAIMS.DATE_OF_SERVICE AS date_of_service WITH SYNONYMS=('DOS','service date') COMMENT = 'Date the medical service was provided',
    CLAIMS.DENIAL_DATE AS denial_date WITH SYNONYMS=('denied date','denial date') COMMENT = 'Date the claim was denied by the payer',
    CLAIMS.DENIAL_MONTH AS MONTH(denial_date) COMMENT = 'Month of the denial',
    CLAIMS.DENIAL_YEAR AS YEAR(denial_date) COMMENT = 'Year of the denial',
    CLAIMS.PATIENT_ID AS patient_id COMMENT = 'De-identified patient identifier',
    PAYERS.PAYER_NAME AS payer_name WITH SYNONYMS=('insurance','health plan','payer') COMMENT = 'Name of the insurance payer',
    PAYERS.PAYER_TYPE AS payer_type WITH SYNONYMS=('insurance type','plan type') COMMENT = 'Type of payer: Commercial, Government, Marketplace, Managed Care',
    PROCEDURES.CPT_CODE AS cpt_code WITH SYNONYMS=('procedure code','CPT') COMMENT = 'CPT procedure code',
    PROCEDURES.PROCEDURE_DESCRIPTION AS procedure_description WITH SYNONYMS=('procedure','service') COMMENT = 'Description of the medical procedure',
    PROCEDURES.PROCEDURE_CATEGORY AS procedure_category WITH SYNONYMS=('service category','procedure type') COMMENT = 'Category grouping for procedures',
    PROCEDURES.STANDARD_CHARGE AS standard_charge COMMENT = 'Standard charge amount for the procedure',
    DEPARTMENTS.DEPARTMENT_NAME AS department_name WITH SYNONYMS=('department','specialty') COMMENT = 'Clinical department name',
    FACILITIES.FACILITY_NAME AS facility_name WITH SYNONYMS=('facility','location','hospital') COMMENT = 'Name of the facility',
    FACILITIES.FACILITY_TYPE AS facility_type COMMENT = 'Type of facility',
    FACILITIES.CARE_SETTING AS care_setting WITH SYNONYMS=('setting','place of service') COMMENT = 'Care setting: Inpatient, Outpatient, Emergency, Ambulatory',
    DENIAL_REASONS.DENIAL_REASON_CODE AS denial_reason_code WITH SYNONYMS=('reason code','CARC','denial code') COMMENT = 'CARC denial reason code (e.g., CO-197, CO-16)',
    DENIAL_REASONS.DENIAL_REASON_DESCRIPTION AS denial_reason_description WITH SYNONYMS=('denial reason','reason') COMMENT = 'Full description of the denial reason',
    DENIAL_REASONS.DENIAL_CATEGORY AS denial_category COMMENT = 'High-level denial category: Coding, Documentation, Authorization, Clinical, Administrative',
    DENIAL_REASONS.DENIAL_SUBCATEGORY AS denial_subcategory COMMENT = 'Subcategory within the denial category',
    APPEAL_STATUSES.APPEAL_STATUS AS appeal_status WITH SYNONYMS=('appeal outcome','appeal result') COMMENT = 'Current appeal status: Not Appealed, Appeal Filed, Overturned, Upheld, etc.',
    PROVIDERS.PROVIDER_NAME AS provider_name WITH SYNONYMS=('doctor','physician') COMMENT = 'Rendering provider name'
  )
  METRICS (
    CLAIMS.TOTAL_DENIALS AS COUNT(CLAIMS.claim_record) COMMENT = 'Total number of denied claims',
    CLAIMS.TOTAL_DENIED_AMOUNT AS SUM(CLAIMS.denied_amount) COMMENT = 'Total dollar amount denied',
    CLAIMS.TOTAL_CHARGES AS SUM(CLAIMS.claim_amount) COMMENT = 'Total original billed charges',
    CLAIMS.AVERAGE_DENIED_AMOUNT AS AVG(CLAIMS.denied_amount) COMMENT = 'Average denied amount per claim',
    CLAIMS.DENIAL_RATE AS SUM(CLAIMS.denied_amount) / NULLIF(SUM(CLAIMS.claim_amount), 0) COMMENT = 'Denial rate as percentage of total charges',
    CLAIMS.AVG_DAYS_TO_RESOLUTION AS AVG(CLAIMS.days_to_resolution) COMMENT = 'Average days from denial to resolution'
  )
  COMMENT='Semantic view for healthcare denial claims analytics — covers denial volumes, reason codes, payer comparisons, appeal outcomes, financial impact, and resolution timelines';
```

### Step 2.2: Create the Appeals Semantic View

Create a second semantic view for appeal-specific analytics — recovery rates, appeal outcomes, and appeal levels.

```sql
CREATE OR REPLACE SEMANTIC VIEW HEALTHCARE_AI_DEMO.DENIALS.APPEALS_ANALYTICS_SV
  TABLES (
    APPEALS AS APPEALS_FACT PRIMARY KEY (APPEAL_ID)
      WITH SYNONYMS=('appeal records','appeal data')
      COMMENT='Fact table of all appeals filed against denied claims',
    APPEAL_STATUSES AS APPEAL_STATUS_DIM PRIMARY KEY (APPEAL_STATUS_KEY)
      WITH SYNONYMS=('outcomes','results')
      COMMENT='Appeal outcome dimension',
    CLAIMS AS DENIAL_CLAIMS_FACT PRIMARY KEY (CLAIM_ID)
      COMMENT='Source denial claims linked to appeals',
    PAYERS AS PAYER_DIM PRIMARY KEY (PAYER_KEY)
      COMMENT='Payer dimension for appeal analysis',
    DENIAL_REASONS AS DENIAL_REASON_DIM PRIMARY KEY (DENIAL_REASON_KEY)
      COMMENT='Denial reason for the original claim'
  )
  RELATIONSHIPS (
    APPEALS_TO_STATUSES AS APPEALS(APPEAL_STATUS_KEY) REFERENCES APPEAL_STATUSES(APPEAL_STATUS_KEY),
    APPEALS_TO_CLAIMS AS APPEALS(CLAIM_ID) REFERENCES CLAIMS(CLAIM_ID),
    CLAIMS_TO_PAYERS AS CLAIMS(PAYER_KEY) REFERENCES PAYERS(PAYER_KEY),
    CLAIMS_TO_REASONS AS CLAIMS(DENIAL_REASON_KEY) REFERENCES DENIAL_REASONS(DENIAL_REASON_KEY)
  )
  FACTS (
    APPEALS.DENIED_AMOUNT AS denied_amount COMMENT = 'Original denied amount on the appeal',
    APPEALS.RECOVERED_AMOUNT AS recovered_amount COMMENT = 'Amount recovered through appeal',
    APPEALS.APPEAL_RECORD AS 1 COMMENT = 'Count of appeals'
  )
  DIMENSIONS (
    APPEALS.APPEAL_FILED_DATE AS appeal_filed_date COMMENT = 'Date the appeal was filed',
    APPEALS.APPEAL_LEVEL AS appeal_level COMMENT = 'Appeal level: 1=First, 2=Second, 3=External Review',
    APPEALS.APPEAL_LEVEL_NAME AS appeal_level_name COMMENT = 'Name of the appeal level',
    APPEAL_STATUSES.APPEAL_STATUS AS appeal_status COMMENT = 'Appeal outcome',
    PAYERS.PAYER_NAME AS payer_name COMMENT = 'Insurance payer name',
    DENIAL_REASONS.DENIAL_REASON_CODE AS denial_reason_code COMMENT = 'Original denial reason code',
    DENIAL_REASONS.DENIAL_REASON_DESCRIPTION AS denial_reason_description COMMENT = 'Original denial reason'
  )
  METRICS (
    APPEALS.TOTAL_APPEALS AS COUNT(APPEALS.appeal_record) COMMENT = 'Total appeals filed',
    APPEALS.TOTAL_RECOVERED AS SUM(APPEALS.recovered_amount) COMMENT = 'Total dollars recovered through appeals',
    APPEALS.RECOVERY_RATE AS SUM(APPEALS.recovered_amount) / NULLIF(SUM(APPEALS.denied_amount), 0) COMMENT = 'Recovery rate as percentage of denied amount',
    APPEALS.AVERAGE_RECOVERY AS AVG(APPEALS.recovered_amount) COMMENT = 'Average recovery per appeal'
  )
  COMMENT='Semantic view for appeal analytics — covers appeal volumes, recovery rates, outcomes by payer and denial reason';
```

### Step 2.3: Verify the Semantic Views

```sql
SHOW SEMANTIC VIEWS;
```

### Step 2.4: Create the Agent

Now connect everything into an agent. The agent gets two semantic views for data queries, both search services for document queries, and additional utility tools. You also add instructions telling the agent when to use each tool.

```sql
CREATE OR REPLACE AGENT HEALTHCARE_AI_DEMO.DENIALS.Healthcare_Denial_Management_Agent
  COMMENT = 'AI agent for healthcare denial management — queries denial data, searches payer policies and clinical guidelines, and provides actionable insights for revenue cycle teams.'
  PROFILE = '{"display_name": "Healthcare Denial Management Agent", "color": "blue"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto

  orchestration:
    budget:
      seconds: 60
      tokens: 16000

  instructions:
    response: "You are a healthcare denial management assistant. Provide clear, actionable insights about claim denials, appeal strategies, and payer policies. Always cite your sources — reference specific policy documents or data queries. Format financial data as currency with commas. Format dates as MM/DD/YYYY. When showing trends, default to line charts. When comparing categories, default to bar charts. Always include an Action Items section with specific next steps the revenue cycle team should take."
    orchestration: "For questions about denial counts, trends, rates, financial amounts, appeal outcomes, payer comparisons, department breakdowns, or any quantitative analysis, use the Denial Analytics or Appeals Analytics tools. For questions about payer policies, coverage criteria, documentation requirements, prior authorization rules, or appeal procedures, use the Payer Policy Search tool. For questions about internal clinical guidelines, coding standards, or workflow procedures, use the Clinical Guidelines Search tool. If a question spans both structured data and documents, use multiple tools. For web content analysis, use the web scraper tool."

  sample_questions:
    - question: "What are our top denial reasons this quarter by total denied amount?"
    - question: "What does the Aetna policy say about cardiac catheterization prior auth?"
    - question: "Which payer has the highest denial rate and what are their common reasons?"
    - question: "Show me the trend of CO-197 prior auth denials over the past 12 months"
    - question: "What is our appeal overturn rate by payer?"
    - question: "How can we reduce CO-16 missing information denials from UnitedHealthcare?"

  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "Denial_Analytics"
        description: "Queries structured denial claims data. Use for questions about denial counts, rates, trends, financial amounts, payer comparisons, department breakdowns, facility analysis, procedure-level denials, and any quantitative analysis of claim denials."
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "Appeals_Analytics"
        description: "Queries appeal data including appeal outcomes, recovery amounts, overturn rates, and appeal timelines. Use for questions about appeal success rates, recovered dollars, appeal levels, and appeal performance by payer or denial reason."
    - tool_spec:
        type: "cortex_search"
        name: "Payer_Policy_Search"
        description: "Searches payer policy documents including coverage criteria, prior authorization requirements, claims submission guidelines, and appeal procedures. Use for questions about specific payer rules, denial code explanations, required documentation, filing deadlines, and how to prevent specific types of denials."
    - tool_spec:
        type: "cortex_search"
        name: "Clinical_Guidelines_Search"
        description: "Searches internal clinical guidelines and operational procedures. Use for questions about internal coding standards, documentation requirements, denial management workflows, imaging authorization processes, and ED visit level documentation."
    - tool_spec:
        type: "data_to_chart"
        name: "data_to_chart"
        description: "Generates visualizations from denial and appeal data queries"
    - tool_spec:
        type: "generic"
        name: "Web_Scraper"
        description: "Scrapes and analyzes content from a web URL. Use when the user wants to analyze external content such as payer websites, CMS updates, or regulatory guidance."
        input_schema:
          type: object
          properties:
            weburl:
              description: "Full web URL including http:// or https://"
              type: string
          required: ["weburl"]
    - tool_spec:
        type: "generic"
        name: "Send_Email"
        description: "Sends an email to a recipient. Use when the user wants to email a summary, report, or alert to a colleague."
        input_schema:
          type: object
          properties:
            recipient:
              description: "Email address of the recipient"
              type: string
            subject:
              description: "Email subject line"
              type: string
            text:
              description: "Email body content in HTML format"
              type: string
          required: ["recipient", "subject", "text"]
    - tool_spec:
        type: "generic"
        name: "Document_Download_URL"
        description: "Generates a temporary download URL for policy documents and clinical guidelines stored in the internal stage. Use when a user wants to download or share a specific document."
        input_schema:
          type: object
          properties:
            relative_file_path:
              description: "Relative path of the file from Cortex Search results"
              type: string
            expiration_mins:
              description: "URL expiration in minutes, default 5"
              type: number
          required: ["relative_file_path", "expiration_mins"]

  tool_resources:
    Denial_Analytics:
      semantic_view: "HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_SV"
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
    Appeals_Analytics:
      semantic_view: "HEALTHCARE_AI_DEMO.DENIALS.APPEALS_ANALYTICS_SV"
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
    Payer_Policy_Search:
      name: "HEALTHCARE_AI_DEMO.DENIALS.SEARCH_PAYER_POLICIES"
      max_results: "5"
      title_column: "TITLE"
      id_column: "RELATIVE_PATH"
    Clinical_Guidelines_Search:
      name: "HEALTHCARE_AI_DEMO.DENIALS.SEARCH_CLINICAL_GUIDELINES"
      max_results: "5"
      title_column: "TITLE"
      id_column: "RELATIVE_PATH"
    Web_Scraper:
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
        query_timeout: 0
      identifier: "HEALTHCARE_AI_DEMO.DENIALS.WEB_SCRAPE"
      name: "WEB_SCRAPE(VARCHAR)"
      type: function
    Send_Email:
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
        query_timeout: 0
      identifier: "HEALTHCARE_AI_DEMO.DENIALS.SEND_MAIL"
      name: "SEND_MAIL(VARCHAR, VARCHAR, VARCHAR)"
      type: procedure
    Document_Download_URL:
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
        query_timeout: 0
      identifier: "HEALTHCARE_AI_DEMO.DENIALS.GET_FILE_PRESIGNED_URL_SP"
      name: "GET_FILE_PRESIGNED_URL_SP(VARCHAR, DEFAULT NUMBER)"
      type: procedure
  $$;
```

### Step 2.5: Grant Access

```sql
GRANT USAGE ON AGENT HEALTHCARE_AI_DEMO.DENIALS.Healthcare_Denial_Management_Agent
  TO ROLE HEALTHCARE_AI_DEMO;
```

### Step 2.6: Test the Agent

Test three scenarios to make sure the agent routes correctly — a data question, a document question, and a cross-source question. You can test in Snowsight (**AI & ML → Agents → select Healthcare_Denial_Management_Agent**) or via CoCo.

**Test 1 — Data question (should use Denial_Analytics):**

Type: "What are the top 5 denial reasons by total denied amount?"

**Test 2 — Document question (should use Payer_Policy_Search):**

Type: "What does the Blue Cross policy say about prior authorization for surgical procedures?"

**Test 3 — Cross-source question (should use BOTH tools):**

Type: "We're seeing CO-16 denials from UnitedHealthcare. How many do we have, what's the dollar impact, and what documentation should we be including to prevent these?"

!!! tip
    That last question is the key moment. Watch what happens — the agent uses BOTH tools. It queries the denial data to count CO-16 denials and sum the dollars, then searches the UnitedHealthcare policy document to find what documentation is required. The answer combines data and policy into a single actionable response. That is a 30-minute workflow done in 30 seconds.

### Step 2.7: Refine with Cortex Code (5 min)

Open Cortex Code and improve the agent. This is where CoCo shines for Power Users too — iterative refinement. See [Using Cortex Code](using-cortex-code.md) for CoCo setup instructions.

Try these prompts in CoCo:

> **"Look at the Healthcare_Denial_Management_Agent and suggest improvements to the instructions or tool descriptions to make it more accurate and helpful."**

> **"Update the agent's response instructions to always include an 'Action Items' section with specific steps the revenue cycle team should take."**

!!! success "Checkpoint"
    Your agent answers data questions, document questions, and cross-source questions. You built two Semantic Views (via SQL or Snowsight UI), created an agent with multiple tools (data, search, web scraper, email, document download), and tested all three routing patterns.

---

## Module 3: Snowflake Intelligence (30 min)

Your agent exists. Now deploy it so anyone on your team can use it — without SQL, without CoCo, without any technical skills. **Snowflake Intelligence** is a chat interface built into Snowflake. Any agent you create automatically appears there.

### Step 3.1: Enable Snowflake Intelligence (if needed)

```sql
USE ROLE ACCOUNTADMIN;
CREATE SNOWFLAKE INTELLIGENCE IF NOT EXISTS SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;
USE ROLE HEALTHCARE_AI_DEMO;
```

!!! info
    This may already be enabled in the lab account. If so, skip ahead to Step 3.2.

### Step 3.2: Open Snowflake Intelligence

1. In Snowsight, look for **Snowflake Intelligence** in the left navigation
2. Your **Denial Management Assistant** should appear in the list
3. Select it to open a conversation

!!! warning
    If the agent does not appear, confirm it was created with the correct role and that you have USAGE granted. Also check the agent has a `display_name` in the profile.

### Step 3.3: Walk Through Real-World Scenarios (15 min)

Now you are in the end-user experience. Forget about SQL for a moment — this is what your revenue cycle team, your clinical reviewers, your executives would see. Type these into Snowflake Intelligence one at a time:

**Scenario 1: Morning Denial Review**

> "Show me all denials from the past 30 days grouped by payer, with the total denied amount for each."

This is a data question — the agent routes to Cortex Analyst, generates SQL, and returns the result. Notice the auto-generated chart.

**Scenario 2: Root Cause Investigation**

> "Why are we getting CO-4 denials from Aetna? What does their policy say about modifier requirements?"

This is a cross-source question — notice the agent uses BOTH tools. It checks the denial data AND searches the Aetna policy documents. The answer combines data and policy.

**Scenario 3: Building an Appeal**

> "We had a $45,000 total knee replacement denied by Blue Cross for prior auth (CO-197). What are their specific requirements and how should we appeal?"

The agent searches the Blue Cross prior auth policy and gives you actionable appeal guidance. This kind of answer used to require a coder, a case manager, and a binder full of payer contracts. Now it is a conversation.

**Scenario 4: Trend Analysis**

> "Show me monthly denial trends. Which months had the highest denied amounts?"

Look for the auto-generated chart. You can ask follow-up questions to dig deeper — "break that down by payer" or "show just prior auth denials."

**Scenario 5: Executive Summary**

> "Give me an executive summary of our denial performance — total denied dollars, top reasons, best and worst payers, and the biggest opportunities to recover revenue."

The agent synthesizes across the entire dataset and gives you a structured executive briefing. Imagine getting this every Monday morning automatically.

### Step 3.4: Customize via CoCo (5 min)

Go back to Cortex Code to refine the experience based on what you just saw. See [Using Cortex Code](using-cortex-code.md) for CoCo setup instructions.

> **"Update the Healthcare_Denial_Management_Agent response instructions to add: 'When generating charts, use a blue color palette. Default to bar charts for comparisons and line charts for trends. Always include a brief plain-English explanation of what the chart shows.'"**

> **"Add these sample questions to the agent: 'Give me an executive summary of denial performance', 'Which denials should we prioritize for appeal?', 'What is our appeal overturn rate by payer?'"**

### Step 3.5: Try It Again

Go back to Snowflake Intelligence and start a new conversation. Try the same questions or new ones. Notice how the responses are more polished with the improved instructions.

!!! success "Checkpoint"
    Business users can have a natural conversation with your denial data through Snowflake Intelligence. No technical skills required. You built the agent in SQL and now it is accessible as a chat interface for the whole team.

---

## Module 4: Streamlit in Snowflake (75 min)

Your final build is a **Streamlit dashboard** — an interactive denial analytics application with filters, KPI cards, charts, and detail tables. This runs inside Snowflake, so the data never leaves your environment.

### Step 4.1: Create the Streamlit App

```sql
CREATE STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP
  RUNTIME_NAME = 'SYSTEM$ST_CONTAINER_RUNTIME_PY3_11'
  QUERY_WAREHOUSE = HEALTHCARE_DEMO_WH
  COMMENT = 'Denial Analytics Dashboard for Revenue Cycle Management';

ALTER STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP ADD LIVE VERSION FROM LAST;
```

Then navigate to **Projects → Streamlit** in Snowsight, open your app, and select **Edit**.

### Step 4.2: Build the Dashboard

Replace the starter code in the Streamlit editor with the following:

```python
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()

st.set_page_config(page_title="Denial Analytics", layout="wide")
st.title("🏥 Denial Analytics Dashboard")
st.caption("Healthcare AI Demo — Revenue Cycle Management")

col1, col2, col3 = st.columns(3)

payers = session.sql("SELECT DISTINCT payer_name FROM HEALTHCARE_AI_DEMO.DENIALS.PAYER_DIM ORDER BY 1").collect()
payer_list = ["All"] + [row["PAYER_NAME"] for row in payers]

departments = session.sql("SELECT DISTINCT department_name FROM HEALTHCARE_AI_DEMO.DENIALS.DEPARTMENT_DIM ORDER BY 1").collect()
dept_list = ["All"] + [row["DEPARTMENT_NAME"] for row in departments]

with col1:
    selected_payer = st.selectbox("Payer", payer_list)
with col2:
    selected_dept = st.selectbox("Department", dept_list)
with col3:
    date_range = st.date_input("Denial Date Range", value=[])

where_clauses = []
if selected_payer != "All":
    where_clauses.append(f"p.payer_name = '{selected_payer}'")
if selected_dept != "All":
    where_clauses.append(f"d.department_name = '{selected_dept}'")
if len(date_range) == 2:
    where_clauses.append(f"f.denial_date BETWEEN '{date_range[0]}' AND '{date_range[1]}'")

where_sql = " AND ".join(where_clauses)
where_sql = f"WHERE {where_sql}" if where_sql else ""

base_join = """
FROM HEALTHCARE_AI_DEMO.DENIALS.DENIAL_CLAIMS_FACT f
JOIN HEALTHCARE_AI_DEMO.DENIALS.PAYER_DIM p ON f.payer_key = p.payer_key
JOIN HEALTHCARE_AI_DEMO.DENIALS.DEPARTMENT_DIM d ON f.department_key = d.department_key
JOIN HEALTHCARE_AI_DEMO.DENIALS.DENIAL_REASON_DIM dr ON f.denial_reason_key = dr.denial_reason_key
JOIN HEALTHCARE_AI_DEMO.DENIALS.APPEAL_STATUS_DIM ast ON f.appeal_status_key = ast.appeal_status_key
JOIN HEALTHCARE_AI_DEMO.DENIALS.PROCEDURE_DIM proc ON f.procedure_key = proc.procedure_key
"""

kpi_query = f"""
SELECT
    COUNT(*) AS total_denials,
    SUM(f.denied_amount) AS total_denied_amount,
    COUNT(CASE WHEN ast.appeal_status = 'Overturned' THEN 1 END) AS appeals_overturned,
    COUNT(CASE WHEN ast.appeal_status IN ('Overturned','Upheld','Appeal Filed') THEN 1 END) AS total_appealed,
    AVG(f.days_to_resolution) AS avg_days_to_resolution
{base_join}
{where_sql}
"""

kpis = session.sql(kpi_query).collect()[0]

k1, k2, k3, k4 = st.columns(4)
k1.metric("Total Denials", f"{kpis['TOTAL_DENIALS']:,}")
k2.metric("Total Denied", f"${kpis['TOTAL_DENIED_AMOUNT']:,.2f}")

appeal_rate = (
    (kpis["APPEALS_OVERTURNED"] / kpis["TOTAL_APPEALED"] * 100)
    if kpis["TOTAL_APPEALED"] and kpis["TOTAL_APPEALED"] > 0
    else 0
)
k3.metric("Appeal Overturn Rate", f"{appeal_rate:.0f}%")

avg_days = kpis["AVG_DAYS_TO_RESOLUTION"] or 0
k4.metric("Avg Days to Resolution", f"{avg_days:.0f}")

st.divider()

chart_col1, chart_col2 = st.columns(2)

with chart_col1:
    st.subheader("Denials by Reason")
    reason_df = session.sql(f"""
        SELECT dr.denial_reason_description AS reason, COUNT(*) AS count
        {base_join}
        {where_sql}
        GROUP BY 1 ORDER BY 2 DESC
    """).to_pandas()
    st.bar_chart(reason_df, x="REASON", y="COUNT")

with chart_col2:
    st.subheader("Denied Amount by Payer")
    payer_df = session.sql(f"""
        SELECT p.payer_name AS payer, SUM(f.denied_amount) AS amount
        {base_join}
        {where_sql}
        GROUP BY 1 ORDER BY 2 DESC
    """).to_pandas()
    st.bar_chart(payer_df, x="PAYER", y="AMOUNT")

st.divider()

st.subheader("Denial Details")
detail_df = session.sql(f"""
    SELECT
        f.claim_id, p.payer_name, proc.procedure_description,
        dr.denial_reason_code, dr.denial_reason_description,
        f.denied_amount, f.denial_date, ast.appeal_status
    {base_join}
    {where_sql}
    ORDER BY f.denial_date DESC
    LIMIT 100
""").to_pandas()
st.dataframe(detail_df, use_container_width=True)
```

Click **Run** to test.

### Step 4.3: View Your App

Navigate to **Projects → Streamlit** in Snowsight, select **DENIAL_ANALYTICS_APP**, and run it. You should see filter dropdowns, KPI cards, bar charts, and a detail table.

!!! tip
    Common issues: missing table references, column name casing, `date_input` returning an empty tuple. If you see errors, check the error message and adjust accordingly.

### Step 4.4: Enhance with Cortex Code (30 min — iterative)

Now use CoCo to add features to the dashboard iteratively. You already have the code — now let CoCo help you add to it. See [Using Cortex Code](using-cortex-code.md) for CoCo setup instructions.

**Enhancement 1 — Add a trend chart:**

> **"Add a line chart below the existing charts that shows denial count by month over time. Use the denial_date from denial_claims_fact. Title it 'Denial Trend Over Time'. Make sure the existing filters apply to this chart too."**

**Enhancement 2 — Add an appeal status breakdown:**

> **"Add a pie chart or donut chart next to the trend chart showing the breakdown of appeal statuses. Title it 'Appeal Status Distribution'."**

**Enhancement 3 — Add actionable insights:**

> **"Add a section at the bottom called 'Key Insights' that automatically calculates and displays: 1) The denial reason with the highest total dollar impact, 2) The payer with the lowest appeal overturn rate, 3) The department with the most denials. Show each as an info callout."**

**Enhancement 4 — Improve styling:**

> **"Make the dashboard look more professional. Improve spacing between sections with dividers. Make the KPI cards more visually prominent. Add descriptive captions under each chart explaining what the user is looking at."**

!!! tip
    Go at your own pace. Feel free to go off-script and ask CoCo for your own enhancements. The goal is to experience the iterative development loop — describe, generate, review, refine.

### Step 4.5: Bonus Enhancements (if time allows)

If you are ahead, try these CoCo prompts:

**Add AI chat to the sidebar:**

> **"Add a sidebar to the Streamlit app with a text input where users can type questions about the denial data. Use Cortex AI Complete to generate natural language answers based on the filtered data currently showing in the dashboard."**

**Add a download button:**

> **"Add a button that lets users download the filtered detail table as a CSV."**

**Add department comparison:**

> **"Add a horizontal bar chart comparing denial rates across departments."**

### Step 4.6: Deploy for Others

```sql
GRANT USAGE ON STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP
  TO ROLE HEALTHCARE_AI_DEMO;
```

!!! success "Checkpoint"
    You have a fully interactive Streamlit dashboard with filters, KPIs, multiple chart types, a detail table, insights, and enhanced styling — all built through a combination of SQL and iterative CoCo prompts.

---

## Wrap-Up

### What You Built

| Component | What It Does | How You Built It |
|-----------|-------------|-----------------|
| **Cortex Search Services** | Searches policy documents and clinical guidelines by meaning | SQL statements |
| **Semantic Views** | Defines data's business meaning for AI queries (denials + appeals) | SQL or Snowsight UI |
| **Cortex Agent** | Answers questions from data + documents, scrapes web, sends email | One SQL statement |
| **Snowflake Intelligence** | Chat interface for the whole team | Opened it — automatic |
| **Streamlit App** | Interactive denial analytics dashboard | Python code + CoCo enhancements |

### Key Takeaways

1. **Cortex Code is the accelerator** — even as a Power User writing SQL, you switched to CoCo for refinement. CoCo accelerates everyone, regardless of technical skill.

2. **The AI stack is fully integrated** — Cortex Search, Cortex Analyst, Cortex Agents, and Snowflake Intelligence all work together. Each layer builds on the last.

3. **Everything is governed** — same Snowflake RBAC, same security, same audit trail. Your data never left Snowflake.

4. **Iterative refinement is natural** — you improved the agent and the dashboard by describing what you wanted changed. That is how real development works with AI assistance.

### What's Next

To take this further with your own data:

- Replace the demo data with your real denial claims and policy documents
- Add verified queries to the semantic view for your most common questions
- Share the Streamlit app and Snowflake Intelligence with your revenue cycle team
- Add more tools to the agent — email alerts, web scraping, document downloads
- Explore the Cortex REST API to embed this AI in your existing applications
