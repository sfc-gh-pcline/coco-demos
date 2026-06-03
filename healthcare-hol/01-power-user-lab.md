# Power User Lab Guide: Building AI-Powered Healthcare Analytics

> **Duration:** ~3 hours  
> **Track:** Power User — SQL/UI first, then refine with Cortex Code  
> **Audience:** Healthcare IT / data teams comfortable with SQL and Snowflake UI  
> **What you'll build:** Cortex Search → Cortex Agent → Snowflake Intelligence → Streamlit App  

---

## Prerequisites

Before starting, confirm you have:

- [ ] A Snowflake account with `ACCOUNTADMIN` or a role with `CREATE CORTEX SEARCH SERVICE`, `CREATE AGENT`, `CREATE SEMANTIC VIEW`, and `CREATE STREAMLIT` privileges
- [ ] A warehouse (e.g., `HOL_WH`) — size XS or S is fine
- [ ] Cross-region inference enabled (recommended):
  ```sql
  ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';
  ```
- [ ] The `SNOWFLAKE.CORTEX_USER` database role granted to your role

---

## Environment Setup (10 min)

Run the following SQL to create your lab environment and load sample data.

```sql
-- Create lab database and schema
CREATE DATABASE IF NOT EXISTS HEALTHCARE_AI_LAB;
CREATE SCHEMA IF NOT EXISTS HEALTHCARE_AI_LAB.DENIALS;

USE DATABASE HEALTHCARE_AI_LAB;
USE SCHEMA DENIALS;

-- Create warehouse if needed
CREATE WAREHOUSE IF NOT EXISTS HOL_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 120
  AUTO_RESUME = TRUE;

USE WAREHOUSE HOL_WH;
```

### Load Denials Data (Structured)

```sql
CREATE OR REPLACE TABLE DENIAL_CLAIMS (
    claim_id VARCHAR,
    patient_id VARCHAR,
    payer_name VARCHAR,
    procedure_code VARCHAR,
    procedure_description VARCHAR,
    denial_reason_code VARCHAR,
    denial_reason_description VARCHAR,
    claim_amount DECIMAL(10,2),
    denied_amount DECIMAL(10,2),
    date_of_service DATE,
    denial_date DATE,
    appeal_status VARCHAR,
    appeal_outcome VARCHAR,
    days_to_resolution INT,
    facility VARCHAR,
    department VARCHAR
);

-- TODO: Replace with actual data load from stage
-- COPY INTO DENIAL_CLAIMS FROM @your_stage/denials_data.csv
--   FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1);

-- Sample data for lab purposes
INSERT INTO DENIAL_CLAIMS VALUES
('CLM-001','P1001','Aetna','93458','Left Heart Catheterization','CO-4','Procedure code inconsistent with modifier','12500.00','12500.00','2025-01-15','2025-02-01','Appealed','Overturned',45,'Main Campus','Cardiology'),
('CLM-002','P1002','UnitedHealth','99213','Office Visit - Level 3','CO-16','Missing information','250.00','250.00','2025-01-20','2025-02-10','Appealed','Upheld',30,'Outpatient Clinic','Primary Care'),
('CLM-003','P1003','Blue Cross','27447','Total Knee Replacement','CO-197','Prior authorization required','45000.00','45000.00','2025-02-01','2025-02-15','Pending',NULL,NULL,'Main Campus','Orthopedics'),
('CLM-004','P1004','Cigna','99232','Hospital Visit - Level 2','PR-204','Service not covered','500.00','500.00','2025-02-05','2025-02-20','Not Appealed',NULL,NULL,'Main Campus','Internal Medicine'),
('CLM-005','P1005','Aetna','43239','Upper GI Endoscopy with Biopsy','CO-4','Procedure code inconsistent with modifier','8500.00','8500.00','2025-02-10','2025-03-01','Appealed','Overturned',35,'Endoscopy Center','Gastroenterology'),
('CLM-006','P1006','Medicaid','99284','ED Visit - Level 4','CO-29','Timely filing limit exceeded','1200.00','1200.00','2024-11-15','2025-03-01','Not Appealed',NULL,NULL,'Emergency Dept','Emergency Medicine'),
('CLM-007','P1007','UnitedHealth','93306','Echocardiography','CO-16','Missing information','3500.00','3500.00','2025-03-01','2025-03-15','Appealed','Pending',NULL,'Main Campus','Cardiology'),
('CLM-008','P1008','Blue Cross','70553','MRI Brain with and without contrast','CO-197','Prior authorization required','6000.00','6000.00','2025-03-10','2025-03-25','Appealed','Overturned',20,'Imaging Center','Radiology'),
('CLM-009','P1009','Aetna','99214','Office Visit - Level 4','PR-1','Deductible amount','350.00','125.00','2025-03-15','2025-04-01','Not Appealed',NULL,NULL,'Outpatient Clinic','Primary Care'),
('CLM-010','P1010','Cigna','29881','Knee Arthroscopy','CO-197','Prior authorization required','15000.00','15000.00','2025-03-20','2025-04-05','Pending',NULL,NULL,'Surgery Center','Orthopedics');
```

