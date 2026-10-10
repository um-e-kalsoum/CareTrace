"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, CheckCircle2, ChevronDown, CircleAlert, ClipboardList,
  FileText, HeartPulse, LoaderCircle, NotebookPen, Plus, RefreshCw, Search, ShieldCheck,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
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
function typeSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z]+/g, "-");
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
  const yearSpan = events.length ? Number(events[events.length - 1].date.slice(0, 4)) - Number(events[0].date.slice(0, 4)) : 0;
  const selectFromRibbon = (key: string) => {
    setFilter("All events"); setQuery(""); setSelectedKey(key);
    document.getElementById("care-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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

  const nav: { id: View; title: string; icon: typeof Activity }[] = [
    { id: "overview", title: "My care timeline", icon: Activity },
    { id: "log", title: "Symptom journal", icon: Plus },
    { id: "brief", title: "Appointment brief", icon: ClipboardList },
  ];

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><HeartPulse size={20}/></div><strong>CareTrace</strong></div>
      <nav className="side-nav" aria-label="Main menu">{nav.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} onClick={() => setView(item.id)} className={`nav-item ${view === item.id ? "active" : ""}`} aria-current={view === item.id ? "page" : undefined}>
          <Icon size={18}/><span>{item.title}</span>
        </button>;
      })}</nav>
      <div className="sidebar-bottom">
        <div className="patient-mini"><div className="avatar">ED</div><div><strong>Eden Dach</strong><span>Synthetic patient</span></div></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">My health space <span>/</span> <strong>{view === "overview" ? "Overview" : view === "log" ? "Journal" : "Appointment brief"}</strong></div><div className="top-actions"><button className="refresh-btn" onClick={() => void reload()} title="Refresh data" aria-label="Refresh data"><RefreshCw size={16}/></button></div></header>
      <div className="page-wrap">
        {error && <div className="error-box"><CircleAlert size={20}/><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {view === "overview" && <>
          <section className="ribbon">
            <div className="ribbon-head">
              <div><h1>Because every symptom is part of a bigger picture.</h1><p>Eden Dach · born Mar 28, 1981{events.length ? ` · ${yearSpan} years of records` : ""}</p></div>
              <dl className="ribbon-nums"><div><dd>{events.length || "–"}</dd><dt>Records</dt></div><div><dd>{events.length ? clinicalCount : "–"}</dd><dt>Clinical</dt></div><div><dd>{events.length ? personalCount : "–"}</dd><dt>Journal</dt></div></dl>
            </div>
            {events.length ? <CareRibbon events={events} selectedKey={selected ? `${selected.source}:${selected.sourceId}` : ""} onSelect={selectFromRibbon}/> : <div className="loading-line">{loading ? <><LoaderCircle className="spin"/> Loading your records...</> : "No records yet."}</div>}
            <div className="ribbon-legend">{(["Condition", "Encounter", "Observation", "Self-reported"] as const).map((t) => <span key={t}><i className={`dot-${typeSlug(t)}`}/>{t === "Self-reported" ? "Your journal entry" : t}</span>)}<span className="ribbon-hint">Select a dot to open the record</span></div>
          </section>
          <div className="two-col">
            <section className="panel chart-panel"><div className="panel-title"><div><h3>Events over time</h3><p>Records per year</p></div></div>
              <div className="chart-wrap">{byYear.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={byYear} margin={{ top: 10, right: 10, bottom: 0, left: -24 }}><CartesianGrid strokeDasharray="3 5" stroke="#ece4f1" vertical={false}/><XAxis dataKey="year" tick={{ fontSize: 12, fill: "#847891" }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#847891" }} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:"#f4edf9"}}/><Bar name="Records" dataKey="count" fill="#8b62ad" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer> : <Empty/>}</div>
            </section>
            <section className="panel chart-panel"><div className="panel-title"><div><h3>Symptom severity</h3><p>Average self-reported severity by month</p></div></div>
              <div className="chart-wrap">{monthly.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 10, right: 12, bottom: 4, left: -24 }}><CartesianGrid strokeDasharray="3 5" stroke="#ece4f1" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 12, fill: "#847891" }} axisLine={false} tickLine={false} tickMargin={12} padding={{ left: 16, right: 16 }}/><YAxis domain={[0,10]} tick={{ fontSize: 12, fill: "#847891" }} axisLine={false} tickLine={false}/><Tooltip/><Line name="Avg. severity" dataKey="avgSeverity" stroke="#c2457f" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", strokeWidth: 2.5 }} activeDot={{r:6}}/></LineChart></ResponsiveContainer> : <Empty/>}</div>
            </section>
          </div>
          <section className="panel history-panel" id="care-history"><div className="panel-title history-header"><div><h3>Care history</h3><p>Trace every event back to its original record</p></div><span className="event-count">{filtered.length} events</span></div>
            <div className="filter-row"><div className="searchbox"><Search size={17}/><input aria-label="Search clinical history" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symptoms, dates or conditions..."/></div><div className="select-wrap"><select aria-label="Filter event types" value={filter} onChange={(e) => setFilter(e.target.value)}>{["All events","Condition","Encounter","Observation","Self-reported"].map((t) => <option key={t}>{t}</option>)}</select><ChevronDown size={14}/></div></div>
            {loading ? <div className="loading-line"><LoaderCircle className="spin"/> Loading Snowflake records...</div> : <div className="history-grid"><div className="event-list">{filtered.length === 0 ? <Empty/> : filtered.map((event) => <button className={`event-item ${selected?.sourceId===event.sourceId && selected?.source===event.source ? "selected" : ""}`} key={`${event.source}:${event.sourceId}`} onClick={() => setSelectedKey(`${event.source}:${event.sourceId}`)}><span className={`event-type-tag tag-${typeSlug(typeLabel(event))}`}>{typeLabel(event)}</span><span className="event-copy"><strong>{event.description}</strong><small>{prettyDate(event.date)}</small></span></button>)}</div>
            <div className={`evidence-panel ${selected ? `type-${typeSlug(typeLabel(selected))}` : ""}`}>{selected ? <><div className="evidence-band"><h4>Original record</h4><span>{typeLabel(selected)}</span></div><div className="evidence-body"><p>{selected.description}</p><dl><div><dt>Date</dt><dd>{prettyDate(selected.date)}</dd></div><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Source ID</dt><dd>#{selected.sourceId}</dd></div><div><dt>Type</dt><dd>{typeLabel(selected)}</dd></div></dl></div></> : <Empty/>}</div></div>}
          </section>
        </>}

        {view === "log" && <><PageIntro eyebrow="SYMPTOM JOURNAL" title="Track how you're feeling" description="Small details can reveal a bigger picture. Track your symptoms over time and connect the dots in your health journey."/><div className="form-grid"><section className="panel form-panel"><div className="panel-title"><div><h3>Add a new journal entry</h3></div><Plus size={20}/></div><form onSubmit={(e) => void saveNote(e)} className="symptom-form"><label>Date of symptom<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label><label>What did you experience?<input value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="e.g. Persistent headache" maxLength={120} required/></label><label>Severity <strong>{severity}/10</strong><input type="range" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))}/><div className="range-labels"><span>Mild</span><span>Severe</span></div></label><label>Context or additional notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={1000} placeholder="How long did it last? Anything you want to remember?"/></label><button type="submit" disabled={formBusy} className="primary-btn">{formBusy ? <LoaderCircle className="spin"/> : <Plus size={18}/>} {formBusy ? "Saving..." : "Save to my timeline"}</button>{formMessage && <div className="form-message">{formMessage}</div>}</form></section><div className="form-side"><section className="tip-panel"><HeartPulse size={25}/><h3>Every detail adds context</h3><p>Recorded symptoms make it easier to notice changes over time and prepare more complete conversations with a clinician.</p></section><section className="panel mini-list"><h3>Recent journal entries</h3>{events.filter((e)=>e.source==="Self-reported").slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map((entry)=><div className="mini-event" key={entry.sourceId}><strong>{entry.description}</strong><small>{prettyDate(entry.date)}</small></div>)}</section></div></div></>}

        {view === "brief" && <><PageIntro eyebrow="AI APPOINTMENT ASSISTANT" title="Feel prepared, not overwhelmed" description="Because remembering every detail shouldn't be the hardest part of getting the care you deserve"/><div className="brief-layout"><section className="panel brief-panel"><div className="panel-title"><div><h3>Your appointment brief</h3><p></p></div><NotebookPen size={21}/></div>{!report ? <div className="brief-empty"><div className="brief-icon"><FileText size={35}/></div><h3>Walk into your next appointment with clarity.</h3><p>CareTrace organizes the history you've recorded into a concise report.</p><button className="primary-btn" onClick={() => void makeBrief()} disabled={generating}>{generating ? <LoaderCircle className="spin"/> : <NotebookPen size={18}/>} {generating ? "Generating with Llama..." : "Generate my appointment brief"}</button></div> : <><div className="report-actions"><span><CheckCircle2 size={17}/> Brief generated from current records</span><button className="secondary-btn" onClick={() => downloadReport(report.report)}><ArrowDownToLine size={17}/> Download .md</button><button className="secondary-btn" onClick={() => void makeBrief()} disabled={generating}>{generating ? <LoaderCircle className="spin"/> : <RefreshCw size={17}/>} Regenerate</button></div><RenderReport source={report.report}/></>}</section><aside className="evidence-side"><section className="source-card"><ShieldCheck size={23}/><h3>Know where it came from.</h3><p>CareTrace uses AI to analyze your medical history and symptom journal, generating a personalized appointment summary. Each cited record is cross-checked against your health timeline, allowing you to trace important details back to their original source. </p><span>AI-generated summaries may contain errors and should be reviewed for accuracy.</span></section>{report && <section className="panel refs-panel"><h3>Evidence explorer</h3><p>{report.evidence.filter((e)=>e.valid).length} of {report.evidence.length} referenced IDs found.</p>{report.evidence.length ? report.evidence.map((e) => <div className="ref-row" key={e.reference}><div className={e.valid ? "ref-yes" : "ref-no"}>{e.valid ? <CheckCircle2 size={16}/> : <CircleAlert size={16}/>}</div><div><strong>{e.reference}</strong><small>{e.date}</small><p>{e.description}</p></div></div>) : <p>No recognizable citations were returned. Review the report manually.</p>}</section>}</aside></div></>}
      </div>
      <footer className="footer">CareTrace uses fictional healthcare records for demonstration only. Not a medical device or diagnostic tool.</footer>
    </main>
  </div>;
}

// The whole history on one true-to-scale line: clinical records on the line, journal entries just above it.
function CareRibbon({ events, selectedKey, onSelect }: { events: EventRow[]; selectedKey: string; onSelect: (key: string) => void }) {
  const W = 900, PAD = 30, LINE = 70;
  const firstYear = Number(events[0].date.slice(0, 4));
  const lastYear = Number(events[events.length - 1].date.slice(0, 4));
  const t0 = Date.UTC(firstYear, 0, 1), t1 = Date.UTC(lastYear + 1, 0, 1);
  const x = (date: string) => PAD + ((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - t0) / (t1 - t0)) * (W - 2 * PAD);
  const span = lastYear - firstYear;
  const step = span > 12 ? 5 : span > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = firstYear; y <= lastYear; y += step) ticks.push(y);
  if (ticks[ticks.length - 1] !== lastYear) ticks.push(lastYear);

  // Label conditions and emergency visits, alternating above/below and skipping any that would overlap.
  const lastEnd = { above: -Infinity, below: -Infinity };
  let prefer: "above" | "below" = "above";
  const labels = events
    .filter((e) => e.source === "Clinical" && (e.eventType === "CONDITION" || /emergency/i.test(e.eventType)))
    .flatMap((e) => {
      const text = e.description.replace(/\s*\([^)]*\)\s*$/, "").replace(/^Past pregnancy history of /, "History of ");
      const cx = x(e.date), w = text.length * 6.4;
      const anchor: "start" | "middle" | "end" = cx - w / 2 < 4 ? "start" : cx + w / 2 > W - 4 ? "end" : "middle";
      const left = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
      const side = ([prefer, prefer === "above" ? "below" : "above"] as const).find((s) => left > lastEnd[s] + 12);
      if (!side) return [];
      lastEnd[side] = left + w;
      prefer = side === "above" ? "below" : "above";
      return [{ key: `${e.source}:${e.sourceId}`, cx, text, anchor, side }];
    });

  return <div className="ribbon-scroll"><svg className="ribbon-svg" viewBox={`0 0 ${W} 140`} role="img" aria-label={`Care timeline from ${firstYear} to ${lastYear} with ${events.length} records`}>
    <line x1={PAD} y1={LINE} x2={W - PAD} y2={LINE} className="ribbon-track"/>
    {labels.map((l) => <g key={`label-${l.key}`}>
      <line x1={l.cx} x2={l.cx} y1={l.side === "above" ? LINE - 8 : LINE + 8} y2={l.side === "above" ? 40 : 98} className="ribbon-stem"/>
      <text x={l.cx} y={l.side === "above" ? 34 : 112} textAnchor={l.anchor} className="ribbon-label">{l.text}</text>
    </g>)}
    {events.map((e) => {
      const key = `${e.source}:${e.sourceId}`;
      const self = e.source === "Self-reported";
      return <circle key={key} cx={x(e.date)} cy={self ? LINE - 14 : LINE} r={self ? 5 : 5.5}
        className={`ribbon-dot dot-${typeSlug(typeLabel(e))} ${key === selectedKey ? "is-selected" : ""}`}
        role="button" tabIndex={0} aria-label={`${prettyDate(e.date)}: ${e.description}`}
        onClick={() => onSelect(key)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(key); } }}>
        <title>{`${prettyDate(e.date)} · ${e.description}`}</title>
      </circle>;
    })}
    {ticks.map((y) => <text key={y} x={x(`${y}-01-01`)} y={134} textAnchor={y === firstYear ? "start" : "middle"} className="ribbon-year">{y}</text>)}
  </svg></div>;
}
function Empty() { return <div className="empty">No records available for this view.</div>; }
function PageIntro({ eyebrow, title, description }: {eyebrow:string; title:string; description:string}) {
  return <div className="page-intro"><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
