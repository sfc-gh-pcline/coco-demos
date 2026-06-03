# Session 2: Hands-On Lab — Presenter Script (Dual-Track)

> **Duration:** ~3 hours  
> **Format:** Presenter guides the room through both tracks simultaneously  
> **Tracks:**  
> - **Track A — Power Users** (developers, analysts): SQL/UI first, then Cortex Code to refine  
> - **Track B — Business Users** (clinical ops, revenue cycle): Cortex Code (CoCo) does everything  
> **Database:** `HEALTHCARE_AI_DEMO.DENIALS`  
> **Warehouse:** `HEALTHCARE_DEMO_WH`  
> **Prerequisites:** Database, schema, tables, and data are already loaded. Both tracks use the same environment.

---

## Room Setup Notes

- Both tracks are in the same room. You alternate between giving instructions to each group.
- Use clear callouts: **"Power Users..."** and **"Business Users..."** so people know when to act.
- Both tracks follow the same four modules in the same order. The *what* is the same — the *how* is different.
- Power Users work in **Snowsight worksheets** (SQL) and the **Snowsight UI**.
- Business Users work in **Cortex Code** (CoCo).
- Expect Business Users to take slightly longer on some steps (CoCo execution time) and Power Users to take longer on others (writing SQL). The pacing should roughly balance out.
- Where both tracks are doing the same thing at the same time, call it out once.

---

## Opening (5 min)

> **Script:**
>
> Welcome to the hands-on lab. Over the next three hours, you're going to build a complete AI application for healthcare denial management — from scratch.
>
> We have two tracks running simultaneously:
>
> - **Power Users** — you'll write SQL, use the Snowsight UI, and then use Cortex Code to refine and accelerate. You should have a Snowsight worksheet open and ready to go.
> - **Business Users** — you'll do everything through Cortex Code. No SQL required. You should have Cortex Code open and connected. If you're not sure which track you're in, ask now.
>
> Both tracks build the same four things in the same order:
> 1. **Cortex Search** — semantic search over payer policy documents
> 2. **Cortex Agent** — an AI that can query both your data and your documents
> 3. **Snowflake Intelligence** — a chat interface for business users to talk to the agent
> 4. **Streamlit App** — an interactive denial analytics dashboard
>
> The data is already loaded. We have a star schema with ~8,000 denied claims, ~5,100 appeals, 10 payers, 15 departments, 8 facilities, and 9 unstructured policy and clinical guideline documents — all in `HEALTHCARE_AI_DEMO.DENIALS`. Let's start by exploring what we're working with.

---

## Module 0: Data Exploration (15 min)

> **Script:**
>
> Before we build anything, let's understand the data. Both tracks — take a few minutes to explore the database schema and the unstructured documents that are loaded. This is important context for everything that follows.

### Step 0.1: Set Your Context

> **Both tracks — start here.**

**Power Users — run this SQL in a Snowsight worksheet:**

```sql
USE ROLE HEALTHCARE_AI_DEMO;
USE DATABASE HEALTHCARE_AI_DEMO;
USE SCHEMA DENIALS;
USE WAREHOUSE HEALTHCARE_DEMO_WH;
```

**Business Users — type this in Cortex Code:**

> **"Connect me to HEALTHCARE_AI_DEMO.DENIALS using the HEALTHCARE_AI_DEMO role and HEALTHCARE_DEMO_WH warehouse."**

> **Presenter note:** Pause and confirm everyone is connected. If anyone has role or warehouse issues, help them now before proceeding.

### Step 0.2: Explore the Tables

> **Script:**
>
> Let's see what tables are in the schema. We have a star schema — dimension tables that describe entities like payers, departments, and procedures, and fact tables that hold the actual denial claims and appeals.

**Power Users:**

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

**Business Users:**

> **"Show me all the tables in the DENIALS schema with their row counts. I want to understand the data model."**

> **Script:**
>
> You should see 8 dimension tables and 3 fact tables, plus a `parsed_content` table that holds our parsed unstructured documents. The `denial_claims_fact` table has about 8,000 rows — those are our denied claims. The `appeals_fact` table has about 5,100 rows — the appeals filed against those denials.

### Step 0.3: Explore the Star Schema

> **Script:**
>
> Let's look at the key dimensions and understand what data we have. Start with the payers — who are the insurance companies we're dealing with?

**Power Users:**

```sql
SELECT * FROM payer_dim ORDER BY payer_key;
```

```sql
SELECT * FROM denial_reason_dim ORDER BY denial_reason_key;
```

```sql
SELECT * FROM department_dim ORDER BY department_key;
```

**Business Users:**

> **"Show me all the payers in payer_dim, all the denial reasons in denial_reason_dim, and all the departments in department_dim."**

