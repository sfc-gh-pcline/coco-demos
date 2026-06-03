# Presenter Script: Snowflake AI & Cortex Overview + Live Demo

> **Duration:** ~60 minutes  
> **Audience:** Mixed — developers, analysts, and business users  
> **Format:** Presenter-led with slides + live build demo  
> **Presenters:** [Account Executive] (Part 1) · [Solutions Engineer] (Parts 2 & 3)

---

## PART 1: Snowflake Platform Overview — Account Executive (15 min)

### [SLIDE: Welcome / Title]

> **Script:**
>
> Welcome, everyone. I'm your account executive at Snowflake, and I'm joined by our solutions engineer. Over the next hour, we're going to show you what Snowflake is, how we're building AI directly into the platform, and then our SE is going to build a working AI application live — right in front of you.
>
> Whether you're a developer, an analyst, or a business leader, there's something here for you. Let me start with the big picture.

### [SLIDE: What is Snowflake?]

> **Script:**
>
> For those of you who are new to Snowflake — at its core, Snowflake is a cloud data platform. It's where organizations bring all of their data together — structured tables, semi-structured JSON, unstructured documents like PDFs and images — into a single, governed environment.
>
> Three things set Snowflake apart:
>
> - **Zero infrastructure** — there are no servers to provision, no indexes to tune, no capacity planning. You point Snowflake at your workload and it scales automatically. When you're done, it scales back down. You pay for what you use.
> - **One copy of the data** — instead of copying data into five different tools for five different teams, everyone queries the same governed source of truth. That eliminates data drift, reduces risk, and means your reports always match.
> - **Governed by design** — role-based access control, column-level masking, row-level security, full audit logging. Your security and compliance teams can sleep at night.
>
> The thing I hear most from customers is: "We used to spend 80% of our time moving and managing data, and 20% analyzing it. Snowflake flipped that ratio."

### [SLIDE: The Modern Data Platform]

> **Script:**
>
> Snowflake isn't just a data warehouse anymore. It's evolved into a complete platform for everything your data teams need:
>
> - **Data Engineering** — build and orchestrate data pipelines with Snowpark, Dynamic Tables, Streams, and Tasks. Your engineers can work in Python, Java, or Scala — not just SQL. Data arrives, transforms, and lands in production automatically.
> - **Data Analytics & BI** — whether your team uses Tableau, Power BI, Sigma, or just writes SQL, Snowflake handles the compute. Thousands of concurrent users, sub-second queries, no performance degradation.
> - **Data Science & ML** — train models directly on your data with Snowpark ML, or bring your own frameworks. The Snowflake Model Registry lets you version, deploy, and serve models without ever moving the data out.
> - **Data Sharing & Marketplace** — share live data with partners, customers, or other business units — no ETL, no file transfers. And the Snowflake Marketplace gives you access to thousands of third-party datasets you can query instantly.
> - **Applications** — build and deploy full applications inside Snowflake with Streamlit, Native Apps, and Snowpark Container Services. The data, the compute, and the app all live in one place.
>
> And now — the newest and fastest-growing layer — **AI**. Snowflake Cortex brings large language models, search, and agentic AI directly into the platform. No separate tools, no data leaving your environment. That's what Patrick is going to deep-dive on next.

### [SLIDE: What This Means for the Business]

> **Script:**
>
> I want to step back from the technology for a moment and talk about what this means for your business.
>
> **For your developers and engineers** — Snowflake means less time wrangling infrastructure and more time building. You get a platform that handles scale, security, and governance so you can focus on the logic.
>
> **For your analysts** — it means access to all the data in one place, with the performance to explore it interactively. No more waiting for overnight batch jobs or begging IT for a new extract.
>
> **For your business leaders** — it means faster time to insight, lower total cost of ownership, and the confidence that your data is accurate, governed, and auditable. And with AI built in, your team can start asking questions in plain English and getting answers backed by real data.
>
> The demo you're about to see is a perfect example. We have denial management data — claims, appeals, policy documents — and by the end of this hour, you'll see a working AI assistant that any business user can talk to. No code required on their end.
>
> Let me hand it over to our solutions engineer to walk you through the AI capabilities and then build it live.

---

## PART 2: Cortex AI Features Overview — Solutions Engineer (20 min)

