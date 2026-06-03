# Business User Track: Building AI-Powered Healthcare Analytics with Cortex Code

> **Duration:** ~3 hours
> **Audience:** Healthcare clinical ops, revenue cycle analysts, and business analysts
> **Key difference:** You will use Cortex Code (CoCo) for every step. No SQL writing required.

---

## Before You Begin

!!! info "Prerequisites"
    You should already be logged in and verified per the [Login Guide](login.md). If you haven't set up Cortex Code yet, follow the [Using Cortex Code](using-cortex-code.md) guide first.

Throughout this lab, you will build a complete AI application for healthcare denial management — semantic search over policy documents, an intelligent agent that answers questions from both data and documents, a chat interface for your entire team, and an interactive analytics dashboard.

You will do all of this by describing what you want in plain English. Cortex Code writes the SQL, builds the objects, and deploys everything for you.

### How to Read This Guide

CoCo prompts appear in bold quoted blocks like this:

> **"This is a prompt you type into Cortex Code."**

Type these into Cortex Code exactly as written, or adapt them to your own wording. CoCo is conversational — if something doesn't look right, just say **"try again"** or **"that's not quite right"** and describe what you expected.

!!! tip "CoCo Tips"
    - If CoCo generates data that doesn't look right, just say: **"try again"** or **"that's not quite right, I expected..."**
    - If CoCo asks you configuration questions, say: **"Use sensible defaults for a denial analytics use case."**
    - You can always ask CoCo to explain what it did: **"Explain what you just created."**

### What You Will Build

| Module | What You Build | Time |
|--------|---------------|------|
| Module 0 | Data Exploration | 15 min |
| Module 1 | Cortex Search — semantic search over policy documents and clinical guidelines | 30 min |
| Module 2 | Cortex Agent — AI that queries data + documents + web + email | 30 min |
| Module 3 | Snowflake Intelligence — chat interface for the team | 30 min |
| Module 4 | Streamlit App — interactive denial analytics dashboard | 75 min |

---

## Module 0: Data Exploration (15 min)

Before you build anything, you need to understand the data. The database contains a star schema with ~8,000 denied claims, ~5,100 appeals, 10 payers, 15 departments, 8 facilities, and 9 unstructured policy and clinical guideline documents — all in `HEALTHCARE_AI_DEMO.DENIALS`.

### Step 0.1: Set Your Context

Tell CoCo which database, schema, role, and warehouse to use:

> **"Connect me to HEALTHCARE_AI_DEMO.DENIALS using the HEALTHCARE_AI_DEMO role and HEALTHCARE_DEMO_WH warehouse."**

!!! warning "Pause Here"
    Make sure CoCo confirms the connection before proceeding. If you see role or warehouse errors, ask for help.

### Step 0.2: Explore the Tables

The schema uses a star schema design — dimension tables describe entities (payers, departments, procedures) and fact tables hold the actual denial claims and appeals.

> **"Show me all the tables in the DENIALS schema with their row counts. I want to understand the data model."**

You should see 8 dimension tables and 3 fact tables, plus a `parsed_content` table that holds parsed unstructured documents. The `denial_claims_fact` table has about 8,000 rows (denied claims) and the `appeals_fact` table has about 5,100 rows (appeals filed against those denials).

### Step 0.3: Explore the Star Schema

Look at the key dimensions to understand what data you have — the payers (insurance companies), denial reasons, and departments:

> **"Show me all the payers in payer_dim, all the denial reasons in denial_reason_dim, and all the departments in department_dim."**

Notice the payer types — Commercial (Aetna, Blue Cross, UHC, Cigna, Humana), Government (Medicare, Medicaid, Tricare), Marketplace (Ambetter), and Managed Care (Molina).

The denial reasons use CARC codes — industry standard codes your revenue cycle team deals with daily. CO-4 is modifier issues, CO-16 is missing information, CO-197 is prior authorization required, CO-29 is timely filing.

### Step 0.4: Preview the Fact Data

Look at what an actual denial claim record looks like when joined to all its dimensions:

> **"Show me 10 sample rows from denial_claims_fact joined to payer_dim, procedure_dim, denial_reason_dim, appeal_status_dim, and department_dim. I want to see the payer name, procedure description, denial reason code and description, claim amount, denied amount, dates, appeal status, and department name."**