> **Script:**
>
> Notice the payer types — Commercial (Aetna, Blue Cross, UHC, Cigna, Humana), Government (Medicare, Medicaid, Tricare), Marketplace (Ambetter), and Managed Care (Molina).
>
> The denial reasons use CARC codes — industry standard. CO-4 is modifier issues, CO-16 is missing information, CO-197 is prior authorization required, CO-29 is timely filing. These are the codes your revenue cycle team deals with every day.
>
> We also have 15 clinical departments — Cardiology, Orthopedics, Primary Care, Emergency Medicine, and so on.

### Step 0.4: Preview the Fact Data

> **Script:**
>
> Now let's look at the actual denial claims — what does a row look like?

**Power Users:**

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

**Business Users:**

> **"Show me 10 sample rows from denial_claims_fact joined to payer_dim, procedure_dim, denial_reason_dim, appeal_status_dim, and department_dim. I want to see the payer name, procedure description, denial reason code and description, claim amount, denied amount, dates, appeal status, and department name."**

> **Script:**
>
> Each row is a single denied claim. You can see the full picture — who the payer is, what procedure was performed, why it was denied, how much money is at stake, and whether it was appealed. This is the core data we'll build our AI analytics on top of.

### Step 0.5: Quick Summary Statistics

> **Script:**
>
> Let's get a high-level picture of the denial landscape.

**Power Users:**

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

**Business Users:**

> **"Give me a high-level summary of the denial_claims_fact table — total denial count, total denied dollars, average denied amount per claim, the date range of denials, and how many unique payers and departments are represented."**

### Step 0.6: Explore the Unstructured Documents

> **Script:**
>
> Now the other half of the picture — the unstructured documents. We have payer policy documents and internal clinical guidelines stored in an internal stage. They've been parsed using Cortex Parse Document into a `parsed_content` table.

**Power Users:**

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

**Business Users:**

> **"Show me what's in the parsed_content table — the document titles, categories, and a short preview of each document's content."**

> **"Also show me the files stored in the INTERNAL_DATA_STAGE under the unstructured_docs folder."**

> **Script:**
>
> You should see 9 documents — 6 payer policies (Aetna, Blue Cross, UnitedHealthcare, Cigna, CMS Medicare, Georgia Medicaid) and 3 internal clinical guidelines (imaging prior auth, ED visit documentation, denial management workflow).
>
> These are real-world document types your revenue cycle and clinical teams reference daily. The text has been parsed and is ready for Cortex Search to index. Right now, you'd have to manually read through these to find the right policy. After this lab, the AI agent will search them for you.
>
> **Everyone clear on the data? Good. Let's start building.**

---

## Module 1: Cortex Search (30 min)

> **Script:**
>
> Our first build is **Cortex Search** — a fully managed semantic search engine. We're going to index those policy documents so that instead of keyword-matching through PDFs, you can ask a question in natural language and get the relevant policy section back.
>
> Cortex Search combines three techniques — semantic search (understands meaning), keyword search (catches exact codes and terms), and a reranker (puts the best results on top). You create it with a single SQL statement.

### Step 1.1: Create the Search Service

> **Script:**
>
> We're going to create a search service over the payer policy documents. We'll index the `content` column from `parsed_content`, and add `title` and `doc_category` as filterable attributes so we can narrow results by payer or document type.

**Power Users — run this SQL:**

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE POLICY_SEARCH_SERVICE
  ON content
  ATTRIBUTES relative_path, file_url, title, doc_category
  WAREHOUSE = HEALTHCARE_DEMO_WH
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
    SELECT relative_path, file_url, title, doc_category, content
    FROM parsed_content
    WHERE doc_category = 'payer_policies'
);
```

> **What's happening:** Snowflake is embedding each document chunk into vector space for semantic search, building a keyword index for lexical matching, and creating a reranker pipeline. The `TARGET_LAG` means when you add new documents, the index auto-refreshes within an hour.

**Business Users — type this in CoCo:**

> **"Create a Cortex Search Service called POLICY_SEARCH_SERVICE on the parsed_content table in HEALTHCARE_AI_DEMO.DENIALS. Index the content column. Add relative_path, file_url, title, and doc_category as filterable attributes. Use the HEALTHCARE_DEMO_WH warehouse, a target lag of 1 hour, and the snowflake-arctic-embed-l-v2.0 embedding model. Only include rows where doc_category = 'payer_policies'."**

> **Presenter note:** This will take 1-2 minutes to initialize. Use this time to explain what's happening under the hood — Snowflake is chunking the documents, generating embeddings with the Arctic model, building both vector and keyword indexes, and standing up an API endpoint. All managed, no infrastructure.

### Step 1.2: Create the Clinical Guidelines Search Service

> **Script:**
>
> Now let's create a second search service — this one indexes the internal clinical guidelines. Same pattern, different document category.

**Power Users — run this SQL:**

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE CLINICAL_GUIDELINES_SEARCH_SERVICE
  ON content
  ATTRIBUTES relative_path, file_url, title, doc_category
  WAREHOUSE = HEALTHCARE_DEMO_WH
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
    SELECT relative_path, file_url, title, doc_category, content
    FROM parsed_content
    WHERE doc_category = 'clinical_guidelines'
);
```

