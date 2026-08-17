import type { BenchmarkBot, GroupStat, RunSummary } from "./model";
import { CLASSES, RACES, formatDuration, lastKnownSeconds, levelAt, median, medianTimeToLevel, runLabel } from "./model";

export function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 16, flexWrap: "wrap" }}><div><div style={{ color: "#7ea89f", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>{eyebrow}</div><h2 style={{ margin: "5px 0 0", fontSize: 20 }}>{title}</h2></div><span style={{ color: "#6f8e88", fontSize: 12 }}>{note}</span></div>; }
export function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div style={metricStyle}><span style={{ color: "#7ea89f", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span><strong style={{ fontSize: 27 }}>{value}</strong><small style={{ color: "#6f8e88" }}>{detail}</small></div>; }
export function CompactStatsTable({ rows }: { rows: GroupStat[] }) { return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}><thead><tr>{["Group", "Bots", "Avg", "Median", "Avg quests", "Lv10"].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label} style={{ borderTop: "1px solid #18302d" }}><td style={tdStyle}><strong>{row.label}</strong></td><td style={tdStyle}>{row.bots.length}</td><td style={tdStyle}>{row.averageLevel?.toFixed(1) ?? "—"}</td><td style={tdStyle}>{row.medianLevel?.toFixed(1) ?? "—"}</td><td style={tdStyle}>{row.averageQuestsCompleted?.toFixed(1) ?? "—"}</td><td style={tdStyle}>{formatDuration(row.level10)}</td></tr>)}</tbody></table></div>; }
export function Leaderboard({ title, bots, levelups }: { title: string; bots: BenchmarkBot[]; levelups: Map<number, Map<number, number>> }) { return <div style={subPanelStyle}><h3 style={{ ...smallHeadingStyle, marginTop: 0 }}>{title}</h3>{bots.map((bot, index) => <div key={bot.guid} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8, alignItems: "center", padding: "8px 0", borderTop: index ? "1px solid #17302d" : "none" }}><span style={{ color: "#6f8e88" }}>{index + 1}</span><div><strong>{bot.name}</strong><div style={{ color: "#6f8e88", fontSize: 12 }}>{RACES[bot.raceId] ?? "Unknown"} {CLASSES[bot.classId] ?? "Unknown"}</div></div><div style={{ textAlign: "right" }}><strong>Lv {bot.level}</strong><div style={{ color: "#6f8e88", fontSize: 12 }}>{formatDuration((levelups.get(bot.guid)?.size ?? 0) > 0 ? lastKnownSeconds(bot, levelups) : null)}</div></div></div>)}</div>; }
type LevelTimePoint = { level: number; seconds: number | null };

function levelTimePoints(row: RunSummary, maxLevel: number, levelups: Map<number, Map<number, number>>): LevelTimePoint[] {
  return Array.from({ length: maxLevel }, (_, index) => {
    const level = index + 1;
    return { level, seconds: medianTimeToLevel(row.bots, level, levelups) };
  });
}

function niceTimeStep(maxSeconds: number): number {
  const steps = [300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];
  return steps.find((step) => maxSeconds / step <= 6) ?? steps.at(-1)!;
}

function pathFor(points: LevelTimePoint[], x: (level: number) => number, y: (seconds: number) => number): string {
  let path = "";
  let connected = false;
  for (const point of points) {
    if (point.seconds === null) {
      connected = false;
      continue;
    }
    path += `${connected ? "L" : "M"}${x(point.level)},${y(point.seconds)} `;
    connected = true;
  }
  return path.trim();
}

