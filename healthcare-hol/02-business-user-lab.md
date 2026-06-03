# Business User Lab Guide: Building AI-Powered Healthcare Analytics with Cortex Code

> **Duration:** ~3 hours  
> **Track:** Business User — Cortex Code (CoCo) does everything  
> **Audience:** Healthcare clinical ops, revenue cycle, and business analysts  
> **What you'll build:** Cortex Search → Cortex Agent → Snowflake Intelligence → Streamlit App  
> **Key difference from Power User track:** You will use Cortex Code (CoCo) for every step. No SQL writing required — just describe what you want in natural language.

---

## Prerequisites

Before starting, confirm you have:

- [ ] A Snowflake account with appropriate privileges (your lab administrator will confirm)
- [ ] Cross-region inference enabled (your lab administrator will confirm)
- [ ] **Cortex Code** open and connected to your Snowflake account

### How to Open Cortex Code

Cortex Code is Snowflake's AI coding agent. It understands your Snowflake environment — your databases, schemas, roles, warehouses — and can create, modify, and deploy Snowflake objects from natural language prompts.

1. Open Cortex Code (your lab administrator will provide the access method)
2. Verify your connection by typing: **"What database and schema am I connected to?"**
3. CoCo should respond with your current context. If not, ask: **"Connect me to HEALTHCARE_AI_LAB.DENIALS using warehouse HOL_WH"**

> **Tip:** Throughout this lab, you'll see suggested prompts in **bold quoted blocks**. Type these into Cortex Code exactly or adapt them to your own words. CoCo is conversational — you can ask follow-up questions, request changes, or say "try again" if something isn't right.

---

## Environment Setup (10 min)

### Step 0.1: Create Your Lab Environment

> **Prompt to CoCo:**
>
> **"Create a new database called HEALTHCARE_AI_LAB with a schema called DENIALS. Also create an XS warehouse called HOL_WH with auto-suspend of 120 seconds if it doesn't already exist. Then USE that database, schema, and warehouse."**

CoCo will generate and execute the SQL for you. Verify it completes successfully.

### Step 0.2: Load the Denial Claims Data

> **Prompt to CoCo:**
>
> **"Create a table called DENIAL_CLAIMS in the DENIALS schema with columns for: claim_id (VARCHAR), patient_id (VARCHAR), payer_name (VARCHAR), procedure_code (VARCHAR), procedure_description (VARCHAR), denial_reason_code (VARCHAR), denial_reason_description (VARCHAR), claim_amount (DECIMAL 10,2), denied_amount (DECIMAL 10,2), date_of_service (DATE), denial_date (DATE), appeal_status (VARCHAR), appeal_outcome (VARCHAR), days_to_resolution (INT), facility (VARCHAR), department (VARCHAR). Then insert 10 sample rows with realistic healthcare denial data covering different payers (Aetna, UnitedHealth, Blue Cross, Cigna, Medicaid), different denial reasons (CO-4 modifier issues, CO-16 missing info, CO-197 prior auth required, CO-29 timely filing, PR-204 not covered, PR-1 deductible), different departments (Cardiology, Primary Care, Orthopedics, Emergency Medicine, Gastroenterology, Radiology, Internal Medicine), and a mix of appeal statuses."**

> **Tip:** If CoCo generates data that doesn't look right, just say: **"Can you make the sample data more realistic? Include dollar amounts between $250 and $45,000, and make sure the denial reasons match their codes."**

### Step 0.3: Load the Policy Documents Data

> **Prompt to CoCo:**
>
> **"Create a table called POLICY_DOCUMENTS with columns for: document_id (VARCHAR), payer_name (VARCHAR), document_type (VARCHAR), document_title (VARCHAR), effective_date (DATE), document_text (VARCHAR). Insert 5 sample policy documents covering: 1) Aetna cardiac catheterization coverage criteria mentioning CO-4 modifier requirements, 2) Blue Cross prior authorization requirements for surgical procedures mentioning CO-197, 3) UnitedHealth claims documentation requirements mentioning CO-16 missing information, 4) CMS/Medicare timely filing requirements mentioning CO-29, 5) Cigna non-covered services and exclusions mentioning PR-204. Make each document_text at least 3-4 sentences with specific, realistic policy language."**