**Business Users — type this in CoCo:**

> **"Create a second Cortex Search Service called CLINICAL_GUIDELINES_SEARCH_SERVICE on the parsed_content table. Same configuration as the payer policies service — index the content column, add relative_path, file_url, title, and doc_category as attributes, use HEALTHCARE_DEMO_WH, 1 hour target lag, and snowflake-arctic-embed-l-v2.0. But this time only include rows where doc_category = 'clinical_guidelines'."**

### Step 1.3: Verify the Services

> **Script:**
>
> Let's confirm both services were created successfully.

**Power Users:**

```sql
SHOW CORTEX SEARCH SERVICES;

DESCRIBE CORTEX SEARCH SERVICE POLICY_SEARCH_SERVICE;
DESCRIBE CORTEX SEARCH SERVICE CLINICAL_GUIDELINES_SEARCH_SERVICE;
```

**Business Users:**

> **"Show me all Cortex Search services in my schema and describe both POLICY_SEARCH_SERVICE and CLINICAL_GUIDELINES_SEARCH_SERVICE."**

### Step 1.4: Test a Basic Search

> **Script:**
>
> Now the fun part — let's search by meaning. We're going to ask about prior authorization for surgical procedures and see if it finds the Blue Cross surgical prior auth guidelines, even though we're not using the exact same words.

**Power Users:**

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.POLICY_SEARCH_SERVICE',
      '{
        "query": "What are the prior authorization requirements for surgical procedures?",
        "columns": ["title", "doc_category", "content"],
        "limit": 3
      }'
  )
)['results'] AS results;
```

**Business Users:**

> **"Run a search preview against POLICY_SEARCH_SERVICE for the question: 'What are the prior authorization requirements for surgical procedures?' Return the title, doc_category, and content columns. Limit to 3 results."**

> **Script:**
>
> Look at the results. The Blue Cross surgical prior auth guidelines should come back as the top hit — even though we didn't search for "Blue Cross" or "BCBS." That's semantic search in action. It understood the *meaning* of the question.

### Step 1.5: Test a Filtered Search

> **Script:**
>
> Now let's add a filter. What if you only want to search Aetna's policies? Filters let you narrow the semantic search to specific payers, document types, or any attribute you defined.

**Power Users:**

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.POLICY_SEARCH_SERVICE',
      '{
        "query": "What are the modifier requirements for cardiac catheterization?",
        "columns": ["title", "doc_category", "content"],
        "filter": {"@eq": {"title": "Aetna_Cardiac_Catheterization_Policy.txt"}},
        "limit": 2
      }'
  )
)['results'] AS results;
```

**Business Users:**

> **"Search POLICY_SEARCH_SERVICE for 'modifier requirements for cardiac catheterization' but filter only for documents with the title containing 'Aetna'. Show me the results."**

### Step 1.6: Test the Clinical Guidelines Service

> **Script:**
>
> Now let's test the second service — the clinical guidelines. These are your internal operational documents.