### Load Policy Documents (Unstructured)

```sql
CREATE OR REPLACE TABLE POLICY_DOCUMENTS (
    document_id VARCHAR,
    payer_name VARCHAR,
    document_type VARCHAR,
    document_title VARCHAR,
    effective_date DATE,
    document_text VARCHAR
);

-- TODO: Replace with actual document data from stage
-- COPY INTO POLICY_DOCUMENTS FROM @your_stage/policy_docs.csv
--   FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1);

-- Sample policy documents for lab purposes
INSERT INTO POLICY_DOCUMENTS VALUES
('DOC-001','Aetna','Coverage Policy','Cardiac Catheterization Coverage Criteria','2025-01-01',
 'Coverage Criteria for Cardiac Catheterization: Prior authorization is NOT required for diagnostic left heart catheterization (CPT 93458) when performed in an inpatient setting with documented clinical indication. Outpatient diagnostic catheterization requires prior authorization when performed on patients without acute coronary syndrome presentation. Documentation must include: 1) Clinical indication and symptoms, 2) Results of non-invasive testing (stress test, echocardiography), 3) Risk stratification assessment. Denial reason CO-4 (procedure code inconsistent with modifier) commonly occurs when the setting of care modifier is missing or incorrect. Ensure modifier -26 (professional component) or -TC (technical component) is applied correctly.'),
('DOC-002','Blue Cross','Prior Authorization Guidelines','Prior Authorization Requirements - Surgical Procedures','2025-01-01',
 'Prior Authorization Requirements: All elective surgical procedures with expected charges exceeding $5,000 require prior authorization submitted at least 14 business days before the scheduled procedure date. Emergency and urgent procedures are exempt from prior authorization requirements but must be reported within 48 hours of the procedure. Required documentation: 1) Procedure CPT code and description, 2) Clinical rationale and supporting medical records, 3) Conservative treatment history (minimum 6 weeks for orthopedic procedures), 4) Imaging results dated within 90 days. Failure to obtain prior authorization will result in denial with reason code CO-197. Appeals must include proof of medical necessity and clinical urgency.'),
('DOC-003','UnitedHealth','Claims Submission Guide','Claims Documentation Requirements','2025-01-01',
 'Claims Documentation Requirements: All claims must include complete patient demographics, insurance information, and clinical documentation to avoid denial reason CO-16 (missing information). Required fields: 1) Patient full name and date of birth, 2) Member ID and group number, 3) Rendering provider NPI, 4) Place of service code, 5) Diagnosis codes supporting medical necessity (ICD-10), 6) Procedure codes with appropriate modifiers. Common causes of CO-16 denials: missing referring provider information for specialist visits, incomplete authorization numbers, and missing accident/injury date for trauma-related claims. Claims missing required information will be denied. Corrected claims must be resubmitted within 90 days of the denial date.'),
('DOC-004','General','CMS Guidelines','Medicare Timely Filing Requirements','2024-01-01',
 'Medicare Timely Filing Requirements: Original Medicare claims must be filed within 12 months (365 days) of the date of service. Medicare Advantage plans may have shorter filing deadlines, typically 90-180 days depending on the plan. Denial reason CO-29 (timely filing limit exceeded) cannot be appealed on the basis of medical necessity — the only valid appeal basis is proof of timely submission (e.g., original submission confirmation, clearinghouse transmission records). To prevent timely filing denials: 1) Submit claims within 48 hours of service, 2) Monitor claim status at 14-day intervals, 3) Set automated alerts for claims approaching the filing deadline, 4) Maintain clearinghouse transmission logs as proof of submission.'),
('DOC-005','Cigna','Coverage Policy','Non-Covered Services and Exclusions','2025-01-01',
 'Non-Covered Services and Exclusions: The following services are excluded from coverage under standard benefit plans and will be denied with reason code PR-204 (service not covered by plan): 1) Experimental or investigational procedures not FDA-approved, 2) Cosmetic procedures without documented functional impairment, 3) Services rendered outside the network without prior authorization (except emergencies), 4) Duplicate services within the same date of service. For services denied as not covered, members may request a coverage exception or file a formal appeal if they believe the service should be covered under their specific benefit plan. Appeals must be filed within 60 days of the denial notice and include supporting clinical documentation demonstrating medical necessity.');
```