### Step 0.4: Verify Your Data

> **Prompt to CoCo:**
>
> **"Show me a summary of what's in the DENIAL_CLAIMS table — how many rows, what payers are represented, and what's the total denied amount. Also show me what's in the POLICY_DOCUMENTS table."**

**Checkpoint:** You should have 10 denial claims and 5 policy documents loaded and verified.

---

## Module 1: Cortex Search (30 min)

**Objective:** Index your policy and clinical documents so they can be searched by meaning, not just keywords.

### What is Cortex Search?

Cortex Search is like having a smart search engine inside Snowflake. Instead of requiring exact keyword matches, it understands the *meaning* of your question. Search for "cardiac cath coverage criteria" and it will find documents about "left heart catheterization medical necessity" — even if those exact words don't appear in your search.

### Step 1.1: Create the Search Service

> **Prompt to CoCo:**
>
> **"Create a Cortex Search Service called POLICY_SEARCH_SERVICE on the POLICY_DOCUMENTS table. It should search the document_text column, with attributes for payer_name and document_type so I can filter results. Use the snowflake-arctic-embed-l-v2.0 embedding model, the HOL_WH warehouse, and a target lag of 1 hour."**

CoCo will generate and execute the `CREATE CORTEX SEARCH SERVICE` statement. This may take a minute or two as Snowflake builds the search index.

### Step 1.2: Verify the Service Was Created

> **Prompt to CoCo:**
>
> **"Show me the Cortex Search services in my schema and describe the POLICY_SEARCH_SERVICE."**

### Step 1.3: Test a Basic Search

> **Prompt to CoCo:**
>
> **"Run a search preview against POLICY_SEARCH_SERVICE for the question: 'What are the prior authorization requirements for surgical procedures?' Return the document_title, payer_name, and document_text columns. Limit to 3 results."**

Look at the results. The search should return the Blue Cross prior auth document as the top result, even though your search query doesn't use the exact same words as the document.

### Step 1.4: Test a Filtered Search

> **Prompt to CoCo:**
>
> **"Search POLICY_SEARCH_SERVICE for 'denial code CO-4 modifier requirements' but filter only for Aetna documents. Show me the results."**

This time, only Aetna documents should appear — the filter narrows results to a specific payer.

### Step 1.5: Try More Searches

Experiment with your own questions:

> **"Search for 'how to avoid timely filing denials'"**

> **"Search for 'what documentation is required for specialist visit claims' filtered to UnitedHealth"**

> **"Search for 'coverage exclusions cosmetic procedures'"**

**Checkpoint:** You can search your policy documents by meaning, filter by payer, and get relevant results. All done through CoCo — no SQL written by hand.

---

## Module 2: Cortex Agent (30 min)

**Objective:** Build an AI agent that can answer questions from BOTH your denial data (numbers) AND your policy documents (text).

### What is a Cortex Agent?

A Cortex Agent is an AI that can use multiple tools to answer your questions. Think of it as a smart assistant that knows:
- **Your numbers** — denial counts, dollar amounts, trends (via a Semantic View + Cortex Analyst)
- **Your documents** — payer policies, coverage criteria, guidelines (via Cortex Search)

When you ask a question, the agent figures out which tool to use — or uses both if needed.

### Step 2.1: Create a Semantic View

A Semantic View tells the agent how to understand your data — what each column means in business terms.

> **Prompt to CoCo:**
>
> **"Create a semantic view called DENIAL_ANALYTICS_SV in HEALTHCARE_AI_LAB.DENIALS over the DENIAL_CLAIMS table. The description should be: 'Semantic view for healthcare denial claims analytics covering denial volumes, reasons, payer comparisons, appeal outcomes, financial impact, and resolution timelines.' Include all columns from DENIAL_CLAIMS."**

> **Tip:** If CoCo asks you questions about the semantic view configuration, accept the defaults or say: **"Use sensible defaults for a denial analytics use case."**