**Power Users:**

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_DEMO.DENIALS.CLINICAL_GUIDELINES_SEARCH_SERVICE',
      '{
        "query": "What is the imaging prior authorization process?",
        "columns": ["title", "doc_category", "content"],
        "limit": 3
      }'
  )
)['results'] AS results;
```

**Business Users:**

> **"Run a search preview against CLINICAL_GUIDELINES_SEARCH_SERVICE for the question: 'What is the imaging prior authorization process?' Return the title, doc_category, and content columns. Limit to 3 results."**

### Step 1.7: Try Additional Searches (5 min — self-paced)

> **Script:**
>
> Both tracks — take a few minutes to try your own searches against either service. Here are some ideas:

**Power Users** — try modifying the query and filter values in the SQL templates above. Some questions to try:
- `"timely filing requirements for Medicare claims"` (payer policies service)
- `"what documentation is required for specialist visit claims"` (filter to UnitedHealthcare)
- `"coverage exclusions for cosmetic procedures"` (filter to Cigna)
- `"ED visit documentation levels"` (clinical guidelines service)
- `"denial management appeals workflow"` (clinical guidelines service)

**Business Users** — try these CoCo prompts:
- **"Search payer policies for 'how to avoid timely filing denials'"**
- **"Search payer policies for 'what documentation is required for specialist visit claims' filtered to UnitedHealthcare"**
- **"Search clinical guidelines for 'ED visit level documentation'"**
- **"Search clinical guidelines for 'denial management appeals workflow'"**

> **Checkpoint:**
>
> Everyone should be able to search policy documents by meaning and get relevant results. Raise your hand if you're stuck.
>
> Key takeaway: you created a semantic search engine in one SQL statement. No vector database, no embedding pipeline, no MLOps. Snowflake handles all of it.

---

## Module 2: Cortex Agent (30 min)

> **Script:**
>
> Now we're going to build an **agent** — an AI that can answer questions from BOTH your denial data (numbers) AND your policy documents (text).
>
> A Cortex Agent uses multiple tools. When you ask a question, the agent figures out which tool to use:
> - **Data question** (counts, trends, dollars) → routes to Cortex Analyst (text-to-SQL via a Semantic View)
> - **Document question** (payer policies, guidelines) → routes to Cortex Search
> - **Both** → uses both tools and synthesizes the answer
>
> We need to build two things: first, a Semantic View so the agent can query our denial data, then the agent itself.

### Step 2.1: Create a Semantic View

> **Script:**
>
> A Semantic View is a business-level description of your data model. It tells Cortex Analyst what each column means, how tables relate, and what metrics to calculate. Think of it as a translator between "What's our denial rate by payer?" and the actual SQL with joins and aggregations.

**Power Users — two options. Use whichever you prefer:**

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

**Business Users — type this in CoCo:**

> **"Create a semantic view called DENIAL_ANALYTICS_SV in HEALTHCARE_AI_DEMO.DENIALS over the DENIAL_CLAIMS_FACT table. Join it to PAYER_DIM, PROCEDURE_DIM, DEPARTMENT_DIM, FACILITY_DIM, DENIAL_REASON_DIM, APPEAL_STATUS_DIM, and PROVIDER_DIM. The description should be: 'Semantic view for healthcare denial claims analytics — covers denial volumes, reason codes, payer comparisons, appeal outcomes, financial impact, and resolution timelines.' Include all columns from all tables. Add metrics for total denials, total denied amount, total charges, average denied amount, denial rate, and average days to resolution."**

> **Tip for Business Users:** If CoCo asks you questions about configuration, say: **"Use sensible defaults for a denial analytics use case."**

### Step 2.2: Verify the Semantic View

**Power Users:**

```sql
SHOW SEMANTIC VIEWS;
```

**Business Users:**

> **"Show me the semantic views in my schema."**

### Step 2.3: Create the Agent

> **Script:**
>
> Now we connect everything into an agent. The agent gets three tools — the semantic view for data queries, and both search services for document queries. We also add instructions telling the agent when to use each tool.

**Power Users — run this SQL:**

```sql
CREATE OR REPLACE AGENT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_MANAGEMENT_AGENT
  COMMENT = 'Agent for healthcare denial management — queries structured denial data and searches policy documents'
  PROFILE = '{"display_name": "Denial Management Assistant", "color": "blue"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto

  orchestration:
    budget:
      seconds: 60
      tokens: 16000

  instructions:
    response: "You are a healthcare denial management assistant. Provide clear, actionable insights about claim denials, appeal strategies, and payer policies. Always cite your sources — reference specific policy documents or data queries. When showing financial data, format as currency. When showing dates, use MM/DD/YYYY format."
    orchestration: "For questions about denial volumes, trends, financial impact, appeal outcomes, or any quantitative metrics, use the Denial_Analytics tool. For questions about payer policies, coverage criteria, documentation requirements, or denial reason explanations, use the Payer_Policy_Search tool. For questions about internal clinical guidelines, coding standards, imaging authorization processes, or workflow procedures, use the Clinical_Guidelines_Search tool. If a question spans both structured data and documents, use multiple tools."

  sample_questions:
    - question: "What are our top denial reasons this quarter?"
    - question: "What does the Aetna policy say about cardiac catheterization coverage?"
    - question: "Which payer has the highest denial rate, and what are their common denial reasons?"
    - question: "How can we reduce CO-197 (prior auth required) denials?"
    - question: "What do our internal guidelines say about imaging prior authorization?"

  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "Denial_Analytics"
        description: "Queries structured denial claims data. Use for questions about denial counts, rates, trends, financial amounts, appeal outcomes, resolution timelines, payer comparisons, department breakdowns, and any quantitative analysis of claim denials."
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
        description: "Generates visualizations from denial data queries"

  tool_resources:
    Denial_Analytics:
      semantic_view: "HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_SV"
      execution_environment:
        type: warehouse
        warehouse: "HEALTHCARE_DEMO_WH"
    Payer_Policy_Search:
      name: "HEALTHCARE_AI_DEMO.DENIALS.POLICY_SEARCH_SERVICE"
      max_results: "5"
      title_column: "TITLE"
      id_column: "RELATIVE_PATH"
    Clinical_Guidelines_Search:
      name: "HEALTHCARE_AI_DEMO.DENIALS.CLINICAL_GUIDELINES_SEARCH_SERVICE"
      max_results: "5"
      title_column: "TITLE"
      id_column: "RELATIVE_PATH"
  $$;
