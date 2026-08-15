"use client";

import { useState } from "react";
import { FEATURE_STEP } from "./features";
import type { RunSummary } from "./model";
import { LEVELS, formatDuration, formatSignedDuration, runLabel, signed } from "./model";
import {
  Metric,
  ProgressionChart,
  SectionTitle,
  emptyStyle,
  labelStyle,
  metricGridStyle,
  sectionStyle,
  selectStyle,
} from "./ui";

export function AnalyticsTop({
  rows,
  selected,
  levelups,
}: {
  rows: RunSummary[];
  selected: RunSummary | null;
  levelups: Map<number, Map<number, number>>;
}) {
  const visible = rows.filter((row) => row.bots.length);
  const latest = selected;
  const selectedIndex = latest
    ? visible.findIndex((row) => row.run.startedAt === latest.run.startedAt)
    : -1;
  const previous = selectedIndex >= 0 ? visible[selectedIndex + 1] ?? null : null;
  const bestMedian = visible.length
    ? Math.max(...visible.map((row) => row.medianLevel ?? 0))
    : null;
  const hasLevelupHistory = !!latest && latest.bots.some(
    (bot) => (levelups.get(bot.guid)?.size ?? 0) > 0,
  );
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);

  return <>
    {FEATURE_STEP >= 1 && latest && <section style={{ ...sectionStyle, marginBottom: 18 }}>
      <SectionTitle eyebrow="SELECTED COHORT" title={runLabel(latest.run.startedAt)} note={`${latest.bots.length} bots after filters`} />
      <div style={metricGridStyle}>
        <Metric label="Median level" value={latest.medianLevel?.toFixed(1) ?? "—"} detail={previous ? `${signed((latest.medianLevel ?? 0) - (previous.medianLevel ?? 0))} vs previous` : "first run on the board"} />
        <Metric label="Average level" value={latest.averageLevel?.toFixed(1) ?? "—"} detail={previous ? `${signed((latest.averageLevel ?? 0) - (previous.averageLevel ?? 0))} vs previous` : "nothing to compare yet"} />
        <Metric label="Bots" value={String(latest.bots.length)} detail={`${latest.run.bots.length} total in cohort`} />
        <Metric label="Vs best median" value={bestMedian === null ? "—" : signed((latest.medianLevel ?? 0) - bestMedian)} detail="0.0 means this is the champ" />
      </div>
    </section>}

    {FEATURE_STEP >= 2 && latest && <section style={{ ...sectionStyle, marginBottom: 18 }}>
      <SectionTitle eyebrow="LEVEL TRAILS" title="Level progression" note="Median level by rough played hour. Close enough for aquarium work." />
      {hasLevelupHistory ? <ProgressionChart rows={[latest]} levelups={levelups} /> : <div style={emptyStyle}>No level-up history recorded for this cohort.</div>}
    </section>}

    {FEATURE_STEP >= 3 && latest && <section style={{ ...sectionStyle, marginBottom: 18 }}>
      <SectionTitle eyebrow="CHECKPOINTS" title="Time to level" note="Median among the bots that got there." />
      {hasLevelupHistory ? <div style={metricGridStyle}>
        {LEVELS.map((level) => <Metric key={level} label={`Level ${level}`} value={formatDuration(latest.milestones[level].medianSeconds)} detail={`${latest.milestones[level].reached}/${latest.milestones[level].total} made it`} />)}
      </div> : <div style={emptyStyle}>No level-up history recorded for this cohort.</div>}
    </section>}

    {FEATURE_STEP >= 4 && visible.length >= 2 && <section style={{ ...sectionStyle, marginBottom: 18 }}>
      <SectionTitle eyebrow="HEAD TO HEAD" title="Run vs run" note="Pick two piles and see which one embarrassed the other." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={labelStyle}>Run A
          <select value={leftIndex} onChange={(event) => setLeftIndex(Number(event.target.value))} style={selectStyle}>
            {visible.map((row, index) => <option key={row.run.startedAt} value={index}>{runLabel(row.run.startedAt)}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Run B
          <select value={rightIndex} onChange={(event) => setRightIndex(Number(event.target.value))} style={selectStyle}>
            {visible.map((row, index) => <option key={row.run.startedAt} value={index}>{runLabel(row.run.startedAt)}</option>)}
          </select>
        </label>
      </div>
      {(() => {
        const left = visible[Math.min(leftIndex, visible.length - 1)];
        const right = visible[Math.min(rightIndex, visible.length - 1)];
        return <div style={metricGridStyle}>
          <Metric label="Median level delta" value={signed((left.medianLevel ?? 0) - (right.medianLevel ?? 0))} detail="A minus B" />
          <Metric label="Average level delta" value={signed((left.averageLevel ?? 0) - (right.averageLevel ?? 0))} detail="A minus B" />
          <Metric label="Lv10 delta" value={left.milestones[10].medianSeconds !== null && right.milestones[10].medianSeconds !== null ? formatSignedDuration(left.milestones[10].medianSeconds - right.milestones[10].medianSeconds) : "—"} detail="negative is faster" />
          <Metric label="Lv20 delta" value={left.milestones[20].medianSeconds !== null && right.milestones[20].medianSeconds !== null ? formatSignedDuration(left.milestones[20].medianSeconds - right.milestones[20].medianSeconds) : "—"} detail="negative is faster" />
        </div>;
      })()}
    </section>}
  </>;
}