export function LevelTimeComparisonChart({ left, right, levelups }: { left: RunSummary; right: RunSummary; levelups: Map<number, Map<number, number>> }) {
  const rows = [left, right];
  const maxLevel = Math.max(1, ...rows.flatMap((row) => [
    ...row.bots.map((bot) => bot.level),
    ...row.bots.flatMap((bot) => [...(levelups.get(bot.guid)?.keys() ?? [])]),
  ]));
  const hasLevelupHistory = rows.some((row) => row.bots.some((bot) => (levelups.get(bot.guid)?.size ?? 0) > 0));
  if (!hasLevelupHistory) return <div style={emptyStyle}>No level-up history recorded for these runs.</div>;

  const series = rows.map((row) => ({ label: runLabel(row.run.startedAt), points: levelTimePoints(row, maxLevel, levelups) }));
  const maxSeconds = Math.max(0, ...series.flatMap((item) => item.points.flatMap((point) => point.seconds === null ? [] : [point.seconds])));
  const step = niceTimeStep(Math.max(300, maxSeconds));
  const yMax = Math.max(step, Math.ceil(maxSeconds / step) * step);
  const yTicks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, index) => index * step);
  const xStep = maxLevel > 24 ? Math.ceil(maxLevel / 12) : 1;
  const xTicks = Array.from({ length: Math.ceil(maxLevel / xStep) }, (_, index) => index * xStep + 1).filter((level) => level <= maxLevel);
  if (xTicks.at(-1) !== maxLevel) xTicks.push(maxLevel);
  const width = 920;
  const height = 350;
  const leftMargin = 72;
  const rightMargin = 24;
  const topMargin = 24;
  const bottomMargin = 56;
  const x = (level: number) => leftMargin + ((level - 1) / Math.max(1, maxLevel - 1)) * (width - leftMargin - rightMargin);
  const y = (seconds: number) => topMargin + (1 - seconds / yMax) * (height - topMargin - bottomMargin);
  const colors = ["#9acfc2", "#b8a86b"];

  return <div>
    <h3 style={{ ...smallHeadingStyle, marginTop: 0 }}>Median time to reach each level</h3>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Run versus run cumulative median time to reach each level" style={{ width: "100%", minHeight: 280 }}>
      <title>Median time to reach each level</title>
      <desc>Two selected runs compared by cumulative median seconds from run start to each level.</desc>
      <rect x={leftMargin} y={topMargin} width={width - leftMargin - rightMargin} height={height - topMargin - bottomMargin} fill="none" stroke="#17302d" />
      {yTicks.map((tick) => <g key={tick}><line x1={leftMargin} y1={y(tick)} x2={width - rightMargin} y2={y(tick)} stroke="#17302d" /><text x={leftMargin - 10} y={y(tick) + 4} fill="#6f8e88" textAnchor="end" fontSize="12">{formatDuration(tick)}</text></g>)}
      {xTicks.map((level) => <g key={level}><line x1={x(level)} y1={topMargin} x2={x(level)} y2={height - bottomMargin} stroke="#17302d" /><text x={x(level)} y={height - bottomMargin + 22} fill="#6f8e88" textAnchor="middle" fontSize="12">{level}</text></g>)}
      <text x={(leftMargin + width - rightMargin) / 2} y={height - 10} fill="#8fa6a1" textAnchor="middle" fontSize="12">Level</text>
      <text x="16" y={(topMargin + height - bottomMargin) / 2} fill="#8fa6a1" textAnchor="middle" fontSize="12" transform={`rotate(-90 16 ${(topMargin + height - bottomMargin) / 2})`}>Cumulative median time</text>
      {series.map((item, index) => <g key={item.label}>
        <path d={pathFor(item.points, x, y)} fill="none" stroke={colors[index]} strokeWidth="3" strokeDasharray={index ? "8 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
        {item.points.filter((point) => point.seconds !== null).map((point) => <circle key={point.level} cx={x(point.level)} cy={y(point.seconds!)} r="4" fill={colors[index]}><title>{`${item.label} · Level ${point.level}: ${formatDuration(point.seconds)}`}</title></circle>)}
      </g>)}
    </svg>
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>{series.map((item, index) => <span key={item.label} style={{ color: colors[index], fontSize: 12, fontWeight: 800 }}>● {index ? "Run B" : "Run A"} · {item.label}</span>)}</div>
  </div>;
}