```

**Business Users — type this in CoCo:**

> **"Create a Cortex Agent called DENIAL_MANAGEMENT_AGENT in HEALTHCARE_AI_DEMO.DENIALS with the following configuration:**
>
> **Display name: 'Denial Management Assistant', color: blue. Use auto model selection.**
>
> **Response instructions: 'You are a healthcare denial management assistant. Provide clear, actionable insights about claim denials, appeal strategies, and payer policies. Always cite your sources. Format financial data as currency. Format dates as MM/DD/YYYY.'**
>
> **Orchestration instructions: 'For questions about denial volumes, trends, financial impact, appeal outcomes, or any quantitative metrics, use the Denial_Analytics tool. For questions about payer policies, coverage criteria, documentation requirements, or denial reason explanations, use the Payer_Policy_Search tool. For questions about internal clinical guidelines, coding standards, imaging authorization processes, or workflow procedures, use the Clinical_Guidelines_Search tool. If a question spans both data and documents, use multiple tools.'**
>
> **Add three tools:**
> **1. A Cortex Analyst tool named 'Denial_Analytics' using semantic view HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_SV with warehouse HEALTHCARE_DEMO_WH.**
> **2. A Cortex Search tool named 'Payer_Policy_Search' using search service HEALTHCARE_AI_DEMO.DENIALS.POLICY_SEARCH_SERVICE with max_results 5, title_column TITLE, id_column RELATIVE_PATH.**
> **3. A Cortex Search tool named 'Clinical_Guidelines_Search' using search service HEALTHCARE_AI_DEMO.DENIALS.CLINICAL_GUIDELINES_SEARCH_SERVICE with max_results 5, title_column TITLE, id_column RELATIVE_PATH.**
>
> **Also add a data_to_chart tool.**
>
> **Add sample questions: 'What are our top denial reasons this quarter?', 'What does the Aetna policy say about cardiac catheterization coverage?', 'Which payer has the highest denial rate?', 'How can we reduce CO-197 denials?', 'What do our internal guidelines say about imaging prior authorization?'"**

### Step 2.4: Grant Access

**Power Users only** (Business Users — CoCo may have done this automatically):

```sql
GRANT USAGE ON AGENT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_MANAGEMENT_AGENT
  TO ROLE HEALTHCARE_AI_DEMO;