### [SLIDE: The AI Challenge]

> **Script:**
>
> Thanks. So let me frame the problem that Snowflake Cortex solves.
>
> Every organization I work with has the same challenge: your data is split between structured tables and unstructured documents. Your analysts know the tables. Your subject matter experts know the documents. But nobody has a tool that works across both.
>
> Take denial management as an example — which is what we'll demo today. A claim gets denied. The analyst needs to pull the denial data from the claims system, look up how many similar denials there have been, find the payer's policy document — which is a 40-page PDF somewhere — figure out what went wrong, and decide whether to appeal.
>
> That workflow crosses structured data, unstructured documents, and institutional knowledge. Today it takes multiple systems and a lot of manual effort. What if you could just ask a question and get the answer — with sources cited?
>
> That's Cortex AI. Let me walk you through the building blocks.

### [SLIDE: Cortex AI Functions — AI in a SQL Function]

> **Script:**
>
> The simplest entry point into Cortex AI is **AI Functions**. These are SQL functions you can call directly in a query — no infrastructure, no API keys, no deployment.
>
> A few examples:
>
> - `AI_COMPLETE` — send a prompt to an LLM and get a response. Use it for summarization, classification, extraction, or any text generation task. You can pick models like Claude Sonnet, Llama, Mistral, or use `auto` and let Snowflake choose.
> - `AI_CLASSIFY` — classify text into categories you define. "Is this claim denial related to authorization, coding, or documentation?"
> - `AI_EXTRACT` — pull structured fields out of unstructured text. Give it a policy document, ask for the prior auth deadline and the required documentation checklist, and it returns JSON.
> - `AI_SENTIMENT`, `AI_SUMMARIZE`, `AI_TRANSLATE` — exactly what they sound like.
>
> The key insight: these run directly on your data inside Snowflake. You can process an entire table — thousands or millions of rows — with a single SELECT statement. There's no data movement, no API rate limits to manage, no separate billing account.
>
> For developers, this means you can embed AI into your existing SQL pipelines. For analysts, it means you can enrich your data without learning Python.

### [SLIDE: Cortex Search — Finding Answers in Documents]

> **Script:**
>
> AI Functions work on individual rows. But what if you need to search across a large corpus of documents? That's **Cortex Search**.
>
> Cortex Search is a fully managed hybrid search engine that combines three techniques:
>
> - **Semantic search** — understands meaning. If you search for "cardiac catheterization coverage criteria," it finds documents about "left heart cath medical necessity" even if those exact words aren't used.
> - **Keyword search** — catches exact terms. Important for things like CPT codes, policy numbers, or specific denial reason codes.
> - **A reranker** — takes the combined results and puts the most relevant ones on top.
>
> You create a search service with a single SQL statement. Point it at a table, tell it which column to index, define filterable attributes, and Snowflake handles the rest — embedding, indexing, serving, and auto-refreshing as your data changes.
>
> For today's demo, we'll index payer policy documents. But customers use this for everything — HR policy manuals, product documentation, research papers, legal contracts, support tickets.

### [SLIDE: Cortex Analyst & Semantic Views — Text-to-SQL]

> **Script:**
>
> Search handles documents. **Cortex Analyst** handles structured data. It converts natural language questions into SQL queries.
>
> But here's what makes it enterprise-grade: it doesn't guess at SQL. It uses a **Semantic View** — a business-level description of your data model.
>
> Think of it as a translation layer. Your business users say "denial rate by payer." The database has `SUM(denied_amount) / NULLIF(SUM(claim_amount), 0) FROM denial_claims_fact f JOIN payer_dim p ON f.payer_key = p.payer_key`. The semantic view bridges that gap.
>
> A semantic view defines:
> - **Tables and relationships** — the star schema your data lives in
> - **Dimensions** — the columns users filter and group by, described in business terms
> - **Metrics** — pre-defined calculations like denial rate, average days to resolution, recovery rate
> - **Synonyms** — so "payer," "insurance company," and "health plan" all resolve to the same column
> - **Verified queries** — example question-SQL pairs that anchor accuracy for your most important questions
>
> The result: when a user asks "what's our denial rate by payer for Q1," Cortex Analyst generates correct SQL every time — because it has the business context.

