import { PATIENT_ID } from "@/lib/caretrace";
import { runQuery } from "@/lib/snowflake";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });
    const { date, symptom, severity, notes } = body as Record<string, unknown>;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ||
        typeof symptom !== "string" || !symptom.trim() || symptom.length > 120 ||
        typeof severity !== "number" || !Number.isInteger(severity) || severity < 1 || severity > 10 ||
        typeof notes !== "string" || notes.length > 1000) {
      return Response.json({ error: "Please enter a valid date, symptom, severity (1-10), and notes." }, { status: 400 });
    }
    await runQuery(`INSERT INTO CARETRACE.PUBLIC.USER_NOTES
      (PATIENT_ID, NOTE_DATE, SYMPTOM, SEVERITY, NOTES)
      VALUES (?, TO_TIMESTAMP_NTZ(?), ?, ?, ?)`,
      [PATIENT_ID, `${date} 12:00:00`, symptom.trim(), severity, notes.trim()]);
    return Response.json({ saved: true });
  } catch (err) {
    console.error("Snowflake notes error:", err);
    return Response.json({ error: "Could not save this note." }, { status: 500 });
  }
}