```

### Step 2.5: Test the Agent

> **Script:**
>
> Let's test three scenarios to make sure the agent routes correctly — a data question, a document question, and a cross-source question.

> **Both tracks — test these. Power Users can test in Snowsight (AI & ML → Agents → select DENIAL_MANAGEMENT_AGENT) or via CoCo. Business Users use CoCo.**

**Test 1 — Data question (should use Denial_Analytics):**

**Power Users** — In the Agent UI, type: "What are the top 5 denial reasons by total denied amount?"

**Business Users:**

> **"Query the DENIAL_MANAGEMENT_AGENT: What are the top 5 denial reasons by total denied amount?"**

**Test 2 — Document question (should use Payer_Policy_Search):**

**Power Users** — Type: "What does the Blue Cross policy say about prior authorization for surgical procedures?"

**Business Users:**

> **"Query the DENIAL_MANAGEMENT_AGENT: What does the Blue Cross policy say about prior authorization for surgical procedures?"**

**Test 3 — Cross-source question (should use BOTH tools):**

**Power Users** — Type: "We're seeing CO-16 denials from UnitedHealthcare. How many do we have, what's the dollar impact, and what documentation should we be including to prevent these?"

**Business Users:**

> **"Query the DENIAL_MANAGEMENT_AGENT: We're seeing CO-16 denials from UnitedHealthcare. How many do we have, what's the dollar impact, and what documentation should we be including to prevent these?"**

> **Script:**
>
> That last question is the key moment. Watch what happens — the agent should use BOTH tools. It queries the denial data to count CO-16 denials and sum the dollars, then searches the UnitedHealthcare policy document to find what documentation is required. The answer combines data and policy into a single actionable response. That's a 30-minute workflow done in 30 seconds.

### Step 2.6: Refine with Cortex Code (5 min — both tracks)

> **Script:**
>
> Now everyone — both tracks — open Cortex Code and let's improve the agent. This is where CoCo shines for Power Users too — iterative refinement.

**Both tracks — try in CoCo:**

> **"Look at the DENIAL_MANAGEMENT_AGENT and suggest improvements to the instructions or tool descriptions to make it more accurate and helpful."**

> **"Update the agent's response instructions to always include an 'Action Items' section with specific steps the revenue cycle team should take."**

> **Checkpoint:**
>
> Your agent answers data questions, document questions, and cross-source questions. Both tracks built the same result — Power Users through SQL, Business Users through CoCo. Raise your hand if you're stuck.

---

## Module 3: Snowflake Intelligence (30 min)

> **Script:**
>
> Your agent exists. Now let's deploy it so anyone on your team can use it — without SQL, without CoCo, without any technical skills. **Snowflake Intelligence** is a chat interface built into Snowflake. Any agent you create automatically appears there.
>
> This module is the same experience for both tracks. Everyone is going to open Snowflake Intelligence and talk to the agent.

### Step 3.1: Enable Snowflake Intelligence (if needed)

**Power Users:**

```sql
USE ROLE ACCOUNTADMIN;
CREATE SNOWFLAKE INTELLIGENCE IF NOT EXISTS SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;
USE ROLE HEALTHCARE_AI_DEMO;
```

**Business Users:**

> **"Check if Snowflake Intelligence is enabled. If not, create the default Snowflake Intelligence object using ACCOUNTADMIN."**

> **Presenter note:** This may already be enabled in the lab account. If so, skip ahead.

### Step 3.2: Open Snowflake Intelligence

> **Script:**
>
> Both tracks — switch to the Snowsight UI now.

1. In Snowsight, look for **Snowflake Intelligence** in the left navigation
2. Your **Denial Management Assistant** should appear in the list
3. Select it to open a conversation

> **Presenter note:** If the agent doesn't appear, confirm it was created with the correct role and that the user has USAGE granted. Also check the agent has a `display_name` in the profile.

### Step 3.3: Walk Through Real-World Scenarios (15 min)

> **Script:**
>
> Now you're in the end-user experience. Forget about SQL and CoCo for a moment — this is what your revenue cycle team, your clinical reviewers, your executives would see. Let's walk through scenarios they'd actually use.

**Everyone — type these into Snowflake Intelligence one at a time:**

**Scenario 1: Morning Denial Review**
> "Show me all denials from the past 30 days grouped by payer, with the total denied amount for each."

> **Script:** This is a data question — the agent routes to Cortex Analyst, generates SQL, and returns the result. Notice the auto-generated chart.

**Scenario 2: Root Cause Investigation**
> "Why are we getting CO-4 denials from Aetna? What does their policy say about modifier requirements?"

> **Script:** This is a cross-source question — notice the agent uses BOTH tools. It checks the denial data AND searches the Aetna policy documents. The answer combines data and policy.

**Scenario 3: Building an Appeal**
> "We had a $45,000 total knee replacement denied by Blue Cross for prior auth (CO-197). What are their specific requirements and how should we appeal?"

> **Script:** The agent searches the Blue Cross prior auth policy and gives you actionable appeal guidance. This kind of answer used to require a coder, a case manager, and a binder full of payer contracts. Now it's a conversation.

**Scenario 4: Trend Analysis**
> "Show me monthly denial trends. Which months had the highest denied amounts?"

> **Script:** Look for the auto-generated chart. You can ask follow-up questions to dig deeper — "break that down by payer" or "show just prior auth denials."

**Scenario 5: Executive Summary**
> "Give me an executive summary of our denial performance — total denied dollars, top reasons, best and worst payers, and the biggest opportunities to recover revenue."

> **Script:** This is the power demo. The agent synthesizes across the entire dataset and gives you a structured executive briefing. Imagine getting this every Monday morning automatically.

### Step 3.4: Customize via CoCo (5 min)

> **Script:**
>
> Go back to Cortex Code to refine the experience based on what you just saw.

**Both tracks — try in CoCo:**

> **"Update the DENIAL_MANAGEMENT_AGENT response instructions to add: 'When generating charts, use a blue color palette. Default to bar charts for comparisons and line charts for trends. Always include a brief plain-English explanation of what the chart shows.'"**

> **"Add these sample questions to the agent: 'Give me an executive summary of denial performance', 'Which denials should we prioritize for appeal?', 'What is our appeal overturn rate by payer?'"**

### Step 3.5: Try It Again

> **Script:**
>
> Go back to Snowflake Intelligence and start a new conversation. Try the same questions or new ones. Notice how the responses are more polished with the improved instructions.

> **Checkpoint:**
>
> Business users can have a natural conversation with your denial data through Snowflake Intelligence. No technical skills required. Both tracks arrived at the same end-user experience — one through SQL, one through CoCo.

---

## Module 4: Streamlit in Snowflake (75 min)

> **Script:**
>
> Our final build is a **Streamlit dashboard** — an interactive denial analytics application with filters, KPI cards, charts, and detail tables. This runs inside Snowflake, so the data never leaves your environment.
>
> This is where the tracks diverge the most. Power Users will write Python code in the Snowsight editor. Business Users will describe what they want and CoCo will write the entire app.

### Step 4.1: Create the Streamlit App

**Power Users:**

```sql
CREATE STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP
  RUNTIME_NAME = 'SYSTEM$ST_CONTAINER_RUNTIME_PY3_11'
  QUERY_WAREHOUSE = HEALTHCARE_DEMO_WH
  COMMENT = 'Denial Analytics Dashboard for Revenue Cycle Management';