---

## Module 1: Cortex Search (30 min)

**Objective:** Index policy and clinical documents for fast hybrid search.

### Step 1.1: Create the Cortex Search Service (SQL)

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE POLICY_SEARCH_SERVICE
  ON document_text
  ATTRIBUTES payer_name, document_type
  WAREHOUSE = HOL_WH
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
    SELECT
        document_id,
        payer_name,
        document_type,
        document_title,
        effective_date,
        document_text
    FROM POLICY_DOCUMENTS
);
```

> **What's happening:** Snowflake is embedding each document chunk into vector space for semantic search, building a keyword index for lexical matching, and creating a reranker pipeline — all in one statement. The `TARGET_LAG` of 1 hour means when you add new documents to `POLICY_DOCUMENTS`, the search index updates within an hour.

### Step 1.2: Verify the Service

```sql
SHOW CORTEX SEARCH SERVICES;

DESCRIBE CORTEX SEARCH SERVICE POLICY_SEARCH_SERVICE;
```

### Step 1.3: Test with SEARCH_PREVIEW

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_LAB.DENIALS.POLICY_SEARCH_SERVICE',
      '{
        "query": "What are the prior authorization requirements for surgical procedures?",
        "columns": ["document_title", "payer_name", "document_text"],
        "limit": 3
      }'
  )
)['results'] AS results;
```

### Step 1.4: Test with a Filtered Search

```sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
      'HEALTHCARE_AI_LAB.DENIALS.POLICY_SEARCH_SERVICE',
      '{
        "query": "denial code CO-4 modifier requirements",
        "columns": ["document_title", "payer_name", "document_text"],
        "filter": {"@eq": {"payer_name": "Aetna"}},
        "limit": 2
      }'
  )
)['results'] AS results;
```

### Step 1.5: Refine with Cortex Code

Open Cortex Code and try:

> **Prompt:** "I created a Cortex Search service called POLICY_SEARCH_SERVICE in HEALTHCARE_AI_LAB.DENIALS. Can you run a search preview for 'timely filing requirements for Medicare claims' and format the results nicely?"

> **Prompt:** "Can you help me add a PRIMARY KEY to the search service on document_id to optimize incremental refreshes?"

**Checkpoint:** You should be able to search your policy documents by meaning, filter by payer, and get relevant results in under a second.

---

## Module 2: Cortex Agent (30 min)

**Objective:** Connect a Semantic View and Cortex Search as tools in a Cortex Agent.

### Step 2.1: Create a Semantic View (UI)

