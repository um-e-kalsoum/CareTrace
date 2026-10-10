import { runQuery } from "@/lib/snowflake";

export const PATIENT_ID = 1563304;
export type TimelineEvent = {
  date: string;
  eventType: string;
  description: string;
  sourceId: string;
  source: "Clinical" | "Self-reported";
};
export type MonthlyStat = { month: string; noteCount: number; avgSeverity: number };

export async function getTimeline(): Promise<TimelineEvent[]> {
  const sql = `
    SELECT TO_CHAR(EVENT_DATE, 'YYYY-MM-DD HH24:MI:SS') AS EVENT_DATE,
           EVENT_TYPE, EVENT_DESCRIPTION, TO_VARCHAR(SOURCE_RECORD_ID) AS SOURCE_RECORD_ID,
           'Clinical' AS RECORD_SOURCE
      FROM CARETRACE.PUBLIC.DEMO_TIMELINE WHERE PATIENT_ID = ?
    UNION ALL
    SELECT TO_CHAR(NOTE_DATE, 'YYYY-MM-DD HH24:MI:SS'), 'SELF_REPORTED',
           SYMPTOM || ' (severity ' || TO_VARCHAR(SEVERITY) || '/10)' ||
           IFF(NULLIF(TRIM(NOTES), '') IS NULL, '', ' — ' || NOTES),
           TO_VARCHAR(NOTE_ID), 'Self-reported'
      FROM CARETRACE.PUBLIC.USER_NOTES WHERE PATIENT_ID = ?
    ORDER BY EVENT_DATE ASC`;
  const rows = await runQuery(sql, [PATIENT_ID, PATIENT_ID]);
  return rows.map((r) => ({
    date: String(r.EVENT_DATE),
    eventType: String(r.EVENT_TYPE),
    description: String(r.EVENT_DESCRIPTION),
    sourceId: String(r.SOURCE_RECORD_ID),
    source: r.RECORD_SOURCE === "Clinical" ? "Clinical" : "Self-reported",
  }));
}

export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  const rows = await runQuery(`
    SELECT TO_CHAR(DATE_TRUNC('MONTH', NOTE_DATE), 'YYYY-MM') AS MONTH,
           COUNT(*) AS NOTE_COUNT, ROUND(AVG(SEVERITY), 1) AS AVG_SEVERITY
    FROM CARETRACE.PUBLIC.USER_NOTES WHERE PATIENT_ID = ?
    GROUP BY 1 ORDER BY 1`, [PATIENT_ID]);
  return rows.map((r) => ({
    month: String(r.MONTH),
    noteCount: Number(r.NOTE_COUNT),
    avgSeverity: Number(r.AVG_SEVERITY),
  }));
}

export type Evidence = { reference: string; date: string; description: string; valid: boolean };
export function validateEvidence(report: string, timeline: TimelineEvent[]): Evidence[] {
  // Also expands lists the model writes as "Clinical #1, #2 and #3".
  const groups = Array.from(report.matchAll(/(Clinical|Self-reported)\s*(#\s*\d+(?:\s*(?:,|and|&)\s*#\s*\d+)*)/gi));
  const citations = new Set(groups.flatMap((g) =>
    Array.from(g[2].matchAll(/\d+/g), (id) => `${g[1].toLowerCase()}#${id[0]}`)));
  const index = new Map(timeline.map((event) => [
    `${event.source.toLowerCase()}#${event.sourceId}`,
    event,
  ]));
  return [...citations].map((ref) => {
    const event = index.get(ref);
    const [source, id] = ref.split("#");
    return {
      reference: `${source === "clinical" ? "Clinical" : "Self-reported"} #${id}`,
      date: event?.date.substring(0, 10) ?? "—",
      description: event?.description ?? "Not found in the source data",
      valid: Boolean(event),
    };
  });
}