export function ProgressionChart({ rows, levelups }: { rows: RunSummary[]; levelups: Map<number, Map<number, number>> }) { const chartRows = rows.filter((row) => row.bots.length).slice(0, 3).reverse(); if (!chartRows.length) return <div style={emptyStyle}>No leveling trails yet.</div>; const allSeconds = chartRows.flatMap((row) => row.bots.flatMap((bot) => [...(levelups.get(bot.guid)?.values() ?? [])])); const maxHour = Math.max(1, Math.min(24, Math.ceil(Math.max(3600, ...allSeconds) / 3600))); const hours = Array.from({ length: maxHour + 1 }, (_, i) => i); const series = chartRows.map((row) => ({ label: runLabel(row.run.startedAt), points: hours.map((hour) => median(row.bots.map((bot) => levelAt(bot.guid, hour * 3600, levelups))) ?? 1) })); const maxLevel = Math.max(2, ...series.flatMap((item) => item.points)); const width = 900, height = 270, left = 44, right = 18, top = 20, bottom = 34; const x = (hour: number) => left + (hour / maxHour) * (width - left - right); const y = (level: number) => top + (1 - (level - 1) / Math.max(1, maxLevel - 1)) * (height - top - bottom); const colors = ["#6f8e88", "#b8a86b", "#9acfc2"]; return <div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Median level over played hours" style={{ width: "100%", minHeight: 240 }}>{hours.map((hour) => <g key={hour}><line x1={x(hour)} y1={top} x2={x(hour)} y2={height - bottom} stroke="#17302d" /><text x={x(hour)} y={height - 10} fill="#6f8e88" textAnchor="middle" fontSize="12">{hour}h</text></g>)}{[1, Math.ceil(maxLevel / 2), maxLevel].filter((v, i, a) => a.indexOf(v) === i).map((level) => <g key={level}><line x1={left} y1={y(level)} x2={width - right} y2={y(level)} stroke="#17302d" /><text x={left - 10} y={y(level) + 4} fill="#6f8e88" textAnchor="end" fontSize="12">Lv {level}</text></g>)}{series.map((item, index) => <polyline key={item.label} fill="none" stroke={colors[index]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={item.points.map((level, hour) => `${x(hour)},${y(level)}`).join(" ")} />)}</svg><div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{series.map((item, index) => <span key={item.label} style={{ color: colors[index], fontSize: 12, fontWeight: 800 }}>● {item.label}</span>)}</div></div>; }

export const sectionStyle = { padding: 18, background: "#0d1b1e", border: "1px solid #1d3432", borderRadius: 14 };
export const subPanelStyle = { padding: 14, background: "#0a1719", border: "1px solid #17302d", borderRadius: 10 };
export const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
export const metricStyle = { display: "grid", gap: 5, padding: 14, background: "#0a1719", border: "1px solid #17302d", borderRadius: 10 };
export const selectStyle = { background: "#081215", color: "#dbe9e6", border: "1px solid #29423e", borderRadius: 8, padding: "8px 10px", minWidth: 150 };
export const labelStyle = { display: "grid", gap: 5, fontSize: 12, color: "#8fa6a1" };
export const thStyle = { textAlign: "left" as const, padding: "13px 16px", color: "#7ea89f", fontSize: 12, letterSpacing: ".06em", fontWeight: 800, whiteSpace: "nowrap" as const };
export const tdStyle = { padding: "15px 16px", whiteSpace: "nowrap" as const };
export const smallHeadingStyle = { color: "#bfe0d8", fontSize: 14, margin: "0 0 10px" };
export const emptyStyle = { color: "#6f8e88", padding: "10px 0" };
export const barTrackStyle = { height: 10, background: "#081215", border: "1px solid #17302d", borderRadius: 999, overflow: "hidden" as const };
export const barFillStyle = { display: "block", height: "100%", background: "#7ea89f", borderRadius: 999 };