### Step 2.2: Create the Agent

> **Prompt to CoCo:**
>
> **"Create a Cortex Agent called DENIAL_MANAGEMENT_AGENT in HEALTHCARE_AI_LAB.DENIALS with the following configuration:**
>
> **Display name: 'Denial Management Assistant', color: blue.**
>
> **Use auto model selection.**
>
> **Response instructions: 'You are a healthcare denial management assistant. Provide clear, actionable insights about claim denials, appeal strategies, and payer policies. Always cite your sources. Format financial data as currency. Format dates as MM/DD/YYYY.'**
>
> **Orchestration instructions: 'For questions about denial volumes, trends, financial impact, appeal outcomes, or any quantitative metrics, use the Denial_Analytics tool. For questions about payer policies, coverage criteria, documentation requirements, or denial reason explanations, use the Policy_Search tool. If a question spans both, use both tools.'**
>
> **Add two tools:**
> **1. A Cortex Analyst tool named 'Denial_Analytics' using semantic view HEALTHCARE_AI_LAB.DENIALS.DENIAL_ANALYTICS_SV with warehouse HOL_WH. Description: 'Queries structured denial claims data for counts, rates, trends, financial amounts, appeal outcomes, and payer comparisons.'**
> **2. A Cortex Search tool named 'Policy_Search' using search service HEALTHCARE_AI_LAB.DENIALS.POLICY_SEARCH_SERVICE with max_results 5, title_column document_title, id_column document_id. Description: 'Searches payer policy documents, coverage criteria, and clinical guidelines for documentation requirements, prior auth rules, and appeal procedures.'**
>
> **Also add a data_to_chart tool for visualizations.**
>
> **Add sample questions: 'What are our top denial reasons this quarter?', 'What does the Aetna policy say about cardiac catheterization coverage?', 'Which payer has the highest denial rate?', 'How can we reduce CO-197 denials?'"**

### Step 2.3: Verify the Agent

> **Prompt to CoCo:**
>
> **"Describe the DENIAL_MANAGEMENT_AGENT and tell me what tools are connected to it."**

### Step 2.4: Test the Agent

> **Prompt to CoCo:**
>
> **"Query the DENIAL_MANAGEMENT_AGENT: What are the top 3 denial reasons by total denied amount?"**

> **Prompt to CoCo:**
>
> **"Query the DENIAL_MANAGEMENT_AGENT: What does the Blue Cross policy say about prior authorization requirements for surgical procedures?"**

> **Prompt to CoCo:**
>
> **"Query the DENIAL_MANAGEMENT_AGENT: We're getting CO-16 denials from UnitedHealth. What documentation are we missing, and how many of these denials do we have?"**

That last question is the magic — the agent should use BOTH the Analyst tool (to count CO-16 denials) and the Search tool (to look up what CO-16 means and what documentation is required).

### Step 2.5: Refine the Agent

> **Prompt to CoCo:**
>
> **"Look at the DENIAL_MANAGEMENT_AGENT and suggest improvements to the instructions or tool descriptions to make it more accurate and helpful."**

> **Prompt to CoCo:**
>
> **"Update the agent's response instructions to always include an 'Action Items' section with specific steps the revenue cycle team should take."**

**Checkpoint:** Your agent answers questions about both denial data and policy documents, automatically choosing the right tool.

---

## Module 3: Snowflake Intelligence (30 min)

**Objective:** Deploy your agent so anyone on your team can use it through a simple chat interface.

### What is Snowflake Intelligence?

Snowflake Intelligence is a chat interface built into Snowflake. Any agent you create automatically appears here. Your denial management team, revenue cycle analysts, clinical reviewers — they just open Snowflake Intelligence and start asking questions. No SQL, no dashboards to navigate — just conversation.

### Step 3.1: Enable Snowflake Intelligence (if needed)

> **Prompt to CoCo:**
>
> **"Check if Snowflake Intelligence is enabled. If not, create the default Snowflake Intelligence object using ACCOUNTADMIN."**

