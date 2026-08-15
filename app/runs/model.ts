export type Connection = { url: string; user: string; password: string };
export type BenchmarkBot = { guid: number; name: string; raceId: number; classId: number; level: number; firstLoginAt: number; retiredAt: number };
export type Levelup = { guid: number; level: number; seconds: number };
export type BenchmarkData = { version: number; bots: BenchmarkBot[]; levelups: Levelup[] };
export type Run = { startedAt: number; bots: BenchmarkBot[] };
export type Filter = { classId: number; raceId: number; faction: "all" | "alliance" | "horde" };
export type MilestoneSummary = { medianSeconds: number | null; reached: number; total: number };
export type RunSummary = { run: Run; bots: BenchmarkBot[]; averageLevel: number | null; medianLevel: number | null; milestones: Record<number, MilestoneSummary> };
export type LiveBot = { guid: number; name: string; level: number; classId: number; raceId: number; itemLevel?: number; online: boolean; area: string; gold: number; bagUsed: number; bagTotal: number; state: string; action: string };
export type GroupStat = { label: string; bots: BenchmarkBot[]; averageLevel: number | null; medianLevel: number | null; level10: number | null };

export const RUN_GAP_SECONDS = 30 * 60;
export const LEVELS = [5, 10, 15, 20];
export const CLASSES: Record<number, string> = { 1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid" };
export const RACES: Record<number, string> = { 1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei" };
const ALLIANCE = new Set([1, 3, 4, 7, 11]);
const HORDE = new Set([2, 5, 6, 8, 10]);

export function factionForRace(raceId: number): "alliance" | "horde" | "unknown" { if (ALLIANCE.has(raceId)) return "alliance"; if (HORDE.has(raceId)) return "horde"; return "unknown"; }
export function median(values: number[]): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
export function average(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
export function formatDuration(seconds: number | null): string { if (seconds === null) return "—"; const rounded = Math.round(seconds); const hours = Math.floor(rounded / 3600); const minutes = Math.floor((rounded % 3600) / 60); return hours ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes}m`; }
export function formatSignedDuration(seconds: number | null): string { if (seconds === null) return "—"; const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : ""; return `${sign}${formatDuration(Math.abs(seconds))}`; }
export function signed(value: number | null, digits = 1): string { if (value === null || !Number.isFinite(value)) return "—"; return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`; }
export function runLabel(timestamp: number): string { return new Date(timestamp * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
export function groupRuns(bots: BenchmarkBot[]): Run[] { const sorted = [...bots].sort((a, b) => a.firstLoginAt - b.firstLoginAt || a.guid - b.guid); const runs: Run[] = []; let previous = 0; for (const bot of sorted) { const current = runs.at(-1); if (!current || bot.firstLoginAt - previous > RUN_GAP_SECONDS) runs.push({ startedAt: bot.firstLoginAt, bots: [bot] }); else current.bots.push(bot); previous = bot.firstLoginAt; } return runs.reverse(); }
export function matchesFilter(bot: BenchmarkBot, filter: Filter): boolean { return (!filter.classId || bot.classId === filter.classId) && (!filter.raceId || bot.raceId === filter.raceId) && (filter.faction === "all" || factionForRace(bot.raceId) === filter.faction); }
export function levelAt(guid: number, seconds: number, levelups: Map<number, Map<number, number>>): number { let level = 1; for (const [candidate, reachedAt] of levelups.get(guid)?.entries() ?? []) if (reachedAt <= seconds && candidate > level) level = candidate; return level; }
export function groupStats(bots: BenchmarkBot[], keyFor: (bot: BenchmarkBot) => string, labelFor: (key: string) => string, levelups: Map<number, Map<number, number>>): GroupStat[] { const groups = new Map<string, BenchmarkBot[]>(); for (const bot of bots) { const key = keyFor(bot); groups.set(key, [...(groups.get(key) ?? []), bot]); } return [...groups.entries()].map(([key, groupBots]) => ({ label: labelFor(key), bots: groupBots, averageLevel: average(groupBots.map((bot) => bot.level)), medianLevel: median(groupBots.map((bot) => bot.level)), level10: median(groupBots.flatMap((bot) => { const seconds = levelups.get(bot.guid)?.get(10); return seconds === undefined ? [] : [seconds]; })) })).sort((a, b) => (b.medianLevel ?? 0) - (a.medianLevel ?? 0) || a.label.localeCompare(b.label)); }
export function lastKnownSeconds(bot: BenchmarkBot, levelups: Map<number, Map<number, number>>): number { return Math.max(0, ...(levelups.get(bot.guid)?.values() ?? [])); }
export function activityFor(bot: LiveBot): string { if (!bot.online) return "Sleeping"; const state = bot.state.toLowerCase(); const action = bot.action.toLowerCase(); if (state.includes("dead")) return "Dead"; if (state.includes("combat")) return "Combat"; if (/travel|move|go to|follow path/.test(action)) return "Travelling"; if (/quest|objective|quest giver|talk/.test(action)) return "Questing-ish"; if (/rpg|vendor|trainer|repair|sell|buy/.test(action)) return "RPG / errands"; return "Other nonsense"; }
export function formatMoney(copper: number | null): string { if (copper === null) return "—"; const gold = Math.floor(copper / 10000); const silver = Math.floor((copper % 10000) / 100); const rest = Math.floor(copper % 100); return gold ? `${gold}g ${silver}s` : silver ? `${silver}s ${rest}c` : `${rest}c`; }