1. In Snowsight, navigate to **AI & ML → Cortex Analyst**
2. Select **Create new → Create new Semantic View**
3. Set location to `HEALTHCARE_AI_LAB.DENIALS`
4. Name: `DENIAL_ANALYTICS_SV`
5. Description: `Semantic view for healthcare denial claims analytics. Covers denial volumes, reasons, payer comparisons, appeal outcomes, financial impact, and resolution timelines.`
6. Select **Next**, then **Skip** (verified queries)
7. Select the `HEALTHCARE_AI_LAB.DENIALS` schema
8. Select the `DENIAL_CLAIMS` table
9. Select all columns
10. Accept suggested relationships and metrics
11. Select **Save**

### Step 2.2: Create the Agent (SQL)

```sql
CREATE OR REPLACE AGENT HEALTHCARE_AI_LAB.DENIALS.DENIAL_MANAGEMENT_AGENT
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
    orchestration: "For questions about denial volumes, trends, financial impact, appeal outcomes, or any quantitative metrics, use the Denial_Analytics tool. For questions about payer policies, coverage criteria, documentation requirements, or denial reason explanations, use the Policy_Search tool. If a question spans both structured data and policy knowledge, use both tools."

  sample_questions:
    - question: "What are our top denial reasons this quarter?"
    - question: "What does the Aetna policy say about cardiac catheterization coverage?"
    - question: "Which payer has the highest denial rate, and what are their common denial reasons?"
    - question: "How can we reduce CO-197 (prior auth required) denials?"

  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "Denial_Analytics"
        description: "Queries structured denial claims data. Use for questions about denial counts, rates, trends, financial amounts, appeal outcomes, resolution timelines, payer comparisons, department breakdowns, and any quantitative analysis of claim denials."
    - tool_spec:
        type: "cortex_search"
        name: "Policy_Search"
        description: "Searches payer policy documents, coverage criteria, and clinical guidelines. Use for questions about why denials occur, what documentation is required, prior authorization rules, timely filing requirements, coverage exclusions, and appeal procedures."
    - tool_spec:
        type: "data_to_chart"
        name: "data_to_chart"
        description: "Generates visualizations from denial data queries"

  tool_resources:
    Denial_Analytics:
      semantic_view: "HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_SV"
      execution_environment:
        type: warehouse
        warehouse: "HOL_WH"
    Policy_Search:
      name: "HEALTHCARE_AI_LAB.DENIALS.POLICY_SEARCH_SERVICE"
      max_results: "5"
      title_column: "document_title"
      id_column: "document_id"
  $$;
```

### Step 2.3: Grant Access

```sql
-- Grant usage so your role can query the agent
GRANT USAGE ON AGENT HEALTHCARE_AI_LAB.DENIALS.DENIAL_MANAGEMENT_AGENT
  TO ROLE <your_role>;
```

### Step 2.4: Test the Agent in Snowsight

1. Navigate to **AI & ML → Agents**
2. Select **DENIAL_MANAGEMENT_AGENT**
3. Try these questions:
   - "What are the top 3 denial reasons by total denied amount?"
   - "What does the Blue Cross policy say about prior authorization for surgical procedures?"
   - "Which departments have the most denials, and what are the common reasons?"
   - "We're seeing a lot of CO-16 denials from UnitedHealth. What documentation are we missing?"

### Step 2.5: Refine with Cortex Code

Open Cortex Code and try:

> **Prompt:** "I have a Cortex Agent called DENIAL_MANAGEMENT_AGENT in HEALTHCARE_AI_LAB.DENIALS. Can you describe it and suggest improvements to the instructions or tool descriptions to improve accuracy?"

> **Prompt:** "Can you add a sample question about appeal success rates by payer?"

**Checkpoint:** Your agent should answer questions about both denial data (structured) and policy guidelines (unstructured), choosing the right tool automatically.

---

## Module 3: Snowflake Intelligence (30 min)

**Objective:** Deploy your agent as a conversational AI for end users.

### Step 3.1: Enable Snowflake Intelligence

```sql
-- If not already enabled (requires ACCOUNTADMIN)
USE ROLE ACCOUNTADMIN;
CREATE SNOWFLAKE INTELLIGENCE IF NOT EXISTS SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;
```

### Step 3.2: Access the Agent in Snowflake Intelligence