### [SLIDE: Cortex Agents — The Orchestration Layer]

> **Script:**
>
> Now here's where it gets powerful. **Cortex Agents** sit on top of Search and Analyst and orchestrate across them.
>
> An agent can:
> - **Route** — decide which tool to use for each part of a question. Data question? Cortex Analyst. Document question? Cortex Search. Both? It uses both.
> - **Synthesize** — combine results from multiple tools into a single coherent answer.
> - **Act** — call custom tools like web scrapers, email functions, or any stored procedure you give it access to.
>
> Here's a concrete example. A user asks: "We're getting CO-16 denials from UnitedHealth. How many do we have, what's the dollar impact, and what documentation should we be including to prevent these?"
>
> The agent:
> 1. Routes part 1 to Cortex Analyst — queries denial data, counts the CO-16 denials, sums the dollars
> 2. Routes part 2 to Cortex Search — searches the UnitedHealth documentation requirements policy
> 3. Synthesizes — "You have X denials totaling $Y. The UnitedHealth policy requires member ID, NPI, diagnosis codes, and prior auth number. Here's the relevant policy excerpt..."
>
> That's a 30-minute workflow done in 30 seconds. And you create an agent with a single SQL statement — model, tools, instructions.

### [SLIDE: Snowflake Intelligence — AI for Everyone]

> **Script:**
>
> Agents are great, but your business users aren't going to open a SQL worksheet. **Snowflake Intelligence** is the end-user experience.
>
> It takes any agent you build and wraps it in a polished, conversational interface. Your analysts, managers, executives — they just open Snowflake Intelligence and start typing questions. No SQL. No code.
>
> Key capabilities:
> - **Auto-generated charts** — the agent decides if a bar chart, line chart, or table best answers the question
> - **Source citations** — every answer shows where the data came from. Click to see the SQL or the policy excerpt.
> - **Conversation threads** — ask follow-ups and the agent remembers context
> - **Artifacts** — save a chart or table as a shareable object
> - **Full governance** — same Snowflake RBAC. Users only see what their role permits.
>
> The important point: any agent you create automatically appears in Snowflake Intelligence. No separate app to build or deploy.

### [SLIDE: Cortex REST API]

> **Script:**
>
> Quick note for the developers — everything I've shown you is also available via REST API.
>
> Cortex Complete, Search, and Agents all have REST endpoints. That means you can embed Snowflake AI into your existing applications — a customer portal, an internal tool, a mobile app — without building inside Snowflake's UI.
>
> Same governance, same models, same data boundaries. Just a different interface.

### [SLIDE: Cortex Code (CoCo) — The Builder's Assistant]

> **Script:**
>
> Finally — **Cortex Code**, or CoCo. This is Snowflake's AI coding agent, and it's what I'm going to use for the live demo.
>
> CoCo knows your Snowflake account — your databases, schemas, tables, roles, warehouses. You describe what you want in plain English, and it writes the SQL, Python, Streamlit code, or agent configuration.
>
> What CoCo can do:
> - Create semantic views, Search services, and agents from a natural language description
> - Write and deploy Streamlit applications
> - Query and analyze your data — write and run SQL, visualize results
> - Debug, refine, and iterate — "change the chart to a line chart" and it updates
>
> I'll use CoCo to build everything in the demo. You'll see me describe what I want and watch CoCo create it. Let me switch to a live demo.

---

## PART 3: Live Build Demo — Solutions Engineer (25 min)

> **Transition:**
>
> Alright — everything we just talked about, I'm going to build live. We have a healthcare denial management dataset already loaded, along with payer policy documents. I'm going to create a semantic view, a search service, and an agent — and then we'll talk to it through Snowflake Intelligence.
>
> I have SQL scripts as backup if anything goes sideways, but the goal is to build this using the Snowflake UI and Cortex Code.

### Demo Step 1: The Data Foundation (5 min)