ALTER STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP ADD LIVE VERSION FROM LAST;
```

Then navigate to **Projects → Streamlit** in Snowsight, open your app, and select **Edit**.

**Business Users:**

> **"Create a new Streamlit app called DENIAL_ANALYTICS_APP in HEALTHCARE_AI_DEMO.DENIALS using the container runtime and HEALTHCARE_DEMO_WH warehouse."**

### Step 4.2: Build the Dashboard

> **Script:**
>
> Now we write the app. Power Users — paste the code below into the Streamlit editor. Business Users — describe what you want and let CoCo write it.

**Power Users — replace the starter code with this:**

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

**Business Users — type this in CoCo:**

> **"Write a Streamlit app for DENIAL_ANALYTICS_APP that creates a Denial Analytics Dashboard. It should have:**
>
> **1. A title 'Denial Analytics Dashboard' with a hospital emoji and a caption**
> **2. Three filter dropdowns: Payer (from payer_dim with an 'All' option), Department (from department_dim with an 'All' option), and a date range picker for denial dates**
> **3. Four KPI metric cards in a row: Total Denials (count), Total Denied Amount (currency), Appeal Overturn Rate (percentage), and Average Days to Resolution**
> **4. Two charts side by side: a bar chart of denials by reason code (left) and a bar chart of denied amount by payer (right)**
> **5. A detail table at the bottom showing denial records with claim_id, payer_name, procedure_description, denial_reason_code, denial_reason_description, denied_amount, denial_date, appeal_status**
>
> **All data comes from HEALTHCARE_AI_DEMO.DENIALS — join denial_claims_fact to payer_dim, department_dim, denial_reason_dim, appeal_status_dim, and procedure_dim. The filters should dynamically update all KPIs, charts, and the detail table. Use wide layout. Limit the detail table to 100 rows."**

### Step 4.3: View Your App

> **Script:**
>
> Both tracks — navigate to **Projects → Streamlit** in Snowsight, select **DENIAL_ANALYTICS_APP**, and run it. You should see filter dropdowns, KPI cards, bar charts, and a detail table.

> **Presenter note:** Give people 2-3 minutes to look at their dashboards. Walk the room and help anyone with errors. Common issues: missing table references, column name casing, date_input returning empty tuple.

### Step 4.4: Enhance with Cortex Code (30 min — iterative)

> **Script:**
>
> Now both tracks — this is where CoCo accelerates development for everyone. We're going to add features to the dashboard iteratively. Power Users: you already have the code — now let CoCo help you add to it. Business Users: you've been doing this all along.

**Enhancement 1 — Add a trend chart:**

> **Both tracks — type in CoCo:**
>
> **"Add a line chart below the existing charts that shows denial count by month over time. Use the denial_date from denial_claims_fact. Title it 'Denial Trend Over Time'. Make sure the existing filters apply to this chart too."**

**Enhancement 2 — Add an appeal status breakdown:**

> **"Add a pie chart or donut chart next to the trend chart showing the breakdown of appeal statuses. Title it 'Appeal Status Distribution'."**

**Enhancement 3 — Add actionable insights:**

> **"Add a section at the bottom called 'Key Insights' that automatically calculates and displays: 1) The denial reason with the highest total dollar impact, 2) The payer with the lowest appeal overturn rate, 3) The department with the most denials. Show each as an info callout."**

**Enhancement 4 — Improve styling:**

> **"Make the dashboard look more professional. Improve spacing between sections with dividers. Make the KPI cards more visually prominent. Add descriptive captions under each chart explaining what the user is looking at."**

> **Presenter note:** Let people work through these at their own pace. Walk the room. Encourage people to go off-script and ask CoCo for their own enhancements. The goal is for people to experience the iterative development loop — describe → generate → review → refine.

### Step 4.5: Bonus Enhancements (if time allows)

> **Script:**
>
> If you're ahead, try these:

**Add AI chat to the sidebar:**

> **"Add a sidebar to the Streamlit app with a text input where users can type questions about the denial data. Use Cortex AI Complete to generate natural language answers based on the filtered data currently showing in the dashboard."**

**Add a download button:**

> **"Add a button that lets users download the filtered detail table as a CSV."**

**Add department comparison:**

> **"Add a horizontal bar chart comparing denial rates across departments."**

### Step 4.6: Deploy for Others

**Power Users:**

```sql
GRANT USAGE ON STREAMLIT HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_APP
  TO ROLE HEALTHCARE_AI_DEMO;
