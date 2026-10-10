# CareTrace — React/TypeScript migration

CareTrace is a **Next.js + TypeScript + CSS** frontend/API connected to the **existing Snowflake database** from our ElleHacks Hacktoberfest project. No healthcare data migration required.

## Project architecture

- `src/app/ui.tsx` — React frontend, timeline, trends, log symptom, AI appointment brief, evidence explorer.
- `src/app/globals.css` — patient-focused responsive UI; no implementation-details tab.
- `src/app/api/timeline/route.ts` — GET data and analytics from Snowflake.
- `src/app/api/notes/route.ts` — POST a symptom into `CARETRACE.PUBLIC.USER_NOTES`.
- `src/app/api/brief/route.ts` — calls **Snowflake Cortex** with `llama3.1-8b`, validates source IDs.
- `src/lib/snowflake.ts` — Snowflake Node.js connector. Credentials remain on the server.

The original Streamlit app can remain running as a **backup**. Do **not** rerun setup.sql or replace any of the existing tables.

## Run locally in VS Code (Windows 11)

1. Extract this folder and open it in VS Code.
2. Install [Node.js](https://nodejs.org/) if you do not already have it; a currently supported LTS release is recommended.
3. In PowerShell, run `npm install`.
4. Copy `.env.example` to `.env.local` and configure Snowflake connection values (see below).
5. Run `npm run dev`, then open `http://localhost:3000`.
6. Confirm GET `/api/timeline` works first, then test adding a note and generating a brief.

### Snowflake credentials

Find your Snowflake **account identifier**, **login username**, **warehouse**, and a suitable **role** from the Snowsight UI. They are different from your organization's display name.

The starter uses a **programmatic access token (PAT)** with the Snowflake Node.js driver:

```
SNOWFLAKE_ACCOUNT=yourorg-youraccount
SNOWFLAKE_USER=YOUR_LOGIN_NAME
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=YOUR_APP_ROLE
SNOWFLAKE_AUTHENTICATOR=PROGRAMMATIC_ACCESS_TOKEN
SNOWFLAKE_TOKEN=your_token_secret
```

To create a PAT: **Snowsight → Governance & security → Users & roles → your user → Programmatic access tokens → Generate new token**. Snowflake may require appropriate authentication/network policy settings for PATs (especially on a new trial account), so check the on-screen requirements. Create a **short-lived token restricted to a least-privilege role**, rather than `ACCOUNTADMIN`. The role needs `USAGE` on the warehouse/database/schema, `SELECT` on `DEMO_TIMELINE`, `SELECT` and `INSERT` on `USER_NOTES`, and permission to use Snowflake Cortex. Restrict user/role permissions before deployment.

For local **SSO** accounts, `SNOWFLAKE_AUTHENTICATOR=EXTERNALBROWSER` can work with the driver when SSO is configured. It is not suitable for a normal serverless deployment. Snowflake account policies may block particular methods.

Docs:
- [Snowflake Node.js driver authentication](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-authenticate)
- [Node.js driver programmatic access tokens](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-options)
- [PAT policy requirements](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens)

**Security:** Never put your token in the React code, `NEXT_PUBLIC_*` env variables, browser JavaScript, or a public GitHub repository. The `.gitignore` protects `.env.local`, but inspect `git status` before pushing. If you deploy this publicly, add authentication, rate limiting, and resource controls to protect your Snowflake account and Cortex credits; these open demo routes are for local/judged demonstration only.

## Hackathon checklist

- Keep your CoCo screenshots and SQL in the README or submission.
- Identify the Snowflake Marketplace listing (Synthetic Healthcare Data - Clinical and Claims).
- Cite the open-weight model and terms: [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/).
- Explain how the Snowflake SQL query combines source records and self-reported notes.
- Record a demo of reading history → logging a symptom → seeing the new event → generating an AI brief → inspecting cited source IDs.
- Publish the repository with `LICENSE` and a demo video link by the event deadline.

**Demo-only disclaimer:** This app uses synthetic healthcare records and is not for medical diagnosis or emergency advice.
