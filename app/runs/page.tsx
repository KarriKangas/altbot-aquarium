"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Connection = { url: string; user: string; password: string };
type BenchmarkBot = {
  guid: number;
  name: string;
  raceId: number;
  classId: number;
  level: number;
  firstLoginAt: number;
  retiredAt: number;
};
type Levelup = { guid: number; level: number; seconds: number };
type BenchmarkData = { version: number; bots: BenchmarkBot[]; levelups: Levelup[] };
type Run = { startedAt: number; bots: BenchmarkBot[] };

type Filter = { classId: number; raceId: number; faction: "all" | "alliance" | "horde" };

const RUN_GAP_SECONDS = 30 * 60;
const LEVELS = [5, 10, 15, 20];
const CLASSES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
  7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};
const RACES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei",
};
const ALLIANCE = new Set([1, 3, 4, 7, 11]);
const HORDE = new Set([2, 5, 6, 8, 10]);

function factionForRace(raceId: number): "alliance" | "horde" | "unknown" {
  if (ALLIANCE.has(raceId)) return "alliance";
  if (HORDE.has(raceId)) return "horde";
  return "unknown";
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  return hours ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes}m`;
}

function runLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function groupRuns(bots: BenchmarkBot[]): Run[] {
  const sorted = [...bots].sort((a, b) => a.firstLoginAt - b.firstLoginAt || a.guid - b.guid);
  const runs: Run[] = [];
  for (const bot of sorted) {
    const current = runs.at(-1);
    if (!current || bot.firstLoginAt - current.startedAt > RUN_GAP_SECONDS) {
      runs.push({ startedAt: bot.firstLoginAt, bots: [bot] });
    } else {
      current.bots.push(bot);
    }
  }
  return runs.reverse();
}

function matchesFilter(bot: BenchmarkBot, filter: Filter): boolean {
  if (filter.classId && bot.classId !== filter.classId) return false;
  if (filter.raceId && bot.raceId !== filter.raceId) return false;
  if (filter.faction !== "all" && factionForRace(bot.raceId) !== filter.faction) return false;
  return true;
}

export default function RunsPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>({ classId: 0, raceId: 0, faction: "all" });

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
    })
      .then(async (response) => {
        const payload = await response.json() as { ok: boolean; data?: BenchmarkData; error?: string };
        if (!payload.ok || !payload.data) throw new Error(payload.error || "Benchmark request failed.");
        if (!cancelled) {
          setData(payload.data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Benchmark request failed.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connection]);

  const levelupsByGuid = useMemo(() => {
    const result = new Map<number, Map<number, number>>();
    for (const levelup of data?.levelups ?? []) {
      const bot = result.get(levelup.guid) ?? new Map<number, number>();
      bot.set(levelup.level, levelup.seconds);
      result.set(levelup.guid, bot);
    }
    return result;
  }, [data]);

  const runs = useMemo(() => groupRuns(data?.bots ?? []), [data]);
  const rows = useMemo(() => runs.map((run) => {
    const bots = run.bots.filter((bot) => matchesFilter(bot, filter));
    const levels = bots.map((bot) => bot.level);
    const milestones = Object.fromEntries(LEVELS.map((level) => [
      level,
      median(bots.flatMap((bot) => {
        const seconds = levelupsByGuid.get(bot.guid)?.get(level);
        return seconds === undefined ? [] : [seconds];
      })),
    ]));
    return {
      run,
      bots,
      averageLevel: bots.length ? levels.reduce((sum, level) => sum + level, 0) / bots.length : null,
      medianLevel: median(levels),
      milestones,
    };
  }), [runs, filter, levelupsByGuid]);

  return (
    <main style={{ minHeight: "100vh", background: "#081215", color: "#dbe9e6", padding: "32px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", marginBottom: 28 }}>
          <div>
            <div style={{ color: "#7ea89f", fontSize: 12, fontWeight: 800, letterSpacing: ".14em" }}>STRICT ALTBOT BENCHMARKS</div>
            <h1 style={{ margin: "6px 0 4px", fontSize: 34 }}>Runs</h1>
            <p style={{ margin: 0, color: "#8fa6a1" }}>Cohorts are inferred from first-login timestamps. A gap over 30 minutes starts a new run.</p>
          </div>
          <Link href="/" style={{ color: "#bfe0d8", textDecoration: "none", border: "1px solid #29423e", borderRadius: 999, padding: "9px 13px" }}>← Aquarium</Link>
        </header>

        <section style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16, background: "#0d1b1e", border: "1px solid #1d3432", borderRadius: 14, marginBottom: 18 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#8fa6a1" }}>Faction
            <select value={filter.faction} onChange={(event) => setFilter({ ...filter, faction: event.target.value as Filter["faction"] })} style={selectStyle}>
              <option value="all">All</option><option value="alliance">Alliance</option><option value="horde">Horde</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#8fa6a1" }}>Class
            <select value={filter.classId} onChange={(event) => setFilter({ ...filter, classId: Number(event.target.value) })} style={selectStyle}>
              <option value={0}>All</option>{Object.entries(CLASSES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#8fa6a1" }}>Race
            <select value={filter.raceId} onChange={(event) => setFilter({ ...filter, raceId: Number(event.target.value) })} style={selectStyle}>
              <option value={0}>All</option>{Object.entries(RACES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </section>

        {error && <div style={{ padding: 16, border: "1px solid #6f4038", background: "#271714", borderRadius: 12, marginBottom: 18 }}>{error}</div>}
        {loading && <div style={{ color: "#8fa6a1", padding: 20 }}>Fishing old bots out of the database…</div>}

        {!loading && data && (
          <div style={{ overflowX: "auto", border: "1px solid #1d3432", borderRadius: 14, background: "#0d1b1e" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
              <thead>
                <tr>{["Run", "Bots", "Avg lvl", "Median", ...LEVELS.map((level) => `Lv ${level}`)].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ run, bots, averageLevel, medianLevel, milestones }) => (
                  <tr key={run.startedAt} style={{ borderTop: "1px solid #18302d" }}>
                    <td style={tdStyle}><strong>{runLabel(run.startedAt)}</strong><div style={{ color: "#6f8e88", fontSize: 12 }}>{run.bots.length} total in cohort</div></td>
                    <td style={tdStyle}>{bots.length}</td>
                    <td style={tdStyle}>{averageLevel === null ? "—" : averageLevel.toFixed(1)}</td>
                    <td style={tdStyle}>{medianLevel === null ? "—" : medianLevel.toFixed(1)}</td>
                    {LEVELS.map((level) => <td key={level} style={tdStyle}>{formatDuration(milestones[level] ?? null)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div style={{ padding: 24, color: "#8fa6a1" }}>No benchmark cohorts yet.</div>}
          </div>
        )}
      </div>
    </main>
  );
}

const selectStyle = { background: "#081215", color: "#dbe9e6", border: "1px solid #29423e", borderRadius: 8, padding: "8px 10px", minWidth: 150 };
const thStyle = { textAlign: "left" as const, padding: "13px 16px", color: "#7ea89f", fontSize: 12, letterSpacing: ".06em", fontWeight: 800 };
const tdStyle = { padding: "15px 16px", whiteSpace: "nowrap" as const };
