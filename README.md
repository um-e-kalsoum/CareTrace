# CareTrace

**Your symptoms have a timeline. CareTrace makes it easier to share your story at your next appointment.**

Built for **Hacktoberfest x ElleHacks Hack Day 2026**. Entered in **Best Open-Source AI Project** and **Best Open-Source AI Project with Snowflake**.

🎥 **Demo video:** [Watch on YouTube](https://www.youtube.com/watch?v=bkcg9mivp4Y)

> **Demo only.** Every patient record in this app is synthetic (Synthea-generated). CareTrace is not a medical device. It does not diagnose, recommend treatment or give emergency advice.

## Submission checklist

| Requirement | Where to find it |
|---|---|
| Public GitHub repository | https://github.com/um-e-kalsoum/CareTrace |
| Open-source license | [MIT License](LICENSE) |
| What we built | [What it does](#what-it-does) |
| Who it helps | [Who it helps](#who-it-helps) |
| How to run it | [Run it locally](#run-it-locally) |
| Open-weight model + license | Meta Llama 3.1 8B Instruct (`llama3.1-8b`) under the [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/). See [Model and harness](#model-and-harness-what-we-built) |
| Agent skills | Not applicable. CareTrace is not an agent skill. See [Agent Skills standard](#agent-skills-standard) |
| Model harness description | [Model and harness](#model-and-harness-what-we-built) |
| Recorded demo | Link at the top of this README |
| Snowflake challenge: dataset + CoCo | [Snowflake partner challenge](#snowflake-partner-challenge) |

## What it does

CareTrace combines a patient's dated clinical records with symptoms they log themselves into one timeline. It then uses an open-weight LLM to write an appointment brief in which every important claim cites a source record ID.

- **Timeline:** clinical conditions, encounters and lab observations from Snowflake, merged with self-reported symptom notes.
- **Log a symptom:** a note is written to Snowflake (`CARETRACE.PUBLIC.USER_NOTES`) and appears on the timeline straight away.
- **Trends:** monthly symptom count and average severity, computed in Snowflake SQL (`DATE_TRUNC`, `COUNT`, `AVG`).
- **AI appointment brief:** open-weight **Llama 3.1 8B**, run through Snowflake Cortex, summarizes the latest records into highlights, recurring issues, questions for the appointment, and gaps.
- **Evidence explorer:** each `Clinical #ID` or `Self-reported #ID` the model cites is checked against the real timeline. IDs that don't exist are flagged, so made-up citations are visible.

## Why I built it

Every time I go to the doctor, I forget my symptoms the moment I sit down. For women, the dates matter: cycles, pregnancies and losses. How many times has your doctor asked when your last period was and how long it lasted? If you can't answer correctly, your doctor can't give you the best care they can. I built CareTrace so you don't have to remember that information yourself.

## Who it helps

People, especially those managing reproductive and women's health, who must explain years of scattered history in a short appointment. Important dates are easy to lose: a past miscarriage, a pregnancy complication, when a symptom started. CareTrace keeps the clinical record and the patient's own account together, and it helps the patient arrive with organized, sourced notes and good questions.

## Model and harness (what we built)

**Model:** Meta **Llama 3.1 8B Instruct**, an open-weight model, called as `llama3.1-8b` through `SNOWFLAKE.CORTEX.COMPLETE`. We did not fine-tune or change the model weights. License: [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/).

**The harness we built around it** ([`src/app/api/brief/route.ts`](src/app/api/brief/route.ts), [`src/lib/caretrace.ts`](src/lib/caretrace.ts)):

1. **Server-side grounding.** For each brief, the server reads the latest timeline from Snowflake. It never trusts a timeline sent by the browser. Each record goes into the prompt as one line: `date | type | description | Clinical/Self-reported #ID`.
2. **Constrained prompt.** The system instructions limit the model to recorded events. It may not diagnose, recommend treatment, infer causes or invent outcomes. It must keep clinical and self-reported data separate, treat record text as data rather than instructions (to resist prompt injection), cite an existing ID beside each key claim, and use four fixed Markdown headings in under 400 words.
3. **Citation validation.** After Cortex replies, `validateEvidence()` extracts every `Clinical #ID` and `Self-reported #ID` reference and checks it against the real timeline. The UI's evidence explorer shows each citation's date and source record, and it flags any made-up ID.
4. **Safe failure.** An empty or failed model response returns a generic error. The UI never shows partial or unchecked output as a brief.

## Agent Skills standard

Not applicable. CareTrace is a web app with a model harness. It is not an agent skill, so the Agent Skills standard does not apply.

## Snowflake partner challenge

| Requirement | How CareTrace meets it |
|---|---|
| **Snowflake CoCo** | Used to find the dataset, explore it, choose a patient, write the SQL, create the app's tables, set up a least-privilege role and clean the demo data (details below). |
| **Free Snowflake dataset** | **Synthetic Healthcare Data - Clinical and Claims** by *Snowflake Virtual Hands-On Labs* (free [Snowflake Marketplace](https://app.snowflake.com/marketplace) listing). Database: `SYNTHETIC_HEALTHCARE_DATA_CLINICAL_AND_CLAIMS`, schema `SILVER`, tables `CONDITIONS`, `ENCOUNTERS`, `OBSERVATIONS` and `PATIENTS`. |
| **Open-weight AI** | `llama3.1-8b` (Meta Llama 3.1 8B Instruct, a small language model with 10B or fewer parameters) called via `SNOWFLAKE.CORTEX.COMPLETE`. License: [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/). |
| **Open-source repo** | Public repository, [MIT License](LICENSE). |

### How CoCo helped

We used Snowflake CoCo in Snowsight for the data work in this project:

1. **Found the dataset.** We asked CoCo to search the Marketplace for synthetic healthcare data. It returned *Synthetic Healthcare Data - Clinical and Claims*, and we added that listing.
   ![CoCo finds the Marketplace dataset](docs/coco/1-coco-finds-marketplace-dataset.png)
2. **Explored the schema.** CoCo listed every table with its row counts and explained how the tables relate: they join on `PATIENT_ID` and `ENCOUNTER_ID`, about 2.2B rows in total.
3. **Found a demo patient.** CoCo wrote and ran SQL that joins `CONDITIONS` and `PATIENTS` to find female patients with several reproductive-health conditions. From the results we chose synthetic patient **1563304**.
4. **Built and checked the timeline SQL.** CoCo wrote the `UNION ALL` query over conditions, encounters and observations (one observation per month per type, via `QUALIFY ROW_NUMBER()`). It then created `DEMO_TIMELINE` and `USER_NOTES`. The SQL is saved in [`sql/setup.sql`](sql/setup.sql).
5. **Created a least-privilege role and tested it.** CoCo created `CARETRACE_APP` with only what the app needs: `USAGE` on the warehouse, database and schema; `SELECT` on `DEMO_TIMELINE`; `SELECT` and `INSERT` on `USER_NOTES`; and `SNOWFLAKE.CORTEX_USER`. It then tested each grant: it read 15 timeline rows, inserted a note and removed it, and got a reply from `CORTEX.COMPLETE('llama3.1-8b', ...)`. The role has no admin roles, no `DELETE`, `UPDATE` or `CREATE` rights, and no access to the source dataset.
   ![CoCo creates and tests the least-privilege role](docs/coco/2-coco-creates-least-privilege-role.png)
6. **Checked roles and the access token.** CoCo confirmed that the app's programmatic access token is limited to `CARETRACE_APP`, is short-lived, and that the old token has expired after rotation.
   ![CoCo audits roles and the access token](docs/coco/3-coco-audits-roles-and-token.png)
7. **Cleaned the demo data.** Before recording, CoCo found the test notes in `USER_NOTES` and removed them, leaving only the three original demo notes. It asked for confirmation before each `DELETE`.
   ![CoCo removes test notes](docs/coco/4-coco-cleans-test-notes.png)

## Architecture

```
Browser (React UI)
   │  fetch
   ▼
Next.js API routes (server only, credentials never reach the browser)
   ├── GET  /api/timeline  → SQL: DEMO_TIMELINE ∪ USER_NOTES + monthly DATE_TRUNC/COUNT/AVG
   ├── POST /api/notes     → INSERT INTO USER_NOTES (validated, parameter-bound)
   └── POST /api/brief     → SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', prompt) → citation check
   │  snowflake-sdk (Node.js)
   ▼
Snowflake: CARETRACE.PUBLIC  ←  built from the SYNTHETIC_HEALTHCARE_DATA_CLINICAL_AND_CLAIMS Marketplace share
```

| File | Purpose |
|---|---|
| `src/app/ui.tsx` | React UI: timeline, trends, symptom logging, AI brief, evidence explorer |
| `src/app/api/timeline/route.ts` | Reads the timeline and monthly analytics from Snowflake |
| `src/app/api/notes/route.ts` | Validates a symptom note and inserts it into `USER_NOTES` |
| `src/app/api/brief/route.ts` | Builds the prompt from current Snowflake rows, calls Cortex (Llama 3.1 8B) and validates cited IDs |
| `src/lib/caretrace.ts` | Timeline/analytics SQL and the citation validator |
| `src/lib/snowflake.ts` | Snowflake Node.js connection (server only) |
| `sql/setup.sql` | SQL CoCo helped write to build `DEMO_TIMELINE` and `USER_NOTES` from the Marketplace dataset |

**Stack:** Next.js 15, React 19, TypeScript, Recharts, `snowflake-sdk`, Snowflake Cortex.

## Run it locally

Prerequisites: Node.js LTS, and a Snowflake account (a free trial works) with the Marketplace listing above added.

1. **Create the tables (fresh account only).** Run [`sql/setup.sql`](sql/setup.sql) in a Snowsight worksheet. ⚠️ It uses `CREATE OR REPLACE`, so it will delete any existing CareTrace notes. Then confirm Cortex works:
   ```sql
   SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', 'Reply: connected');
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure credentials.** Copy `.env.example` to `.env.local` and fill in your account identifier, user, warehouse, role and a programmatic access token (PAT). To create one, go to *Snowsight → Governance & security → Users & roles → your user → Programmatic access tokens*. Use a short-lived token tied to a least-privilege role. The role needs `USAGE` on the warehouse, database and schema; `SELECT` on `DEMO_TIMELINE`; `SELECT` and `INSERT` on `USER_NOTES`; and Cortex access.
4. **Start the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

**Security:** credentials are read only on the server. Never put them in `NEXT_PUBLIC_*` variables or commit `.env.local` (it is in `.gitignore`). The API routes have no authentication or rate limiting because this is a local hackathon demo. Do not deploy it publicly as-is.

## Responsible AI and limitations

- The prompt tells the model to describe only recorded events. It must not diagnose, suggest treatment or infer causes, and it must treat record text as data, not instructions.
- The evidence explorer checks only that cited IDs **exist** in the timeline. It does not prove each claim is accurate. Llama 3.1 8B can still make mistakes, so always review the original records.
- The data is synthetic and covers one patient. It is not evidence of clinical accuracy.

## License and credits

- Code: [MIT](LICENSE)
- Model: Meta Llama 3.1 8B, used under the [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/). **Built with Llama.**
- Data: *Synthetic Healthcare Data - Clinical and Claims* (Snowflake Virtual Hands-On Labs, Snowflake Marketplace), synthetic Synthea records.
