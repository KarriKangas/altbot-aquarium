"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnalyticsTop } from "./analytics-top";
import { AnalyticsBreakdowns } from "./analytics-breakdowns";
import { FEATURE_STEP } from "./features";
import { LiveSections } from "./live";
import type { BenchmarkData, Connection, Filter, LiveBot, MilestoneSummary, RunSummary } from "./model";
import { CLASSES, LEVELS, RACES, average, formatDuration, groupRuns, matchesFilter, median, runLabel } from "./model";
import { RunTimeline } from "./timeline";
import { SectionTitle, labelStyle, sectionStyle, selectStyle, tdStyle, thStyle } from "./ui";

export default function RunsPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>({ classId: 0, raceId: 0, faction: "all" });
  const [roster, setRoster] = useState<LiveBot[]>([]);
  const [selectedRunStartedAt, setSelectedRunStartedAt] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("altbot-aquarium-connection");
    if (!saved) {
      setLoading(false);
      setError("Connect Aquarium to worldserver first, then come back here.");
      return;
    }
    try {
      setConnection(JSON.parse(saved) as Connection);
    } catch {
      setLoading(false);
      setError("The saved Aquarium connection is invalid. Reconnect from the Aquarium.");
    }
  }, []);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/aquarium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection, mode: "benchmarks" }),
    }).then(async (response) => {
      const payload = await response.json() as { ok: boolean; data?: BenchmarkData; error?: string };
      if (!payload.ok || !payload.data) throw new Error(payload.error || "Benchmark request failed.");
      if (!cancelled) {
        setData(payload.data);
        setError("");
      }
    }).catch((requestError) => {
      if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Benchmark request failed.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [connection]);

  useEffect(() => {
    if (!connection || FEATURE_STEP < 10) return;
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/aquarium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection, mode: "roster" }),
        });
        const payload = await response.json() as { ok: boolean; data?: { bots: LiveBot[] } };
        if (payload.ok && payload.data && !cancelled) setRoster(payload.data.bots);
      } catch {
        /* live garnish can miss a beat */
      }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [connection]);

  const levelups = useMemo(() => {
    const result = new Map<number, Map<number, number>>();
    for (const entry of data?.levelups ?? []) {
      const bot = result.get(entry.guid) ?? new Map<number, number>();
      bot.set(entry.level, entry.seconds);
      result.set(entry.guid, bot);
    }
    return result;
  }, [data]);

  const runs = useMemo(() => groupRuns(data?.bots ?? []), [data]);
  const rows = useMemo<RunSummary[]>(() => runs.map((run) => {
    const bots = run.bots.filter((bot) => matchesFilter(bot, filter));
    const levels = bots.map((bot) => bot.level);
    const milestones = Object.fromEntries(LEVELS.map((level) => {
      const times = bots.flatMap((bot) => {
        const seconds = levelups.get(bot.guid)?.get(level);
        return seconds === undefined ? [] : [seconds];
      });
      return [level, { medianSeconds: median(times), reached: times.length, total: bots.length }];
    })) as Record<number, MilestoneSummary>;
    return { run, bots, averageLevel: average(levels), medianLevel: median(levels), milestones };
  }), [runs, filter, levelups]);

  const selectedRow = useMemo(() => {
    return rows.find((row) => row.run.startedAt === selectedRunStartedAt) ?? rows[0] ?? null;
  }, [rows, selectedRunStartedAt]);

  return <main style={{ minHeight: "100vh", background: "#081215", color: "#dbe9e6", padding: "32px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", marginBottom: 28 }}>
        <div>
          <div style={{ color: "#7ea89f", fontSize: 12, fontWeight: 800, letterSpacing: ".14em" }}>STRICT ALTBOT BENCHMARKS</div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 34 }}>Runs</h1>
          <p style={{ margin: 0, color: "#8fa6a1" }}>A 30 minute quiet gap starts a new pile of fresh idiots.</p>
        </div>
        <Link href="/" style={{ color: "#bfe0d8", textDecoration: "none", border: "1px solid #29423e", borderRadius: 999, padding: "9px 13px" }}>← Aquarium</Link>
      </header>

      {runs.length > 0 && <section style={{ ...sectionStyle, marginBottom: 18, display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <label style={{ ...labelStyle, minWidth: 320 }}>Cohort
          <select value={selectedRow?.run.startedAt ?? runs[0].startedAt} onChange={(event) => setSelectedRunStartedAt(Number(event.target.value))} style={{ ...selectStyle, minWidth: 320 }}>
            {runs.map((run, index) => <option key={run.startedAt} value={run.startedAt}>{index === 0 ? "Newest · " : ""}{runLabel(run.startedAt)} · {run.bots.length} bots</option>)}
          </select>
        </label>
        <span style={{ color: "#6f8e88", fontSize: 12 }}>Pick the pile the dashboard should stare at.</span>
      </section>}

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16, background: "#0d1b1e", border: "1px solid #1d3432", borderRadius: 14, marginBottom: 18 }}>
        <label style={labelStyle}>Faction<select value={filter.faction} onChange={(event) => setFilter({ ...filter, faction: event.target.value as Filter["faction"] })} style={selectStyle}><option value="all">All</option><option value="alliance">Alliance</option><option value="horde">Horde</option></select></label>
        <label style={labelStyle}>Class<select value={filter.classId} onChange={(event) => setFilter({ ...filter, classId: Number(event.target.value) })} style={selectStyle}><option value={0}>All</option>{Object.entries(CLASSES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label style={labelStyle}>Race<select value={filter.raceId} onChange={(event) => setFilter({ ...filter, raceId: Number(event.target.value) })} style={selectStyle}><option value={0}>All</option>{Object.entries(RACES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </section>

      {error && <div style={{ padding: 16, border: "1px solid #6f4038", background: "#271714", borderRadius: 12, marginBottom: 18 }}>{error}</div>}
      {loading && <div style={{ color: "#8fa6a1", padding: 20 }}>Fishing old bots out of the database…</div>}

      {!loading && data && <>
        <AnalyticsTop rows={rows} selected={selectedRow} levelups={levelups} />
        <AnalyticsBreakdowns selected={selectedRow} levelups={levelups} />
        <LiveSections roster={roster} />
        <section style={{ ...sectionStyle, padding: 0, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ padding: "18px 18px 0" }}><SectionTitle eyebrow="OLD PILES" title="Run history" note="The original useful little table." /></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
              <thead><tr>{["Run", "Bots", "Avg lvl", "Median", ...LEVELS.map((level) => `Lv ${level}`)].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>{rows.map(({ run, bots, averageLevel, medianLevel, milestones }) => <tr key={run.startedAt} style={{ borderTop: "1px solid #18302d" }}><td style={tdStyle}><strong>{new Date(run.startedAt * 1000).toLocaleString()}</strong><div style={{ color: "#6f8e88", fontSize: 12 }}>{run.bots.length} total in cohort</div></td><td style={tdStyle}>{bots.length}</td><td style={tdStyle}>{averageLevel?.toFixed(1) ?? "—"}</td><td style={tdStyle}>{medianLevel?.toFixed(1) ?? "—"}</td>{LEVELS.map((level) => <td key={level} style={tdStyle}>{formatDuration(milestones[level]?.medianSeconds ?? null)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
        <RunTimeline rows={rows} />
      </>}
    </div>
  </main>;
}
