# CareTrace — 2-minute judge walkthrough

**Elevator pitch:** CareTrace helps people prepare for a health appointment by merging scattered dated clinical records and self-reported symptoms into an evidence-linked brief. It is designed around common challenges in communicating women’s reproductive health histories. It is **not a medical diagnosis tool**. All patient records in this demonstration are synthetic.

## Demo script

- **0–15 s — The problem:** A patient has years of clinical history and new symptoms; important dates get lost when trying to explain them at an appointment.
- **15–40 s — Snowflake-powered timeline:** Show the synthetic patient timeline loaded from the free *Synthetic Healthcare Data - Clinical and Claims* Snowflake Marketplace dataset. Open a condition/encounter and reveal its source record ID.
- **40–65 s — Live persistence:** Add a fictional symptom note. Return to the timeline and show it saved in `CARETRACE.PUBLIC.USER_NOTES`.
- **65–85 s — Analytics:** Show the monthly severity chart. Explain that `DATE_TRUNC`, `COUNT`, and `AVG` run inside Snowflake SQL, not just in the browser.
- **85–110 s — Explainable AI:** Generate an appointment brief using open-weight `llama3.1-8b` through Snowflake Cortex. Open the evidence explorer to show which cited source IDs actually exist in the timeline. Do not imply source matching proves every claim is correct.
- **110–120 s — Sponsor criteria:** Briefly show the CoCo screenshot and point to the public MIT-licensed GitHub repository, README, dataset identification, and the Llama license link.

## Must-have before submission

- [x] Screenshot of CoCo exploring tables and generating/verifying SQL; save to `docs/` and reference in README.
- [ ] Full working live demo, including at least one insert and a regenerated AI report.
- [ ] Recorded demo video or link; check that the video is playable.
- [x] Public GitHub repository with MIT license, README, TypeScript source, SQL provenance, model license link.
- [x] Name the free Snowflake Marketplace dataset and describe CoCo's actual contribution.
- [x] No real patient data, credentials, or `.env.local` in the repository.
- [ ] Submit before 5:00 PM local event time.

## Honest limitations

- Synthetic records may not represent real clinical outcomes.
- The small patient-level demonstration does not prove clinical accuracy or population-level performance.
- Llama can generate incorrect claims. Source ID matching checks provenance identifiers only.
- The local Next.js demo does not include public-user authentication, rate limiting, or privacy compliance. Do not expose the API publicly without protecting it.