1. In Snowsight, navigate to **Snowflake Intelligence** (in the left nav)
2. Your **Denial Management Assistant** should appear automatically (any agent you create appears in SI)
3. Select it to start a conversation

### Step 3.3: Run Through Key Use Cases

Test the following real-world scenarios that your denial management team would use:

**Scenario 1: Daily Denial Review**
> "Show me all denials from the past 30 days, grouped by payer. Include the total denied amount for each."

**Scenario 2: Root Cause Analysis**
> "Why are we getting CO-4 denials from Aetna? What does their policy say about modifier requirements?"

**Scenario 3: Appeal Strategy**
> "Which denial reasons have the highest appeal overturn rate? What documentation should we include in the appeal?"

**Scenario 4: Trend Analysis**
> "Show me the trend of prior auth denials (CO-197) over the past 6 months. Which payers are driving the increase?"

**Scenario 5: Cross-Source Insight**
> "We had $45,000 denied for a total knee replacement due to prior auth. What are Blue Cross's specific prior auth requirements for orthopedic procedures, and how can we appeal this?"

### Step 3.4: Customize the Experience

In the agent editor (AI & ML → Agents → your agent), refine:

- **Response instructions:** Add "When generating charts, use a blue color palette. Default to bar charts for comparisons and line charts for trends."
- **Orchestration instructions:** Add "If the user asks about a specific claim, always check both the denial data AND relevant payer policies."
- **Sample questions:** Add 3-5 questions that your team asks most frequently

### Step 3.5: Refine with Cortex Code

> **Prompt:** "Look at the DENIAL_MANAGEMENT_AGENT and help me improve the response instructions to always include an 'Action Items' section in the response with specific steps the revenue cycle team should take."

> **Prompt:** "Can you update the agent to add an orchestration budget of 90 seconds and 20000 tokens so it can handle more complex multi-step questions?"

**Checkpoint:** Business users should be able to ask natural language questions in Snowflake Intelligence and receive accurate, cited, visualized answers.

---

## Module 4: Streamlit in Snowflake (90 min)

**Objective:** Build an interactive denial analytics dashboard.

### Step 4.1: Create the Streamlit App (SQL)

```sql
CREATE STREAMLIT HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_APP
  RUNTIME_NAME = 'SYSTEM$ST_CONTAINER_RUNTIME_PY3_11'
  QUERY_WAREHOUSE = HOL_WH
  COMMENT = 'Denial Analytics Dashboard for Revenue Cycle Management';

ALTER STREAMLIT HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_APP ADD LIVE VERSION FROM LAST;
```

### Step 4.2: Write the App Code

Navigate to **Projects → Streamlit** in Snowsight, open your app, and select **Edit**.

Replace the starter code with the following:

```python
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()

st.set_page_config(page_title="Denial Analytics", layout="wide")
st.title("Denial Analytics Dashboard")

# --- Filters ---
col1, col2, col3 = st.columns(3)

payers = session.sql("SELECT DISTINCT payer_name FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS ORDER BY 1").collect()
payer_list = ["All"] + [row["PAYER_NAME"] for row in payers]

departments = session.sql("SELECT DISTINCT department FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS ORDER BY 1").collect()
dept_list = ["All"] + [row["DEPARTMENT"] for row in departments]

with col1:
    selected_payer = st.selectbox("Payer", payer_list)
with col2:
    selected_dept = st.selectbox("Department", dept_list)
with col3:
    date_range = st.date_input("Denial Date Range", value=[])

# --- Build WHERE clause ---
where_clauses = []
if selected_payer != "All":
    where_clauses.append(f"payer_name = '{selected_payer}'")
if selected_dept != "All":
    where_clauses.append(f"department = '{selected_dept}'")
if len(date_range) == 2:
    where_clauses.append(f"denial_date BETWEEN '{date_range[0]}' AND '{date_range[1]}'")

where_sql = " AND ".join(where_clauses)
where_sql = f"WHERE {where_sql}" if where_sql else ""

# --- KPI Cards ---
kpi_query = f"""
SELECT
    COUNT(*) AS total_denials,
    SUM(denied_amount) AS total_denied_amount,
    COUNT(CASE WHEN appeal_outcome = 'Overturned' THEN 1 END) AS appeals_overturned,
    COUNT(CASE WHEN appeal_status = 'Appealed' THEN 1 END) AS total_appealed,
    AVG(days_to_resolution) AS avg_days_to_resolution
FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS
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

# --- Charts ---
chart_col1, chart_col2 = st.columns(2)

with chart_col1:
    st.subheader("Denials by Reason")
    reason_df = session.sql(f"""
        SELECT denial_reason_description AS reason, COUNT(*) AS count, SUM(denied_amount) AS amount
        FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS {where_sql}
        GROUP BY 1 ORDER BY 2 DESC
    """).to_pandas()
    st.bar_chart(reason_df, x="REASON", y="COUNT")

with chart_col2:
    st.subheader("Denials by Payer")
    payer_df = session.sql(f"""
        SELECT payer_name AS payer, COUNT(*) AS count, SUM(denied_amount) AS amount
        FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS {where_sql}
        GROUP BY 1 ORDER BY 2 DESC
    """).to_pandas()
    st.bar_chart(payer_df, x="PAYER", y="AMOUNT")

st.divider()

# --- Detail Table ---
st.subheader("Denial Details")
detail_df = session.sql(f"""
    SELECT claim_id, payer_name, procedure_description, denial_reason_description,
           denied_amount, denial_date, appeal_status, appeal_outcome
    FROM HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS {where_sql}
    ORDER BY denial_date DESC
""").to_pandas()
st.dataframe(detail_df, use_container_width=True)
```

### Step 4.3: Run and Verify

Select **Run** in the Streamlit editor. You should see:
- Filter dropdowns for payer, department, and date range
- KPI cards showing total denials, denied amount, appeal overturn rate, and avg resolution days
- Bar charts for denials by reason and by payer
- A detail table with all denial records

### Step 4.4: Enhance with Cortex Code

This is where CoCo really shines. Open Cortex Code and iteratively improve your app:

> **Prompt:** "I have a Streamlit app at HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_APP. Can you read the code and add a trend line chart showing denial count by month?"

> **Prompt:** "Add a pie chart showing the breakdown of appeal statuses (Appealed, Not Appealed, Pending)"

> **Prompt:** "Add a section at the bottom that shows the top 3 actionable insights — like which denial reason has the highest dollar impact and which payer has the lowest appeal success rate"

> **Prompt:** "Can you improve the styling? Add a header with an icon, improve the color scheme, and add descriptions under each chart explaining what the user is looking at"

### Step 4.5: Publish for Others

```sql
-- Grant access to other roles
GRANT USAGE ON STREAMLIT HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_APP
  TO ROLE <target_role>;
```

**Checkpoint:** You have a fully interactive Streamlit dashboard showing denial analytics, with filters, KPIs, charts, and a detail table — all running live against your Snowflake data.

---

## Lab Complete!

### What You Built

| Component | What It Does |
|-----------|-------------|
| **Cortex Search Service** | Indexes policy documents for hybrid semantic + keyword search |
| **Semantic View** | Defines your denial data's business meaning for natural language queries |
| **Cortex Agent** | Orchestrates across structured data and documents to answer complex questions |
| **Snowflake Intelligence** | Provides a conversational UI for business users to access the agent |
| **Streamlit App** | Delivers an interactive denial analytics dashboard |

### Key Takeaways

1. **Search + Analyst + Agent** = a complete AI application stack inside Snowflake
2. **Snowflake Intelligence** makes your agent accessible to non-technical users with zero additional code
3. **Cortex Code** accelerated every step — from refining agent instructions to building a full Streamlit app
4. **Everything runs inside Snowflake** — no data movement, no external APIs, full governance

### Next Steps

- Add more policy documents to your search service and watch it auto-refresh
- Create verified queries in your semantic view to improve accuracy on common questions
- Share the Streamlit app with your revenue cycle team
- Explore custom tools (stored procedures) to add write-back capabilities to your agent