### Step 3.2: Open Snowflake Intelligence

1. In Snowsight (the Snowflake web UI), look for **Snowflake Intelligence** in the left navigation
2. Your **Denial Management Assistant** should appear in the list
3. Select it to open a conversation

### Step 3.3: Walk Through Real-World Scenarios

Now you're in the end-user experience. Try these scenarios that your team would actually use day-to-day:

**Scenario 1: Morning Denial Review**
> Type: "Show me all denials from the past 30 days grouped by payer, with the total denied amount for each."

**Scenario 2: Investigating a Specific Problem**
> Type: "Why are we getting CO-4 denials from Aetna? What does their policy say about modifier requirements?"
>
> *Notice how the agent uses BOTH tools — it checks the denial data AND searches the policy documents.*

**Scenario 3: Building an Appeal**
> Type: "We had a $45,000 total knee replacement denied by Blue Cross for prior auth (CO-197). What are their specific requirements and how should we appeal?"
>
> *The agent should pull the Blue Cross prior auth policy and give you actionable appeal guidance.*

**Scenario 4: Trend Spotting**
> Type: "Show me denial trends over time. Are we getting better or worse?"
>
> *Look for the auto-generated chart. You can ask follow-up questions to dig deeper.*

**Scenario 5: Executive Summary**
> Type: "Give me an executive summary of our denial performance — total denied dollars, top reasons, best and worst payers, and the biggest opportunities to recover revenue."

### Step 3.4: Customize via CoCo

Go back to Cortex Code to refine the experience:

> **Prompt to CoCo:**
>
> **"Update the DENIAL_MANAGEMENT_AGENT response instructions to add: 'When generating charts, use a blue color palette. Default to bar charts for comparisons and line charts for trends. Always include a brief plain-English explanation of what the chart shows.'"**

> **Prompt to CoCo:**
>
> **"Add these sample questions to the agent: 'Give me an executive summary of denial performance', 'Which denials should we prioritize for appeal?', 'What's our appeal overturn rate by payer?'"**

### Step 3.5: Try It Again

Go back to Snowflake Intelligence and try the same questions. Notice how the responses are now more polished with the improved instructions.

**Checkpoint:** Business users can have a natural conversation with your denial data through Snowflake Intelligence — no technical skills required.

---

## Module 4: Streamlit in Snowflake (90 min)

**Objective:** Build an interactive denial analytics dashboard — entirely through Cortex Code.

### What is Streamlit in Snowflake?

Streamlit is a framework for building data applications. In Snowflake, Streamlit apps run inside your account — the data never leaves. You'll build a visual dashboard with filters, KPI cards, charts, and detail tables.

The difference in this track: **CoCo builds the entire app for you from a description.**

### Step 4.1: Create the Streamlit App

> **Prompt to CoCo:**
>
> **"Create a new Streamlit app called DENIAL_ANALYTICS_APP in HEALTHCARE_AI_LAB.DENIALS using the container runtime and HOL_WH warehouse. Use the starter template for now — we'll replace the code next."**

### Step 4.2: Build the Dashboard

> **Prompt to CoCo:**
>
> **"Write a Streamlit app for DENIAL_ANALYTICS_APP that creates a Denial Analytics Dashboard. It should have:**
>
> **1. A title 'Denial Analytics Dashboard'**
> **2. Three filter dropdowns at the top: Payer (with an 'All' option), Department (with an 'All' option), and a date range picker for denial dates**
> **3. Four KPI metric cards in a row: Total Denials (count), Total Denied Amount (formatted as currency), Appeal Overturn Rate (percentage), and Average Days to Resolution**
> **4. Two charts side by side: a bar chart of denials by reason (left) and a bar chart of denied amount by payer (right)**
> **5. A detail table at the bottom showing all denial records with columns: claim_id, payer_name, procedure_description, denial_reason_description, denied_amount, denial_date, appeal_status, appeal_outcome**
>
> **All data comes from HEALTHCARE_AI_LAB.DENIALS.DENIAL_CLAIMS. The filters should dynamically update all the KPIs, charts, and the detail table. Use wide layout."**

