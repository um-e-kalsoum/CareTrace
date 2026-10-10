"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, BookOpenCheck, CalendarDays,
  CheckCircle2, ChevronDown, CircleAlert, ClipboardList, Database,
  FileCheck2, FileText, HeartPulse, LoaderCircle, Plus, RefreshCw,
  Search, ShieldCheck, Sparkles, Stethoscope, TrendingUp,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type EventRow = {
  date: string;
  eventType: string;
  description: string;
  sourceId: string;
  source: "Clinical" | "Self-reported";
};
type MonthlyStat = { month: string; noteCount: number; avgSeverity: number };
type EvidenceRow = { reference: string; date: string; description: string; valid: boolean };
type View = "overview" | "log" | "brief";
type ReportState = { report: string; evidence: EvidenceRow[] };

function prettyDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
function typeLabel(row: EventRow) {
  if (row.source === "Self-reported") return "Self-reported";
  if (row.eventType.startsWith("OBSERVATION")) return "Observation";
  if (row.eventType.startsWith("ENCOUNTER")) return "Encounter";
  return "Condition";
}
function downloadReport(report: string) {
  const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "caretrace-appointment-brief.md";
  a.click();
  URL.revokeObjectURL(url);
}

function RenderReport({ source }: { source: string }) {
  return (
    <div className="report-prose">
      {source.split("\n").map((line, index) => {
        const text = line.trim();
        if (!text) return <div key={index} className="report-gap" />;
        if (text.startsWith("## ")) return <h3 key={index}>{text.slice(3)}</h3>;
        if (text.startsWith("# ")) return <h2 key={index}>{text.slice(2)}</h2>;
        if (/^[-*] /.test(text)) return <p key={index} className="report-list">{text.slice(2)}</p>;
        return <p key={index}>{text.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

export default function CareTrace() {
  const [view, setView] = useState<View>("overview");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All events");
  const [selectedKey, setSelectedKey] = useState("");
  const [report, setReport] = useState<ReportState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [date, setDate] = useState("2020-02-16");
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/timeline", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load records");
      setEvents(payload.events);
      setMonthly(payload.monthly);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CareTrace data");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => [...events]
    .filter((row) => filter === "All events" || typeLabel(row) === filter)
    .filter((row) => `${row.description} ${row.date} ${row.eventType}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [events, filter, query]);
  const selected = filtered.find((row) => `${row.source}:${row.sourceId}` === selectedKey) ?? filtered[0];
  const clinicalCount = events.filter((row) => row.source === "Clinical").length;
  const personalCount = events.length - clinicalCount;
  const years = events.length ? new Set(events.map((row) => row.date.slice(0, 4))).size : 0;
  const byYear = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => counts.set(event.date.slice(0, 4), (counts.get(event.date.slice(0, 4)) || 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, count]) => ({ year, count }));
  }, [events]);

  const saveNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormBusy(true); setFormMessage("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, symptom, severity, notes }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to save note");
      setFormMessage("Your note was saved to Snowflake and added to the timeline.");
      setSymptom(""); setNotes(""); setReport(null);
      await reload();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Couldn't save symptom");
    } finally { setFormBusy(false); }
  };

  const makeBrief = async () => {
    setGenerating(true); setError("");
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to generate brief");
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate report");
    } finally { setGenerating(false); }
  };

  const nav: { id: View; title: string; hint: string; icon: typeof Activity }[] = [
    { id: "overview", title: "My care timeline", hint: "History & patterns", icon: Activity },
    { id: "log", title: "Symptom journal", hint: "Track a new entry", icon: Plus },
    { id: "brief", title: "Appointment brief", hint: "Your AI summary", icon: ClipboardList },
  ];

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><HeartPulse size={23}/></div><div><strong>caretrace</strong><span>HEALTH, IN CONTEXT</span></div></div>
      <div className="side-heading">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main menu">{nav.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} onClick={() => setView(item.id)} className={`nav-item ${view === item.id ? "active" : ""}`}>
          <Icon size={19}/><span><strong>{item.title}</strong><small>{item.hint}</small></span>{view === item.id && <ArrowRight size={16}/>}
        </button>;
      })}</nav>
      <div className="sidebar-bottom">
        <div className="patient-mini"><div className="avatar">ED</div><div><strong>Eden Dach</strong><span>Synthetic patient #1563304</span></div></div>
        <div className="private-note"><ShieldCheck size={17}/><span>Private by design<br/><small>Fictional demo records only</small></span></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">My health space <span>/</span> <strong>{view === "overview" ? "Overview" : view === "log" ? "Journal" : "Appointment brief"}</strong></div><div className="top-actions"><span className="demo-pill"><span className="status-dot"/> SYNTHETIC DATA</span><button className="refresh-btn" onClick={() => void reload()} title="Refresh data"><RefreshCw size={17}/></button></div></header>
      <div className="page-wrap">
        {error && <div className="error-box"><CircleAlert size={20}/><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {view === "overview" && <>
          <div className="hero"><div className="hero-content"><div className="eyebrow">YOUR STORY MATTERS</div><h1>Every symptom has a story.<br/><em>Let's connect the dots.</em></h1><p>A clearer view of your health journey, grounded in your actual records.</p><button onClick={() => setView("brief")} className="hero-button">Prepare for an appointment <ArrowRight size={18}/></button></div><div className="hero-art" aria-hidden="true"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><div className="hero-center"><HeartPulse size={49}/></div></div></div>
          <div className="section-heading"><div><span className="section-label">YOUR HEALTH AT A GLANCE</span><h2>Care overview</h2></div><span className="updated-caption">{loading ? "Loading..." : "Connected to Snowflake"}</span></div>
          <div className="metrics">
            <Metric title="Timeline records" value={events.length} subtitle="Across all sources" icon={<ClipboardList/>}/>
            <Metric title="Clinical events" value={clinicalCount} subtitle="Imported medical history" icon={<Stethoscope/>}/>
            <Metric title="Journal entries" value={personalCount} subtitle="Your recorded symptoms" icon={<BookOpenCheck/>}/>
            <Metric title="Years represented" value={years} subtitle="Distinct recorded years" icon={<CalendarDays/>}/>
          </div>
          <div className="two-col">
            <section className="panel chart-panel"><div className="panel-title"><div><h3>Events over time</h3><p>Your medical journey, year by year</p></div><TrendingUp size={19}/></div>
              <div className="chart-wrap">{byYear.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={byYear} margin={{ top: 10, right: 10, bottom: 0, left: -24 }}><CartesianGrid strokeDasharray="3 5" stroke="#eee8f3" vertical={false}/><XAxis dataKey="year" tick={{ fontSize: 11, fill: "#877b94" }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#877b94" }} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:"#f6effb"}}/><Bar name="Events" dataKey="count" fill="#9674b8" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer> : <Empty/>}</div>
            </section>
            <section className="panel chart-panel"><div className="panel-title"><div><h3>Symptom severity</h3><p>Average self-reported severity by month</p></div><Activity size={19}/></div>
              <div className="chart-wrap">{monthly.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 10, right: 12, bottom: 0, left: -24 }}><CartesianGrid strokeDasharray="3 5" stroke="#eee8f3" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#877b94" }} axisLine={false} tickLine={false}/><YAxis domain={[0,10]} tick={{ fontSize: 11, fill: "#877b94" }} axisLine={false} tickLine={false}/><Tooltip/><Legend/><Line name="Avg. severity" dataKey="avgSeverity" stroke="#ad699a" strokeWidth={3} dot={{r:4}} activeDot={{r:6}}/></LineChart></ResponsiveContainer> : <Empty/>}</div>
              <div className="chart-footnote">Monthly averages calculated in Snowflake SQL.</div>
            </section>
          </div>
          <section className="panel history-panel"><div className="panel-title history-header"><div><h3>Care history</h3><p>Trace every event back to its original record</p></div><span className="event-count">{filtered.length} events</span></div>
            <div className="filter-row"><div className="searchbox"><Search size={17}/><input aria-label="Search clinical history" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symptoms, dates or conditions..."/></div><div className="select-wrap"><select aria-label="Filter event types" value={filter} onChange={(e) => setFilter(e.target.value)}>{["All events","Condition","Encounter","Observation","Self-reported"].map((t) => <option key={t}>{t}</option>)}</select><ChevronDown size={14}/></div></div>
            {loading ? <div className="loading-line"><LoaderCircle className="spin"/> Loading Snowflake records...</div> : <div className="history-grid"><div className="event-list">{filtered.length === 0 ? <Empty/> : filtered.map((event) => <button className={`event-item ${selected?.sourceId===event.sourceId && selected?.source===event.source ? "selected" : ""}`} key={`${event.source}:${event.sourceId}`} onClick={() => setSelectedKey(`${event.source}:${event.sourceId}`)}><span className={`event-type-tag ${event.source === "Clinical" ? "tag-clinical" : "tag-self"}`}>{typeLabel(event)}</span><span className="event-copy"><strong>{event.description}</strong><small>{prettyDate(event.date)}</small></span><ArrowRight size={16}/></button>)}</div>
            <div className="evidence-panel">{selected ? <><div className="evidence-icon"><FileCheck2 size={22}/></div><h4>Original record</h4><p>{selected.description}</p><dl><div><dt>Date</dt><dd>{prettyDate(selected.date)}</dd></div><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Source ID</dt><dd>#{selected.sourceId}</dd></div><div><dt>Type</dt><dd>{typeLabel(selected)}</dd></div></dl><div className="verified-pill"><CheckCircle2 size={15}/> Source found in Snowflake</div></> : <Empty/>}</div></div>}
          </section>
        </>}

        {view === "log" && <><PageIntro eyebrow="SYMPTOM JOURNAL" title="Track how you're feeling" description="Add a dated symptom to your personal timeline. CareTrace stores it in Snowflake alongside historical records."/><div className="form-grid"><section className="panel form-panel"><div className="panel-title"><div><h3>New journal entry</h3><p>Use fictional details for this hackathon demo.</p></div><Plus size={20}/></div><form onSubmit={(e) => void saveNote(e)} className="symptom-form"><label>Date of symptom<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label><label>What did you experience?<input value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="e.g. Persistent headache" maxLength={120} required/></label><label>Severity <strong>{severity}/10</strong><input type="range" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))}/><div className="range-labels"><span>Mild</span><span>Severe</span></div></label><label>Context or additional notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={1000} placeholder="How long did it last? Anything you want to remember?"/></label><button type="submit" disabled={formBusy} className="primary-btn">{formBusy ? <LoaderCircle className="spin"/> : <Plus size={18}/>} {formBusy ? "Saving..." : "Save to my timeline"}</button>{formMessage && <div className="form-message">{formMessage}</div>}</form></section><div className="form-side"><section className="tip-panel"><HeartPulse size={25}/><h3>Every detail adds context</h3><p>Recorded symptoms make it easier to notice changes over time and prepare more complete conversations with a clinician.</p></section><section className="panel mini-list"><h3>Recent journal entries</h3>{events.filter((e)=>e.source==="Self-reported").slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map((entry)=><div className="mini-event" key={entry.sourceId}><strong>{entry.description}</strong><small>{prettyDate(entry.date)}</small></div>)}</section></div></div></>}

        {view === "brief" && <><PageIntro eyebrow="AI APPOINTMENT ASSISTANT" title="Feel prepared, not overwhelmed" description="Turn your timeline into an evidence-linked discussion brief using open-weight Llama through Snowflake Cortex."/><div className="brief-layout"><section className="panel brief-panel"><div className="panel-title"><div><h3>Your appointment brief</h3><p>Generated from the latest Snowflake records, including journal entries.</p></div><Sparkles size={21}/></div>{!report ? <div className="brief-empty"><div className="brief-icon"><FileText size={35}/></div><h3>Walk into your next appointment with clarity.</h3><p>CareTrace organizes the history you've recorded into a concise report with traceable source IDs.</p><button className="primary-btn" onClick={() => void makeBrief()} disabled={generating}>{generating ? <LoaderCircle className="spin"/> : <Sparkles size={18}/>} {generating ? "Generating with Llama..." : "Generate my appointment brief"}</button></div> : <><div className="report-actions"><span><CheckCircle2 size={17}/> Brief generated from current records</span><button className="secondary-btn" onClick={() => downloadReport(report.report)}><ArrowDownToLine size={17}/> Download .md</button><button className="secondary-btn" onClick={() => void makeBrief()} disabled={generating}>{generating ? <LoaderCircle className="spin"/> : <RefreshCw size={17}/>} Regenerate</button></div><RenderReport source={report.report}/></>}</section><aside className="evidence-side"><section className="source-card"><ShieldCheck size={23}/><h3>Know where it came from.</h3><p>CareTrace cross-checks each cited record ID against the Snowflake timeline, so you can inspect the underlying data.</p><span>Identity checks do not guarantee medical accuracy.</span></section>{report && <section className="panel refs-panel"><h3>Evidence explorer</h3><p>{report.evidence.filter((e)=>e.valid).length} of {report.evidence.length} referenced IDs found.</p>{report.evidence.length ? report.evidence.map((e) => <div className="ref-row" key={e.reference}><div className={e.valid ? "ref-yes" : "ref-no"}>{e.valid ? <CheckCircle2 size={16}/> : <CircleAlert size={16}/>}</div><div><strong>{e.reference}</strong><small>{e.date}</small><p>{e.description}</p></div></div>) : <p>No recognizable citations were returned. Review the report manually.</p>}</section>}</aside></div></>}
      </div>
      <footer className="footer">CareTrace uses fictional healthcare records for demonstration only. Not a medical device or diagnostic tool.</footer>
    </main>
  </div>;
}

function Metric({ title, value, subtitle, icon }: {title: string; value: number; subtitle: string; icon: React.ReactNode }) {
  return <div className="metric"><div className="metric-top"><span>{title}</span><div className="metric-icon">{icon}</div></div><strong>{value}</strong><small>{subtitle}</small></div>;
}
function Empty() { return <div className="empty">No records available for this view.</div>; }
function PageIntro({ eyebrow, title, description }: {eyebrow:string; title:string; description:string}) {
  return <div className="page-intro"><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