> **Script:**
>
> Let me start by showing you what we're working with. The data is already loaded — in production, this would come from your EHR, claims system, or data warehouse via pipelines.
>
> **[Open Snowsight → HEALTHCARE_AI_DEMO.DENIALS schema]**
>
> We have a star schema — 8 dimension tables and 3 fact tables covering denial claims, appeals, and monthly summaries. Let me show you the core tables:
>
> **[Run: `SELECT * FROM denial_claims_fact LIMIT 10;`]**
>
> Each row is a denied claim — date of service, payer, procedure, denial reason, dollar amounts, appeal status, and days to resolution. About 8,000 claims across 10 payers, 15 departments, and 25 procedures.
>
> **[Run: `SELECT * FROM payer_dim;`]**
>
> Here are our payers — Aetna, Blue Cross, UnitedHealth, Cigna, and others. Both commercial and government.
>
> Now the unstructured side:
>
> **[Navigate to the internal stage or run: `SELECT relative_path, title, doc_category, LEFT(content, 200) AS preview FROM parsed_content;`]**
>
> We've already parsed 9 documents — 6 payer policies and 3 internal clinical guidelines — using `CORTEX.AI_PARSE_DOCUMENT`. Each document is a row with its full text content, category, and file reference.
>
> So we have structured denial data in tables, and unstructured policy documents parsed and ready. Now let's make them queryable with AI.

### Demo Step 2: Build the Semantic View (7 min)

> **Script:**
>
> First, we need to teach Cortex Analyst how to query our denial data. That means creating a semantic view.
>
> **[Option A — Using the UI: Navigate to AI & ML → Semantic Views → Create]**
>
> I'll select my tables — `denial_claims_fact` as the central fact table, joined to `payer_dim`, `procedure_dim`, `department_dim`, `facility_dim`, `denial_reason_dim`, `appeal_status_dim`, and `provider_dim`. I'll define the relationships, add business-friendly descriptions, and create metrics like total denials, total denied amount, denial rate, and average days to resolution.
>
> **[Option B — Using CoCo: Open Cortex Code and type:]**
>
> *"Create a semantic view called DENIAL_ANALYTICS_SV over the denial_claims_fact table joined to all dimension tables in the HEALTHCARE_AI_DEMO.DENIALS schema. Include metrics for total denials, total denied amount, denial rate (denied / charged), and average days to resolution. Add business-friendly synonyms and descriptions for all dimensions."*
>
> **[Walk through the output as CoCo generates the CREATE SEMANTIC VIEW statement]**
>
> Look at what it created — tables with primary keys and synonyms, relationships defined, dimensions with descriptions, and metrics with the right calculations. This is the translation layer between business questions and SQL.
>
> **[Run the statement to create the semantic view]**
>
> **[Verify: `SHOW SEMANTIC VIEWS;`]**
>
> *If the live build has issues, run the semantic view section from `demo_setup.sql`.*

### Demo Step 3: Build the Search Service (5 min)

> **Script:**
>
> Next, let's make our policy documents searchable. We need a Cortex Search service.
>
> **[Option A — Using the UI: Navigate to AI & ML → Cortex Search → Create]**
>
> I'll point it at the `parsed_content` table, index the `content` column, and add `title` and `doc_category` as filterable attributes. I'll pick the Arctic embedding model and set a target lag.
>
> **[Option B — Using CoCo:]**
>
> *"Create a Cortex Search service called SEARCH_PAYER_POLICIES on the parsed_content table in HEALTHCARE_AI_DEMO.DENIALS. Index the content column. Add relative_path, file_url, title, and doc_category as attributes. Use the HEALTHCARE_DEMO_WH warehouse. Only include rows where doc_category = 'payer_policies'."*
>
> **[Walk through the CREATE CORTEX SEARCH SERVICE statement]**
>
> Notice how simple this is — one SQL statement. Snowflake handles the embedding, the vector index, the keyword index, the reranker, and the auto-refresh. No vector database, no MLOps pipeline.
>
> **[Run the statement and verify: `SHOW CORTEX SEARCH SERVICES;`]**
>
> The service will take a minute to initialize. While it builds, let me talk about what's happening — Snowflake is chunking the documents, generating embeddings with the Arctic model, building both vector and keyword indexes, and standing up an API endpoint.
>
> *If the live build has issues, run the search service section from `demo_setup.sql`.*

### Demo Step 4: Build the Agent (5 min)