Each row is a single denied claim. You can see the full picture — who the payer is, what procedure was performed, why it was denied, how much money is at stake, and whether it was appealed. This is the core data you'll build AI analytics on top of.

### Step 0.5: Quick Summary Statistics

Get a high-level picture of the denial landscape:

> **"Give me a high-level summary of the denial_claims_fact table — total denial count, total denied dollars, average denied amount per claim, the date range of denials, and how many unique payers and departments are represented."**

### Step 0.6: Explore the Unstructured Documents

The other half of the picture — payer policy documents and internal clinical guidelines. These have been parsed into the `parsed_content` table using Cortex Parse Document.

> **"Show me what's in the parsed_content table — the document titles, categories, and a short preview of each document's content."**

> **"Also show me the files stored in the INTERNAL_DATA_STAGE under the unstructured_docs folder."**

You should see 9 documents — 6 payer policies (Aetna, Blue Cross, UnitedHealthcare, Cigna, CMS Medicare, Georgia Medicaid) and 3 internal clinical guidelines (imaging prior auth, ED visit documentation, denial management workflow).

These are real-world document types your revenue cycle and clinical teams reference daily. Right now, you'd have to manually read through these to find the right policy. After this lab, the AI agent will search them for you.

!!! success "Checkpoint"
    You should now understand the data model: 8 dimension tables, 3 fact tables, and 9 parsed documents. You explored all of this without writing a single line of SQL.

---

## Module 1: Cortex Search (30 min)

**Cortex Search** is a fully managed semantic search engine. You will index the policy documents so that instead of keyword-matching through PDFs, you can ask a question in natural language and get the relevant policy section back.

Cortex Search combines three techniques — semantic search (understands meaning), keyword search (catches exact codes and terms), and a reranker (puts the best results on top). You create it with a single statement.

### Step 1.1: Create the Search Service

You will create a search service over the payer policy documents. It indexes the `content` column from `parsed_content` and adds `title` and `doc_category` as filterable attributes so you can narrow results by payer or document type.

> **"Create a Cortex Search Service called search_payer_policies on the parsed_content table in HEALTHCARE_AI_DEMO.DENIALS. Index the content column. Add relative_path, file_url, title, and doc_category as filterable attributes. Use the HEALTHCARE_DEMO_WH warehouse, a target lag of 30 days, and the snowflake-arctic-embed-l-v2.0 embedding model. Only include rows where doc_category = 'payer_policies'."**

!!! info "What's Happening"
    Snowflake is embedding each document chunk into vector space for semantic search, building a keyword index for lexical matching, and creating a reranker pipeline. The `TARGET_LAG` means when you add new documents, the index auto-refreshes within an hour. This takes 1-2 minutes to initialize.

### Step 1.2: Create the Clinical Guidelines Search Service

Now create a second search service — this one indexes the internal clinical guidelines (imaging prior auth, ED visit documentation, denial management workflow). Same pattern, different document category.

> **"Create a second Cortex Search Service called search_clinical_guidelines on the parsed_content table. Same configuration as the payer policies service — index the content column, add relative_path, file_url, title, and doc_category as attributes, use HEALTHCARE_DEMO_WH, 30 day target lag, and snowflake-arctic-embed-l-v2.0. But this time only include rows where doc_category = 'clinical_guidelines'."**

### Step 1.3: Verify the Services

Confirm both services were created successfully:

> **"Show me all Cortex Search services in my schema and describe both search_payer_policies and search_clinical_guidelines."**

### Step 1.4: Test a Basic Search

Now the fun part — search by meaning. Ask about prior authorization for surgical procedures and see if it finds the Blue Cross surgical prior auth guidelines, even though you're not using the exact same words.

> **"Run a search preview against search_payer_policies for the question: 'What are the prior authorization requirements for surgical procedures?' Return the title, doc_category, and content columns. Limit to 3 results."**

The Blue Cross surgical prior auth guidelines should come back as the top hit — even though you didn't search for "Blue Cross" or "BCBS." That's semantic search in action. It understood the *meaning* of the question.

### Step 1.5: Test a Filtered Search

What if you only want to search Aetna's policies? Filters let you narrow the semantic search to specific payers, document types, or any attribute you defined.

> **"Search search_payer_policies for 'modifier requirements for cardiac catheterization' but filter only for documents with the title containing 'Aetna'. Show me the results."**

### Step 1.6: Test the Clinical Guidelines Service

Now test the clinical guidelines service — your internal operational documents:

> **"Run a search preview against search_clinical_guidelines for the question: 'What is the imaging prior authorization process?' Return the title, doc_category, and content columns. Limit to 3 results."**

You should see the imaging prior authorization requirements document come back as the top result.

### Step 1.7: Try Additional Searches (5 min — self-paced)

Try your own searches against either service. Here are some ideas:

> **"Search payer policies for 'how to avoid timely filing denials'"**

> **"Search payer policies for 'what documentation is required for specialist visit claims' filtered to UnitedHealthcare"**

> **"Search clinical guidelines for 'ED visit level documentation'"**

> **"Search clinical guidelines for 'denial management appeals workflow'"**

!!! success "Checkpoint"
    You can now search policy documents by meaning and get relevant results. You created a semantic search engine with a single CoCo prompt. No vector database, no embedding pipeline, no MLOps — Snowflake handles all of it.

---

## Module 2: Cortex Agent (30 min)

Now you will build an **agent** — an AI that can answer questions from BOTH your denial data (numbers) AND your policy documents (text).

A Cortex Agent uses multiple tools. When you ask a question, the agent figures out which tool to use:

- **Data question** (counts, trends, dollars) → routes to Cortex Analyst (text-to-SQL via a Semantic View)
- **Document question** (payer policies, guidelines) → routes to Cortex Search
- **Both** → uses both tools and synthesizes the answer

You need to build two things: first, a Semantic View so the agent can query your denial data, then the agent itself.

### Step 2.1: Create a Semantic View

A Semantic View is a business-level description of your data model. It tells Cortex Analyst what each column means, how tables relate, and what metrics to calculate. Think of it as a translator between "What's our denial rate by payer?" and the actual SQL with joins and aggregations.

> **"Create a semantic view called DENIAL_ANALYTICS_SV in HEALTHCARE_AI_DEMO.DENIALS over the DENIAL_CLAIMS_FACT table. Join it to PAYER_DIM, PROCEDURE_DIM, DEPARTMENT_DIM, FACILITY_DIM, DENIAL_REASON_DIM, APPEAL_STATUS_DIM, and PROVIDER_DIM. The description should be: 'Semantic view for healthcare denial claims analytics — covers denial volumes, reason codes, payer comparisons, appeal outcomes, financial impact, and resolution timelines.' Include all columns from all tables. Add metrics for total denials, total denied amount, total charges, average denied amount, denial rate, and average days to resolution."**

!!! tip
    If CoCo asks you questions about configuration, say: **"Use sensible defaults for a denial analytics use case."**

### Step 2.2: Create the Appeals Semantic View

Create a second semantic view for appeal-specific analytics — recovery rates, appeal outcomes, and appeal levels.

> **"Create a semantic view called APPEALS_ANALYTICS_SV in HEALTHCARE_AI_DEMO.DENIALS over the APPEALS_FACT table. Join it to APPEAL_STATUS_DIM, DENIAL_CLAIMS_FACT, PAYER_DIM, and DENIAL_REASON_DIM. The description should be: 'Semantic view for appeal analytics — covers appeal volumes, recovery rates, outcomes by payer and denial reason.' Include facts for denied_amount, recovered_amount, and appeal count. Add dimensions for appeal_filed_date, appeal_level, appeal_level_name, appeal_status, payer_name, denial_reason_code, and denial_reason_description. Add metrics for total appeals, total recovered, recovery rate, and average recovery."**

!!! tip
    If CoCo asks you questions about configuration, say: **"Use sensible defaults for an appeals analytics use case."**

### Step 2.3: Verify the Semantic Views

> **"Show me the semantic views in my schema."**

### Step 2.4: Create the Agent

Now connect everything into an agent. The agent gets two semantic views for data queries, both search services for document queries, plus utility tools for web scraping, email, and document downloads — with instructions telling the agent when to use each tool.