CoCo will generate the complete Streamlit app code and deploy it. This might take a minute.

### Step 4.3: View Your App

1. In Snowsight, navigate to **Projects → Streamlit**
2. Select **DENIAL_ANALYTICS_APP**
3. The dashboard should load with your denial data

If something doesn't look right, tell CoCo:

> **"The chart labels are overlapping — can you fix the formatting?"**

> **"The KPI cards aren't showing currency formatting correctly — the denied amount should show as $XX,XXX.XX"**

### Step 4.4: Add More Features

Now let's enhance the dashboard iteratively:

**Add a trend chart:**
> **Prompt to CoCo:**
>
> **"Add a line chart below the existing charts that shows denial count by month over time. Title it 'Denial Trend Over Time'."**

**Add an appeal status breakdown:**
> **Prompt to CoCo:**
>
> **"Add a pie chart or donut chart showing the breakdown of appeal statuses — Appealed, Not Appealed, Pending. Put it next to the trend chart."**

**Add actionable insights:**
> **Prompt to CoCo:**
>
> **"Add a section at the bottom called 'Key Insights' that automatically calculates and displays: 1) The denial reason with the highest total dollar impact, 2) The payer with the lowest appeal overturn rate, 3) The department with the most denials. Show each as a callout or info box."**

**Improve the styling:**
> **Prompt to CoCo:**
>
> **"Make the dashboard look more professional. Add a header section with a hospital icon emoji and a subtitle. Improve spacing between sections with dividers. Make the KPI cards more visually prominent."**

### Step 4.5: Deploy for Others

> **Prompt to CoCo:**
>
> **"Make the DENIAL_ANALYTICS_APP accessible to other users. Add a live version and grant USAGE to the [your_team_role] role."**

### Step 4.6: Bonus — Add AI Chat to the Dashboard

If you have time, add a conversational element:

> **Prompt to CoCo:**
>
> **"Add a sidebar to the Streamlit app with a text input where users can ask questions about the denial data. Use Cortex AI Complete to generate natural language answers based on the filtered data currently showing in the dashboard."**

**Checkpoint:** You have a fully interactive Streamlit dashboard — filters, KPIs, multiple chart types, detail tables, and insights — all built through conversation with CoCo.

---

## Lab Complete!

### What You Built (All Through Cortex Code!)

| Component | What It Does | How You Built It |
|-----------|-------------|-----------------|
| **Cortex Search Service** | Searches policy documents by meaning | Described what you wanted → CoCo created it |
| **Semantic View** | Defines your data's business meaning | Described the use case → CoCo configured it |
| **Cortex Agent** | Answers questions from data + documents | Described the tools and behavior → CoCo built it |
| **Snowflake Intelligence** | Chat interface for your team | Automatic — just opened it and started chatting |
| **Streamlit App** | Interactive denial analytics dashboard | Described each feature → CoCo wrote the code |

### Key Takeaways

1. **You didn't write a single line of SQL or Python** — Cortex Code handled all of it from natural language descriptions
2. **The AI stack is fully integrated** — Search, Analyst, Agents, and Intelligence all work together seamlessly
3. **Your team can start using this today** — Snowflake Intelligence requires zero training for end users
4. **Everything is governed** — same Snowflake security, roles, and access controls apply to all AI features
5. **Iterative refinement is natural** — you improved the agent and app by simply describing what you wanted changed

### What Cortex Code Did for You

- Created databases, schemas, warehouses, and tables
- Generated realistic sample data
- Built a Cortex Search service with proper configuration
- Created a semantic view with business context
- Configured a multi-tool Cortex Agent with instructions
- Wrote a complete Streamlit application with filters, KPIs, charts, and detail tables
- Iteratively enhanced the app based on your feedback

### Next Steps

- Add your organization's real policy documents and denial data
- Refine the semantic view with verified queries for your most common questions
- Share the Streamlit app with your revenue cycle team
- Explore Snowflake Intelligence mobile app for on-the-go access
- Ask CoCo: **"What else can I build with Cortex AI for healthcare?"**