> **Script:**
>
> Now the fun part — let's create an agent that ties the structured data and documents together.
>
> **[Option A — Using the UI: Navigate to AI & ML → Agents → Create]**
>
> I'll give it a name — Healthcare Denial Management Agent. Add our semantic view as a Cortex Analyst tool. Add our search service as a Cortex Search tool. Set the model to `auto`. And write instructions telling the agent when to use each tool.
>
> **[Option B — Using CoCo:]**
>
> *"Create a Snowflake Intelligence agent called Healthcare_Denial_Management_Agent in HEALTHCARE_AI_DEMO.DENIALS. Connect these tools: (1) the DENIAL_ANALYTICS_SV semantic view for denial data queries, (2) the SEARCH_PAYER_POLICIES Cortex Search service for policy document searches. Set the model to auto. Instruct the agent to use Analyst for data/metrics questions and Search for policy/documentation questions, and to use both when needed."*
>
> **[Walk through the CREATE AGENT statement]**
>
> Look at the structure — a model, tools with descriptions so the agent knows when to use each one, and instructions for orchestration. The agent specification is JSON, the tools reference the semantic view and search service we just created.
>
> **[Run the statement and verify: `SHOW AGENTS IN SCHEMA HEALTHCARE_AI_DEMO.DENIALS;`]**
>
> *If the live build has issues, run the agent section from `demo_setup.sql`.*

### Demo Step 5: Snowflake Intelligence — Talk to the Agent (3 min)