```

**Business Users:**

> **"Make the DENIAL_ANALYTICS_APP accessible to the HEALTHCARE_AI_DEMO role."**

> **Checkpoint:**
>
> You have a fully interactive Streamlit dashboard with filters, KPIs, multiple chart types, a detail table, insights, and enhanced styling — all built through conversation with CoCo.

---

## Wrap-Up (10 min)

> **Script:**
>
> Let's take a step back and look at what you built in the last three hours.

### What You Built

| Component | What It Does | Power Users Built With | Business Users Built With |
|-----------|-------------|----------------------|--------------------------|
| **Cortex Search Service** | Searches policy documents by meaning | One SQL statement | One CoCo prompt |
| **Semantic View** | Defines data's business meaning for AI queries | SQL or Snowsight UI | One CoCo prompt |
| **Cortex Agent** | Answers questions from data + documents | One SQL statement | One CoCo prompt |
| **Snowflake Intelligence** | Chat interface for the whole team | Opened it — automatic | Opened it — automatic |
| **Streamlit App** | Interactive denial analytics dashboard | Python code + CoCo enhancements | All CoCo prompts |

### Key Takeaways

> **Script:**
>
> 1. **Same result, two paths** — Power Users wrote SQL and Python. Business Users described what they wanted in English. Both arrived at the same working AI application. The right approach depends on your team and your comfort level.
>
> 2. **Cortex Code is the great equalizer** — even if you started in the Power User track writing SQL, you switched to CoCo for refinement. CoCo accelerates everyone, regardless of technical skill.
>
> 3. **The AI stack is fully integrated** — Cortex Search, Cortex Analyst, Cortex Agents, and Snowflake Intelligence all work together. Each layer builds on the last.
>
> 4. **Everything is governed** — same Snowflake RBAC, same security, same audit trail. Your data never left Snowflake.
>
> 5. **Iterative refinement is natural** — you improved the agent and the dashboard by describing what you wanted changed. That's how real development works with AI assistance.

### What's Next

> **Script:**
>
> To take this further with your own data:
>
> - Replace the demo data with your real denial claims and policy documents
> - Add verified queries to the semantic view for your most common questions
> - Share the Streamlit app and Snowflake Intelligence with your revenue cycle team
> - Add more tools to the agent — email alerts, web scraping, document downloads
> - Explore the Cortex REST API to embed this AI in your existing applications
>
> Questions?

---

## Presenter Timing Reference

| Module | Content | Target Duration | Cumulative |
|--------|---------|----------------|------------|
| Opening | Introduction, track assignments | 5 min | 0:05 |
| Module 0 | Data exploration | 15 min | 0:20 |
| Module 1 | Cortex Search | 30 min | 0:50 |
| *Break* | *Stretch break* | *5 min* | *0:55* |
| Module 2 | Cortex Agent + Semantic View | 30 min | 1:25 |
| Module 3 | Snowflake Intelligence | 30 min | 1:55 |
| *Break* | *Stretch break* | *5 min* | *2:00* |
| Module 4 | Streamlit App | 75 min | 3:15 |
| Wrap-Up | Recap + Q&A | 10 min | 3:25 |

> **Presenter notes:**
> - Build in two 5-minute breaks (after Module 1 and after Module 3). People get fatigued in a 3-hour lab.
> - Module 4 is intentionally the longest — it's hands-on and iterative. Let people explore.
> - If time is tight, Module 3 can be compressed — the agent already works, you're just showing the Snowflake Intelligence UI.
> - If someone finishes early, point them to the Bonus Enhancements in Step 4.5 or ask them to help neighbors.
> - Keep `demo_setup.sql` open in a separate tab — if anyone's environment is broken, you can re-run the relevant section to get them caught up.
