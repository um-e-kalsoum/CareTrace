import { getMonthlyStats, getTimeline } from "@/lib/caretrace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [events, monthly] = await Promise.all([getTimeline(), getMonthlyStats()]);
    return Response.json({ events, monthly }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Snowflake timeline error:", err);
    return Response.json({ error: "Unable to load Snowflake records. Check server credentials and role access." }, { status: 500 });
  }
}