> **Script:**
>
> Now let's see it in action. Our agent is live — and it automatically appears in Snowflake Intelligence.
>
> **[Open Snowflake Intelligence from the left nav → select Healthcare Denial Management Agent]**
>
> Let me start with a data question:
>
> **[Type: "What are the top 5 denial reasons by total denied amount? Show me a bar chart."]**
>
> **[Wait for response]**
>
> Look — it routed to Cortex Analyst, generated SQL against our denial data, and returned the results with an auto-generated chart. You can expand to see the SQL it wrote.
>
> Now a document question:
>
> **[Type: "What does the UnitedHealthcare policy say about required documentation for claims submissions?"]**
>
> This time it routed to Cortex Search — it knows this is a policy question. It retrieves the relevant section and summarizes it with a citation.
>
> Now the powerful one — a question that needs BOTH tools:
>
> **[Type: "We're getting a lot of CO-197 prior authorization denials. Which payers and departments are most affected, and what do the payer policies say about prior auth requirements for surgical procedures?"]**
>
> **[Walk through the agent's reasoning as it executes]**
>
> See how it splits this? It queries the denial data for CO-197 patterns, then searches the policy documents for prior auth requirements. The final answer synthesizes both — data and policy — into actionable guidance.
>
> One more — a business user question:
>
> **[Type: "Give me an executive summary of our denial performance — total denied dollars, top 3 denial reasons, the payer with the highest denial rate, and your recommended action items."]**
>
> **[Point out the structured response with data, analysis, and specific recommendations]**
>
> This is what your business users get. Plain English question, data-backed answer, specific next steps. No SQL, no code, no training.

---

## Wrap-up (remaining time)

### [SLIDE: Recap]

> **Script:**
>
> Let me recap what you just saw us build in 25 minutes:
>
> 1. **Semantic View** — taught Cortex Analyst how to query our denial data with business-friendly definitions and metrics
> 2. **Cortex Search Service** — indexed policy documents for hybrid semantic + keyword search
> 3. **Cortex Agent** — connected both tools with orchestration logic so it knows when to query data vs. search documents
> 4. **Snowflake Intelligence** — the agent automatically appeared for any authorized user to chat with
>
> Each layer builds on the last. The semantic view and search service are the data foundations. The agent orchestrates across them. And Snowflake Intelligence is the interface your business users see.
>
> For the technical folks — you saw how every component is a SQL statement. For the business folks — you saw a user experience where you just ask a question and get an answer.

### [SLIDE: Questions]

> **Script:**
>
> We have a few minutes for questions. What stood out to you? What would you want to build with this for your own data?

---

## Appendix: Slide Deck Reference

| Slide # | Title | Presenter | Key Talking Points | Time |
|---------|-------|-----------|-------------------|------|
| 1 | Title / Welcome | AE | Event name, speakers, agenda | 1 min |
| 2 | What is Snowflake? | AE | Zero infra, one copy of data, governed by design | 4 min |
| 3 | The Modern Data Platform | AE | Data eng, analytics, ML, sharing, apps, AI | 5 min |
| 4 | What This Means for the Business | AE | Value by persona — devs, analysts, leaders | 5 min |
| 5 | The AI Challenge | SE | Multi-system problem, structured + unstructured gap | 2 min |
| 6 | Cortex AI Functions | SE | AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT — SQL-callable AI | 3 min |
| 7 | Cortex Search | SE | Hybrid semantic + keyword search, single SQL statement | 3 min |
| 8 | Cortex Analyst & Semantic Views | SE | Text-to-SQL, business context, verified queries | 3 min |
| 9 | Cortex Agents | SE | Orchestration, route/synthesize/act, multi-tool example | 3 min |
| 10 | Snowflake Intelligence | SE | End-user chat, charts, citations, governance | 2 min |
| 11 | Cortex REST API | SE | Embed AI in external apps, same governance | 1 min |
| 12 | Cortex Code (CoCo) | SE | AI coding agent, live demo transition | 3 min |
| 13 | Live Demo | SE | Build semantic view, search, agent, test in Intelligence | 25 min |
| 14 | Recap | SE | Four components built, layered architecture | 2 min |
| 15 | Questions | Both | Open Q&A | remaining |

**Total:** ~60 minutes (15 Snowflake overview + 20 Cortex AI overview + 25 live demo)

---

## Presenter Notes

### AE — Part 1 Tips

- **Know your audience mix** — if the room skews technical, spend less time on "what is Snowflake" and more on data engineering / ML capabilities. If it skews business, lean into the ROI and governance story.
- **Bridge to Patrick** — the handoff should feel natural. End with "the AI layer is the newest and fastest-growing part of the platform" to set up Patrick's deep dive.
- **Don't go deep on architecture** — this audience doesn't need storage/compute/services detail. Keep it high-level and outcome-oriented.

### SE — Part 2 Tips

- **AI Functions slide** — if time is tight, this is the one to abbreviate. The audience will see AI in action during the demo; you don't need to sell it twice.
- **Semantic View explanation** — use the "translator" metaphor. Business language on one side, SQL on the other, semantic view in the middle. Everyone gets it.
- **Agent explanation** — the multi-tool routing example is the key moment. Make sure the audience understands the agent decided which tool to use, not the user.

### SE — Part 3 Demo Tips

- **Have `demo_setup.sql` open in a separate tab** — if CoCo or the UI hits a snag, you can copy-paste the relevant section and keep moving. Don't let a technical hiccup stall the demo.
- **Narrate while things load** — search services take a minute to initialize. Use that time to recap what's happening under the hood.
- **Snowflake Intelligence prompts** — the prompts in the script are tested against this dataset. Stick to them for reliability. The "executive summary" prompt is the strongest closer.
- **After the multi-tool question** — this is the "wow" moment. Slow down, point out the tool routing in the reasoning panel. Let it land.
- **Audience engagement** — after the Intelligence demo, ask "What would YOU want to ask your data?" Gets people thinking about their own use case.

### Common Questions & Answers

| Question | Answer |
|----------|--------|
| "Is the data leaving Snowflake?" | No — Cortex AI runs inside your Snowflake account. Data never leaves your security boundary. |
| "What LLMs are available?" | Claude Sonnet, GPT-4.1, Llama, Mistral, and others. With `auto` mode, Snowflake picks the best model. Cross-region inference routes to the best model regardless of your account's region. |
| "How much does this cost?" | All consumption-based. Cortex Search: per GB of indexed data/month + warehouse. Agents: per token. AI Functions: per token. No upfront commitments. |
| "Can we use this with our own data?" | Absolutely. Any data in Snowflake — or data you bring in via connectors, Snowpipe, or file stages — can be used with Cortex AI. |
| "How long does setup take?" | What you just saw me build took 25 minutes. In production, the main investment is in the semantic view (business definitions) and document curation. The infrastructure is trivial. |
| "Is this secure / compliant?" | Snowflake supports SOC 2, HIPAA (with BAA), FedRAMP, PCI DSS, and more. Cortex AI features are governed by the same access controls as the underlying data. |
| "Can I access this via API?" | Yes — Cortex Complete, Search, and Agents all have REST APIs. You can embed Snowflake AI into any application. |