> **"Create a Cortex Agent called Healthcare_Denial_Management_Agent in HEALTHCARE_AI_DEMO.DENIALS with the following configuration:**
>
> **Display name: 'Healthcare Denial Management Agent', color: blue. Use auto model selection.**
>
> **Response instructions: 'You are a healthcare denial management assistant. Provide clear, actionable insights about claim denials, appeal strategies, and payer policies. Always cite your sources — reference specific policy documents or data queries. Format financial data as currency with commas. Format dates as MM/DD/YYYY. When showing trends, default to line charts. When comparing categories, default to bar charts. Always include an Action Items section with specific next steps the revenue cycle team should take.'**
>
> **Orchestration instructions: 'For questions about denial counts, trends, rates, financial amounts, appeal outcomes, payer comparisons, department breakdowns, or any quantitative analysis, use the Denial Analytics or Appeals Analytics tools. For questions about payer policies, coverage criteria, documentation requirements, prior authorization rules, or appeal procedures, use the Payer Policy Search tool. For questions about internal clinical guidelines, coding standards, or workflow procedures, use the Clinical Guidelines Search tool. If a question spans both structured data and documents, use multiple tools. For web content analysis, use the web scraper tool.'**
>
> **Add these tools:**
> **1. A Cortex Analyst tool named 'Denial_Analytics' using semantic view HEALTHCARE_AI_DEMO.DENIALS.DENIAL_ANALYTICS_SV with warehouse HEALTHCARE_DEMO_WH.**
> **2. A Cortex Analyst tool named 'Appeals_Analytics' using semantic view HEALTHCARE_AI_DEMO.DENIALS.APPEALS_ANALYTICS_SV with warehouse HEALTHCARE_DEMO_WH.**
> **3. A Cortex Search tool named 'Payer_Policy_Search' using search service HEALTHCARE_AI_DEMO.DENIALS.SEARCH_PAYER_POLICIES with max_results 5, title_column TITLE, id_column RELATIVE_PATH.**
> **4. A Cortex Search tool named 'Clinical_Guidelines_Search' using search service HEALTHCARE_AI_DEMO.DENIALS.SEARCH_CLINICAL_GUIDELINES with max_results 5, title_column TITLE, id_column RELATIVE_PATH.**
> **5. A data_to_chart tool.**
> **6. A generic tool named 'Web_Scraper' that calls the function HEALTHCARE_AI_DEMO.DENIALS.WEB_SCRAPE with a weburl string parameter. Description: 'Scrapes and analyzes content from a web URL for payer websites, CMS updates, or regulatory guidance.'**
> **7. A generic tool named 'Send_Email' that calls the procedure HEALTHCARE_AI_DEMO.DENIALS.SEND_MAIL with recipient, subject, and text parameters. Description: 'Sends an email to a recipient with a summary, report, or alert.'**
> **8. A generic tool named 'Document_Download_URL' that calls the procedure HEALTHCARE_AI_DEMO.DENIALS.GET_FILE_PRESIGNED_URL_SP with relative_file_path and expiration_mins parameters. Description: 'Generates a temporary download URL for policy documents and clinical guidelines.'**
>
> **Add sample questions: 'What are our top denial reasons this quarter by total denied amount?', 'What does the Aetna policy say about cardiac catheterization prior auth?', 'Which payer has the highest denial rate and what are their common reasons?', 'Show me the trend of CO-197 prior auth denials over the past 12 months', 'What is our appeal overturn rate by payer?', 'How can we reduce CO-16 missing information denials from UnitedHealthcare?'"**

### Step 2.5: Grant Access

CoCo may have done this automatically, but verify:

> **"Make sure the HEALTHCARE_AI_DEMO role has usage on the Healthcare_Denial_Management_Agent."**

### Step 2.6: Test the Agent

Test three scenarios to make sure the agent routes correctly — a data question, a document question, and a cross-source question.

**Test 1 — Data question** (should use Denial_Analytics):

> **"Query the Healthcare_Denial_Management_Agent: What are the top 5 denial reasons by total denied amount?"**

**Test 2 — Document question** (should use Payer_Policy_Search):

> **"Query the Healthcare_Denial_Management_Agent: What does the Blue Cross policy say about prior authorization for surgical procedures?"**

**Test 3 — Cross-source question** (should use BOTH tools):

> **"Query the Healthcare_Denial_Management_Agent: We're seeing CO-16 denials from UnitedHealthcare. How many do we have, what's the dollar impact, and what documentation should we be including to prevent these?"**

!!! info "Why This Matters"
    That last question is the key moment. The agent uses BOTH tools — it queries the denial data to count CO-16 denials and sum the dollars, then searches the UnitedHealthcare policy document to find what documentation is required. The answer combines data and policy into a single actionable response. That's a 30-minute manual workflow done in 30 seconds.

### Step 2.7: Refine with CoCo

Now improve the agent through conversation:

> **"Look at the Healthcare_Denial_Management_Agent and suggest improvements to the instructions or tool descriptions to make it more accurate and helpful."**

> **"Update the agent's response instructions to always include an 'Action Items' section with specific steps the revenue cycle team should take."**

!!! success "Checkpoint"
    Your agent answers data questions, document questions, and cross-source questions. You built two semantic views (denial analytics and appeals analytics) and the agent entirely through CoCo prompts — no SQL.

---

## Module 3: Snowflake Intelligence (30 min)

Your agent exists. Now let's deploy it so anyone on your team can use it — without SQL, without CoCo, without any technical skills. **Snowflake Intelligence** is a chat interface built into Snowflake. Any agent you create automatically appears there.

### Step 3.1: Enable Snowflake Intelligence (if needed)

> **"Check if Snowflake Intelligence is enabled. If not, create the default Snowflake Intelligence object using ACCOUNTADMIN."**

!!! info
    This may already be enabled in the lab account. If CoCo says it already exists, move on.

### Step 3.2: Open Snowflake Intelligence

Switch to the Snowsight UI for this module:

1. In Snowsight, look for **Snowflake Intelligence** in the left navigation
2. Your **Denial Management Assistant** should appear in the list
3. Select it to open a conversation

!!! warning
    If the agent doesn't appear, go back to CoCo and verify the agent was created with the correct role and that USAGE was granted. Also confirm the agent has a `display_name` in the profile.

### Step 3.3: Walk Through Real-World Scenarios (15 min)

Now you're in the end-user experience. This is what your revenue cycle team, your clinical reviewers, and your executives would see. Type these into Snowflake Intelligence one at a time:

**Scenario 1: Morning Denial Review**

> "Show me all denials from the past 30 days grouped by payer, with the total denied amount for each."

This is a data question — the agent routes to Cortex Analyst, generates SQL, and returns the result. Notice the auto-generated chart.

**Scenario 2: Root Cause Investigation**

> "Why are we getting CO-4 denials from Aetna? What does their policy say about modifier requirements?"

This is a cross-source question — the agent uses BOTH tools. It checks the denial data AND searches the Aetna policy documents. The answer combines data and policy.

**Scenario 3: Building an Appeal**

> "We had a $45,000 total knee replacement denied by Blue Cross for prior auth (CO-197). What are their specific requirements and how should we appeal?"

The agent searches the Blue Cross prior auth policy and gives you actionable appeal guidance. This kind of answer used to require a coder, a case manager, and a binder full of payer contracts. Now it's a conversation.

**Scenario 4: Trend Analysis**

> "Show me monthly denial trends. Which months had the highest denied amounts?"

Look for the auto-generated chart. You can ask follow-up questions to dig deeper — "break that down by payer" or "show just prior auth denials."

**Scenario 5: Executive Summary**

> "Give me an executive summary of our denial performance — total denied dollars, top reasons, best and worst payers, and the biggest opportunities to recover revenue."

The agent synthesizes across the entire dataset and gives you a structured executive briefing. Imagine getting this every Monday morning automatically.

### Step 3.4: Customize via CoCo

Go back to Cortex Code to refine the experience based on what you just saw:

> **"Update the Healthcare_Denial_Management_Agent response instructions to add: 'When generating charts, use a blue color palette. Default to bar charts for comparisons and line charts for trends. Always include a brief plain-English explanation of what the chart shows.'"**

> **"Add these sample questions to the agent: 'Give me an executive summary of denial performance', 'Which denials should we prioritize for appeal?', 'What is our appeal overturn rate by payer?'"**

### Step 3.5: Try It Again

Go back to Snowflake Intelligence and start a new conversation. Try the same questions or new ones. Notice how the responses are more polished with the improved instructions.

!!! success "Checkpoint"
    Business users can have a natural conversation with your denial data through Snowflake Intelligence. No technical skills required. You built and refined this entire experience using CoCo.

---

## Module 4: Streamlit in Snowflake (75 min)

Your final build is a **Streamlit dashboard** — an interactive denial analytics application with filters, KPI cards, charts, and detail tables. This runs inside Snowflake, so the data never leaves your environment.

You will describe what you want and CoCo will write the entire app.

### Step 4.1: Create the Streamlit App

> **"Create a new Streamlit app called DENIAL_ANALYTICS_APP in HEALTHCARE_AI_DEMO.DENIALS using the container runtime and HEALTHCARE_DEMO_WH warehouse."**

### Step 4.2: Build the Dashboard

Now describe the full dashboard and let CoCo write the code:

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

Navigate to **Projects → Streamlit** in Snowsight, select **DENIAL_ANALYTICS_APP**, and run it. You should see filter dropdowns, KPI cards, bar charts, and a detail table.

!!! tip
    If CoCo's code has errors, don't worry. Just copy the error message and paste it into CoCo: **"I got this error when running the app: [paste error]. Fix it."**

### Step 4.4: Enhance with CoCo (30 min — iterative)

This is where CoCo really shines — iterative development through conversation. Add features one at a time.

**Enhancement 1 — Add a trend chart:**

> **"Add a line chart below the existing charts that shows denial count by month over time. Use the denial_date from denial_claims_fact. Title it 'Denial Trend Over Time'. Make sure the existing filters apply to this chart too."**

**Enhancement 2 — Add an appeal status breakdown:**

> **"Add a pie chart or donut chart next to the trend chart showing the breakdown of appeal statuses. Title it 'Appeal Status Distribution'."**

**Enhancement 3 — Add actionable insights:**

> **"Add a section at the bottom called 'Key Insights' that automatically calculates and displays: 1) The denial reason with the highest total dollar impact, 2) The payer with the lowest appeal overturn rate, 3) The department with the most denials. Show each as an info callout."**

**Enhancement 4 — Improve styling:**

> **"Make the dashboard look more professional. Improve spacing between sections with dividers. Make the KPI cards more visually prominent. Add descriptive captions under each chart explaining what the user is looking at."**

!!! tip "Iterative Development"
    This is the pattern: describe what you want → CoCo generates it → you review → you refine. Go off-script and ask for your own enhancements. The goal is to experience the iterative development loop.

### Step 4.5: Bonus Enhancements (if time allows)

If you're ahead, try these:

**Add AI chat to the sidebar:**

> **"Add a sidebar to the Streamlit app with a text input where users can type questions about the denial data. Use Cortex AI Complete to generate natural language answers based on the filtered data currently showing in the dashboard."**

**Add a download button:**

> **"Add a button that lets users download the filtered detail table as a CSV."**

**Add department comparison:**

> **"Add a horizontal bar chart comparing denial rates across departments."**

### Step 4.6: Deploy for Others

> **"Make the DENIAL_ANALYTICS_APP accessible to the HEALTHCARE_AI_DEMO role."**

!!! success "Checkpoint"
    You have a fully interactive Streamlit dashboard with filters, KPIs, multiple chart types, a detail table, insights, and enhanced styling — all built through conversation with CoCo. You never wrote a line of Python.

---

## Wrap-Up

### What You Built

| Component | What It Does | How You Built It |
|-----------|-------------|-----------------|
| **Cortex Search Services** | Searches policy documents and clinical guidelines by meaning | CoCo prompts |
| **Semantic Views** | Defines data's business meaning for AI queries (denials + appeals) | CoCo prompts |
| **Cortex Agent** | Answers questions from data + documents, scrapes web, sends email | CoCo prompts |
| **Snowflake Intelligence** | Chat interface for the whole team | Opened it — automatic |
| **Streamlit App** | Interactive denial analytics dashboard | All CoCo prompts |

### Key Takeaways

1. **No SQL was written.** Every object — the search service, the semantic view, the agent, the Streamlit app — was created by describing what you wanted in plain English through Cortex Code.

2. **Cortex Code is the great equalizer.** You don't need to know SQL, Python, or Snowflake syntax to build production AI applications. You need to know your business domain — denial management, revenue cycle, clinical operations — and CoCo handles the technical translation.

3. **The AI stack is fully integrated.** Cortex Search, Cortex Analyst, Cortex Agents, and Snowflake Intelligence all work together. Each layer builds on the last.

4. **Everything is governed.** Same Snowflake RBAC, same security, same audit trail. Your data never left Snowflake.

5. **Iterative refinement is natural.** You improved the agent and the dashboard by describing what you wanted changed. That's how real development works with AI assistance.

### What's Next

To take this further with your own data:

- Replace the demo data with your real denial claims and policy documents
- Add verified queries to the semantic view for your most common questions
- Share the Streamlit app and Snowflake Intelligence with your revenue cycle team
- Add more tools to the agent — email alerts, web scraping, document downloads
- Explore the Cortex REST API to embed this AI in your existing applications
