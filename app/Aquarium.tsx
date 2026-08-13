"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Connection = { url: string; user: string; password: string };
type ItemData = {
  id: number;
  name: string;
  count: number;
  quality: number;
  icon: string;
  durability: number;
  maxDurability: number;
  soulbound: boolean;
};
type RosterBot = {
  guid: number;
  name: string;
  level: number;
  classId: number;
  raceId: number;
  online: boolean;
  area: string;
  gold: number;
  bagUsed: number;
  bagTotal: number;
  state: string;
  action: string;
};
type Objective = {
  kind: "creature" | "object" | "item" | "player";
  id: number;
  current: number;
  required: number;
};
type QuestData = {
  id: number;
  title: string;
  status: number;
  timerMs: number;
  objectives: Objective[];
};
type Snapshot = {
  version: number;
  guid: number;
  name: string;
  level: number;
  classId: number;
  raceId: number;
  gold: number;
  health: { current: number; max: number };
  power: { type: number; current: number; max: number };
  xp: { current: number; next: number };
  position: {
    map: number;
    zone: number;
    area: number;
    areaName: string;
    x: number;
    y: number;
    z: number;
  };
  bagsUsed: number;
  bagsTotal: number;
  ai: {
    state: string;
    action: string;
    target: string;
    travel: string;
    rpg: string;
    strategies: { combat: string[]; nonCombat: string[]; dead: string[] };
  };
  equipment: { slot: number; item: ItemData | null }[];
  bags: { slot: number; name: string; size: number; items: (ItemData | null)[] }[];
  quests: QuestData[];
};
type CompletedQuest = { id: number; title: string };
type AquariumTab = "brain" | "quests" | "history";
type ApiMode = "roster" | "inspect" | "history";

const CLASSES: Record<number, { name: string; color: string; sigil: string }> = {
  1: { name: "Warrior", color: "#c79c6e", sigil: "W" },
  2: { name: "Paladin", color: "#f58cba", sigil: "P" },
  3: { name: "Hunter", color: "#abd473", sigil: "H" },
  4: { name: "Rogue", color: "#fff569", sigil: "R" },
  5: { name: "Priest", color: "#f5f5f5", sigil: "Pr" },
  7: { name: "Shaman", color: "#277eea", sigil: "S" },
  8: { name: "Mage", color: "#69ccf0", sigil: "M" },
  9: { name: "Warlock", color: "#9482c9", sigil: "Wl" },
  11: { name: "Druid", color: "#ff7d0a", sigil: "D" },
};
const RACES: Record<number, string> = {
  1: "Human",
  2: "Orc",
  3: "Dwarf",
  4: "Night Elf",
  5: "Undead",
  6: "Tauren",
  7: "Gnome",
  8: "Troll",
  10: "Blood Elf",
  11: "Draenei",
};
const EQUIPMENT_NAMES = [
  "Head",
  "Neck",
  "Shoulders",
  "Shirt",
  "Chest",
  "Waist",
  "Legs",
  "Feet",
  "Wrists",
  "Hands",
  "Finger I",
  "Finger II",
  "Trinket I",
  "Trinket II",
  "Back",
  "Main hand",
  "Off hand",
  "Ranged",
  "Tabard",
];
const EQUIPMENT_LEFT = [0, 1, 2, 14, 4, 3, 18, 8];
const EQUIPMENT_RIGHT = [9, 5, 6, 7, 10, 11, 12, 13];
const EQUIPMENT_BOTTOM = [15, 16, 17];
const QUALITY_NAMES = ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

function mockItem(
  id: number,
  name: string,
  quality: number,
  icon: string,
  count = 1,
  durability = 0,
  maxDurability = 0,
): ItemData {
  return { id, name, quality, icon, count, durability, maxDurability, soulbound: quality > 1 };
}

const DEMO_ROSTER: RosterBot[] = [
  { guid: 187, name: "Aeloria", level: 27, classId: 11, raceId: 4, online: true, area: "Ashenvale", gold: 186432, bagUsed: 39, bagTotal: 52, state: "non-combat", action: "choose travel target" },
  { guid: 203, name: "Brannoc", level: 24, classId: 1, raceId: 3, online: true, area: "Wetlands", gold: 94510, bagUsed: 30, bagTotal: 44, state: "combat", action: "melee" },
  { guid: 219, name: "Cinderwick", level: 29, classId: 8, raceId: 7, online: true, area: "Duskwood", gold: 240906, bagUsed: 47, bagTotal: 52, state: "non-combat", action: "rpg wander" },
  { guid: 221, name: "Drekka", level: 23, classId: 3, raceId: 2, online: true, area: "Stonetalon Mountains", gold: 117320, bagUsed: 32, bagTotal: 44, state: "combat", action: "shoot" },
  { guid: 238, name: "Elyssara", level: 26, classId: 5, raceId: 11, online: true, area: "Redridge Mountains", gold: 151007, bagUsed: 36, bagTotal: 48, state: "non-combat", action: "talk to quest giver" },
  { guid: 241, name: "Fenbar", level: 21, classId: 4, raceId: 5, online: false, area: "", gold: 0, bagUsed: 0, bagTotal: 0, state: "offline", action: "" },
];

const DEMO_EQUIPMENT: Snapshot["equipment"] = [
  mockItem(12018, "Conservator Helm", 2, "inv_helmet_08", 1, 41, 45),
  mockItem(10711, "Dragon's Blood Necklace", 3, "inv_jewelry_necklace_07"),
  mockItem(14170, "Buccaneer's Mantle", 2, "inv_shoulder_09", 1, 34, 40),
  mockItem(2575, "Red Linen Shirt", 1, "inv_shirt_red_01"),
  mockItem(2800, "Black Velvet Robes", 2, "inv_chest_cloth_25", 1, 61, 70),
  mockItem(6726, "Razzeric's Customized Seatbelt", 2, "inv_belt_06", 1, 24, 25),
  mockItem(14242, "Darkmist Pants", 2, "inv_pants_09", 1, 38, 45),
  mockItem(9454, "Acidic Walkers", 3, "inv_boots_05", 1, 42, 45),
  mockItem(9821, "Durable Bracers", 2, "inv_bracer_07", 1, 22, 25),
  mockItem(9910, "Royal Gloves", 2, "inv_gauntlets_17", 1, 27, 30),
  mockItem(11965, "Quartz Ring", 2, "inv_jewelry_ring_10"),
  mockItem(12014, "Arctic Ring", 2, "inv_jewelry_ring_12"),
  mockItem(17774, "Mark of the Chosen", 3, "inv_jewelry_talisman_08"),
  null,
  mockItem(7411, "Infiltrator Cloak", 2, "inv_misc_cape_18", 1, 31, 35),
  mockItem(15230, "Ridge Cleaver", 2, "inv_axe_01", 1, 54, 60),
  mockItem(7002, "Arctic Buckler", 2, "inv_shield_09", 1, 46, 50),
  mockItem(8184, "Firestarter", 2, "inv_weapon_rifle_04", 1, 36, 40),
  null,
].map((item, slot) => ({ slot, item }));

function bagSlots(size: number, items: Record<number, ItemData>): (ItemData | null)[] {
  return Array.from({ length: size }, (_, index) => items[index] ?? null);
}

const DEMO_BAGS: Snapshot["bags"] = [
  { slot: 0, name: "Backpack", size: 16, items: bagSlots(16, {
    0: mockItem(6948, "Hearthstone", 1, "inv_misc_rune_01"),
    1: mockItem(1710, "Greater Healing Potion", 1, "inv_potion_52", 3),
    2: mockItem(3771, "Wild Hog Shank", 1, "inv_misc_food_14", 8),
    3: mockItem(2455, "Minor Mana Potion", 1, "inv_potion_70", 5),
    5: mockItem(4306, "Silk Cloth", 1, "inv_fabric_silk_01", 17),
    6: mockItem(1205, "Melon Juice", 1, "inv_drink_09", 6),
    9: mockItem(929, "Healing Potion", 1, "inv_potion_51", 2),
    10: mockItem(17056, "Light Feather", 1, "inv_feather_04", 11),
    14: mockItem(2725, "Green Hills of Stranglethorn - Page 1", 1, "inv_misc_note_03"),
  }) },
  { slot: 19, name: "Green Leather Bag", size: 8, items: bagSlots(8, {
    0: mockItem(2592, "Wool Cloth", 1, "inv_fabric_wool_01", 20),
    1: mockItem(2318, "Light Leather", 1, "inv_misc_leatherscrap_03", 12),
    2: mockItem(2771, "Tin Ore", 1, "inv_ore_tin_01", 7),
    5: mockItem(2836, "Coarse Stone", 1, "inv_stone_09", 15),
  }) },
  { slot: 20, name: "Heavy Brown Bag", size: 10, items: bagSlots(10, {
    1: mockItem(5498, "Small Lustrous Pearl", 2, "inv_misc_gem_pearl_03"),
    3: mockItem(1705, "Lesser Moonstone", 2, "inv_misc_gem_crystal_01", 2),
    7: mockItem(1210, "Shadowgem", 2, "inv_misc_gem_amethyst_01"),
  }) },
  { slot: 21, name: "Red Woolen Bag", size: 8, items: bagSlots(8, {}) },
  { slot: 22, name: "Small Brown Pouch", size: 6, items: bagSlots(6, {}) },
];

const DEMO_QUESTS: QuestData[] = [
  { id: 1010, title: "Bathran's Hair", status: 3, timerMs: 0, objectives: [{ kind: "item", id: 5437, current: 3, required: 5 }] },
  { id: 1056, title: "Journey to Stonetalon Peak", status: 3, timerMs: 0, objectives: [] },
  { id: 1022, title: "The Howling Vale", status: 1, timerMs: 0, objectives: [{ kind: "object", id: 19027, current: 1, required: 1 }] },
  { id: 976, title: "Supplies to Auberdine", status: 3, timerMs: 438000, objectives: [{ kind: "item", id: 12342, current: 1, required: 1 }] },
];
const DEMO_COMPLETED: CompletedQuest[] = [
  { id: 456, title: "The Balance of Nature" },
  { id: 457, title: "The Woodland Protector" },
  { id: 458, title: "The Woodland Protector" },
  { id: 459, title: "The Relics of Wakening" },
  { id: 475, title: "A Troubling Breeze" },
  { id: 476, title: "Gnarlpine Corruption" },
  { id: 483, title: "The Relics of Wakening" },
  { id: 486, title: "Ursal the Mauler" },
  { id: 487, title: "The Road to Darnassus" },
  { id: 488, title: "Zenn's Bidding" },
  { id: 489, title: "Seek Redemption!" },
  { id: 918, title: "Timberling Seeds" },
];

function demoSnapshot(bot: RosterBot): Snapshot {
  return {
    version: 1,
    guid: bot.guid,
    name: bot.name,
    level: bot.level,
    classId: bot.classId,
    raceId: bot.raceId,
    gold: bot.gold,
    health: { current: bot.state === "combat" ? 812 : 1034, max: 1180 },
    power: { type: 0, current: 1178, max: 1432 },
    xp: { current: 29422, next: 48200 },
    position: { map: bot.raceId % 2, zone: 331, area: 331, areaName: bot.area || "Offline", x: 2742.18, y: -331.62, z: 107.44 },
    bagsUsed: bot.bagUsed,
    bagsTotal: bot.bagTotal,
    ai: {
      state: bot.state,
      action: bot.action || "waiting",
      target: bot.state === "combat" ? "Foulweald Warrior" : "",
      travel: "Destination = Astranaar: quest hub (Ashenvale) distance: 842y Status = travel Expire in 386s Retry 0/0",
      rpg: "go camp",
      strategies: {
        combat: ["caster", "dps", "aoe", "potions", "threat"],
        nonCombat: ["new rpg", "grind", "lfg", "loot", "gather", "food", "mount"],
        dead: ["dead", "follow master random"],
      },
    },
    equipment: DEMO_EQUIPMENT,
    bags: DEMO_BAGS,
    quests: DEMO_QUESTS,
  };
}

async function aquariumRequest<T>(connection: Connection, mode: ApiMode, guid?: number): Promise<T> {
  const response = await fetch("/api/aquarium", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection, mode, guid }),
  });
  const payload = (await response.json()) as { ok: boolean; data?: T; error?: string };
  if (!payload.ok || !payload.data) throw new Error(payload.error || "Aquarium request failed.");
  return payload.data;
}

function percent(current: number, maximum: number): number {
  return maximum ? Math.max(0, Math.min(100, Math.round((current / maximum) * 100))) : 0;
}

function money(copper: number) {
  return {
    gold: Math.floor(copper / 10000),
    silver: Math.floor((copper % 10000) / 100),
    copper: copper % 100,
  };
}

function ItemCell({ item, label, compact = false }: { item: ItemData | null; label?: string; compact?: boolean }) {
  const quality = item ? Math.min(item.quality, QUALITY_NAMES.length - 1) : 0;
  const tooltip = item
    ? `${item.name}\nItem ${item.id} · ${QUALITY_NAMES[quality]}${item.count > 1 ? ` · ${item.count}` : ""}`
    : label || "Empty slot";
  return (
    <div className={`item-cell quality-${quality} ${compact ? "compact" : ""} ${item ? "filled" : "empty"}`} title={tooltip}>
      {item?.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://wow.zamimg.com/images/wow/icons/large/${item.icon.toLowerCase()}.jpg`} alt="" loading="lazy" />
      ) : <span className="empty-rune">·</span>}
      {item && item.count > 1 && <span className="item-count">{item.count}</span>}
      {item && item.maxDurability > 0 && item.durability / item.maxDurability < 0.3 && <span className="broken-mark">!</span>}
    </div>
  );
}

function EquipmentSlot({ snapshot, slot }: { snapshot: Snapshot; slot: number }) {
  const entry = snapshot.equipment.find((candidate) => candidate.slot === slot);
  return (
    <div className="equipment-slot">
      <ItemCell item={entry?.item ?? null} compact />
      <span>{EQUIPMENT_NAMES[slot]}</span>
    </div>
  );
}

function Meter({ label, current, maximum, tone }: { label: string; current: number; maximum: number; tone: string }) {
  const value = percent(current, maximum);
  return (
    <div className="meter-block">
      <div className="meter-copy"><span>{label}</span><span>{value}%</span></div>
      <div className="meter-track"><div className={`meter-fill ${tone}`} style={{ width: `${value}%` }} /></div>
      <div className="meter-numbers">{current.toLocaleString()} / {maximum.toLocaleString()}</div>
    </div>
  );
}

export default function Aquarium() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<Connection>({ url: "http://127.0.0.1:7878/", user: "aquarium", password: "" });
  const [showConnection, setShowConnection] = useState(false);
  const [roster, setRoster] = useState<RosterBot[]>(DEMO_ROSTER);
  const [selectedGuid, setSelectedGuid] = useState(DEMO_ROSTER[0].guid);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => demoSnapshot(DEMO_ROSTER[0]));
  const [completed, setCompleted] = useState<CompletedQuest[]>(DEMO_COMPLETED);
  const [tab, setTab] = useState<AquariumTab>("brain");
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const connectionKey = connection ? JSON.stringify(connection) : "demo";
  const selectedBot = roster.find((bot) => bot.guid === selectedGuid) ?? roster[0];
  const classInfo = CLASSES[snapshot.classId] ?? { name: "Unknown", color: "#82b7ad", sigil: "?" };
  const coin = money(snapshot.gold);
  const filteredRoster = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? roster.filter((bot) => `${bot.name} ${bot.area} ${CLASSES[bot.classId]?.name ?? ""}`.toLowerCase().includes(needle))
      : roster;
  }, [roster, search]);
  const filteredHistory = useMemo(() => {
    const needle = historySearch.trim().toLowerCase();
    return needle ? completed.filter((quest) => `${quest.id} ${quest.title}`.toLowerCase().includes(needle)) : completed;
  }, [completed, historySearch]);

  useEffect(() => {
    const saved = localStorage.getItem("altbot-aquarium-connection");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Connection;
      setConnectionDraft(parsed);
      setConnection(parsed);
    } catch {
      localStorage.removeItem("altbot-aquarium-connection");
    }
  }, []);

  useEffect(() => {
    if (!connection) {
      setRoster(DEMO_ROSTER);
      return;
    }
    let cancelled = false;
    const loadRoster = async () => {
      if (document.hidden) return;
      try {
        const data = await aquariumRequest<{ bots: RosterBot[] }>(connection, "roster");
        if (cancelled) return;
        setRoster(data.bots);
        setSelectedGuid((current) => data.bots.some((bot) => bot.guid === current) ? current : data.bots[0]?.guid ?? 0);
        setError("");
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Roster refresh failed.");
      }
    };
    void loadRoster();
    const timer = window.setInterval(loadRoster, 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [connectionKey, connection]);

  useEffect(() => {
    if (!selectedBot) return;
    if (!connection) {
      setSnapshot(demoSnapshot(selectedBot));
      setCompleted(DEMO_COMPLETED);
      setLastUpdated(new Date());
      return;
    }
    let cancelled = false;
    const loadSnapshot = async () => {
      if (document.hidden || !selectedGuid) return;
      try {
        const data = await aquariumRequest<Snapshot>(connection, "inspect", selectedGuid);
        if (cancelled) return;
        setSnapshot(data);
        setLastUpdated(new Date());
        setError("");
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Snapshot refresh failed.");
      }
    };
    void loadSnapshot();
    const timer = window.setInterval(loadSnapshot, 2_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [connectionKey, connection, selectedGuid, selectedBot]);

  useEffect(() => {
    if (tab !== "history" || !connection || !selectedGuid) return;
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const data = await aquariumRequest<{ completed: CompletedQuest[] }>(connection, "history", selectedGuid);
        if (!cancelled) setCompleted(data.completed);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Quest history failed.");
      }
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [tab, connectionKey, connection, selectedGuid]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnecting(true);
    setError("");
    try {
      const data = await aquariumRequest<{ bots: RosterBot[] }>(connectionDraft, "roster");
      setConnection(connectionDraft);
      setRoster(data.bots);
      setSelectedGuid(data.bots[0]?.guid ?? 0);
      localStorage.setItem("altbot-aquarium-connection", JSON.stringify(connectionDraft));
      setShowConnection(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not connect.");
    } finally {
      setConnecting(false);
    }
  }

  function useDemo() {
    setConnection(null);
    setRoster(DEMO_ROSTER);
    setSelectedGuid(DEMO_ROSTER[0].guid);
    setSnapshot(demoSnapshot(DEMO_ROSTER[0]));
    setCompleted(DEMO_COMPLETED);
    setError("");
    localStorage.removeItem("altbot-aquarium-connection");
  }

  const style = { "--class-color": classInfo.color } as CSSProperties;
  return (
    <main className="aquarium" style={style}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><i /></div>
          <div><p className="eyebrow">STRICT ALTBOT FIELD NOTES</p><h1>Altbot Aquarium</h1></div>
        </div>
        <div className="topbar-actions">
          <span className={`mode-chip ${connection ? "live" : "demo"}`}><i /> {connection ? "Live water" : "Demo water"}</span>
          <button className="button ghost" onClick={() => setShowConnection(true)}>{connection ? "Connection" : "Connect"}</button>
        </div>
      </header>

      {error && <div className="error-strip" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <div className="workspace">
        <aside className="roster-panel panel">
          <div className="panel-heading roster-heading">
            <div><p className="eyebrow">THE COHORT</p><h2>{roster.length} altbots</h2></div>
            <span className="online-count">{roster.filter((bot) => bot.online).length} awake</span>
          </div>
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a bot, class, or zone" aria-label="Find an altbot" /></label>
          <div className="roster-list">
            {filteredRoster.map((bot) => {
              const botClass = CLASSES[bot.classId] ?? { name: "Unknown", color: "#82b7ad", sigil: "?" };
              return (
                <button key={bot.guid} className={`roster-card ${bot.guid === selectedGuid ? "selected" : ""}`} onClick={() => setSelectedGuid(bot.guid)} style={{ "--bot-color": botClass.color } as CSSProperties}>
                  <span className="roster-avatar">{botClass.sigil}</span>
                  <span className="roster-copy"><strong>{bot.name}</strong><small>Lv {bot.level} {botClass.name}</small><span>{bot.online ? bot.area || "Somewhere suspicious" : "Sleeping"}</span></span>
                  <span className={`state-dot ${bot.online ? bot.state.replace("-", "") : "offline"}`} />
                </button>
              );
            })}
          </div>
          <div className="roster-footer"><span>Refreshes every 10s</span><span>{connection ? "SOAP" : "Sample cohort"}</span></div>
        </aside>

        <section className="bot-detail">
          <article className="identity-card panel">
            <div className="identity-primary">
              <div className="hero-avatar"><span>{classInfo.sigil}</span><i className={selectedBot?.online === false ? "offline" : ""} /></div>
              <div><p className="eyebrow">SUBJECT #{snapshot.guid}</p><h2>{snapshot.name}</h2><p className="identity-line">Level {snapshot.level} {RACES[snapshot.raceId] ?? "Unknown"} {classInfo.name}<span>·</span> {snapshot.position.areaName}</p></div>
            </div>
            <div className="identity-meters">
              <Meter label="Health" current={snapshot.health.current} maximum={snapshot.health.max} tone="health" />
              <Meter label="Power" current={snapshot.power.current} maximum={snapshot.power.max} tone="mana" />
              <Meter label="Experience" current={snapshot.xp.current} maximum={snapshot.xp.next} tone="xp" />
            </div>
            <div className="identity-facts">
              <div className="money-stack"><span className="coin gold" /><strong>{coin.gold}</strong><span className="coin silver" /><strong>{coin.silver}</strong><span className="coin copper" /><strong>{coin.copper}</strong></div>
              <div><strong>{snapshot.bagsUsed}/{snapshot.bagsTotal}</strong><span>bag slots</span></div>
              <div><strong>{snapshot.ai.state}</strong><span>AI state</span></div>
            </div>
          </article>

          <div className="detail-grid">
            <section className="gear-panel panel">
              <div className="panel-heading"><div><p className="eyebrow">LOADOUT</p><h2>What they&apos;re wearing</h2></div><span className="tiny-note">Hover an item for its ID</span></div>
              <div className="paper-doll">
                <div className="equipment-column">{EQUIPMENT_LEFT.map((slot) => <EquipmentSlot key={slot} snapshot={snapshot} slot={slot} />)}</div>
                <div className="doll-center" aria-hidden="true"><div className="doll-halo" /><div className="doll-head" /><div className="doll-body" /><div className="doll-level"><span>LEVEL</span><strong>{snapshot.level}</strong></div></div>
                <div className="equipment-column right">{EQUIPMENT_RIGHT.map((slot) => <EquipmentSlot key={slot} snapshot={snapshot} slot={slot} />)}</div>
                <div className="weapon-row">{EQUIPMENT_BOTTOM.map((slot) => <EquipmentSlot key={slot} snapshot={snapshot} slot={slot} />)}</div>
              </div>
              <div className="section-rule"><span>BAGS</span><i /><strong>{snapshot.bagsUsed} used</strong></div>
              <div className="bags-list">
                {snapshot.bags.filter((bag) => bag.size > 0).map((bag) => (
                  <div className="bag" key={bag.slot}><div className="bag-heading"><span>{bag.name}</span><small>{bag.items.filter(Boolean).length} / {bag.size}</small></div><div className="bag-grid">{bag.items.map((item, index) => <ItemCell key={index} item={item} />)}</div></div>
                ))}
              </div>
            </section>

            <section className="observatory-panel panel">
              <nav className="tabs" aria-label="Altbot details">
                {(["brain", "quests", "history"] as AquariumTab[]).map((candidate) => <button key={candidate} className={tab === candidate ? "active" : ""} onClick={() => setTab(candidate)}>{candidate === "brain" ? "Brain" : candidate === "quests" ? `Quests ${snapshot.quests.length}` : "Completed"}</button>)}
              </nav>

              {tab === "brain" && <div className="tab-body brain-tab">
                <div className="thought-card"><div className="thought-orbit"><span /></div><div><p className="eyebrow">LAST CHOSEN ACTION</p><h3>{snapshot.ai.action || "A dignified pause"}</h3><p>{snapshot.ai.target ? `Targeting ${snapshot.ai.target}` : "No current target"}</p></div></div>
                <div className="brain-facts"><div><span>STATE</span><strong>{snapshot.ai.state}</strong></div><div><span>RPG MODE</span><strong>{snapshot.ai.rpg || "idle"}</strong></div></div>
                <div className="brain-section"><div className="brain-section-title"><span>Enabled strategies</span><small>several can think at once</small></div>{Object.entries(snapshot.ai.strategies).map(([state, strategies]) => <div className="strategy-group" key={state}><strong>{state === "nonCombat" ? "Non-combat" : state}</strong><div className="strategy-pills">{strategies.map((strategy) => <span key={strategy}>{strategy}</span>)}</div></div>)}</div>
                <div className="brain-section travel-note"><div className="brain-section-title"><span>Travel note</span><small>the useful timer</small></div><p>{snapshot.ai.travel || "No travel target. They are improvising."}</p></div>
                <div className="coordinates"><span>MAP {snapshot.position.map}</span><span>{snapshot.position.x.toFixed(1)}, {snapshot.position.y.toFixed(1)}, {snapshot.position.z.toFixed(1)}</span></div>
              </div>}

              {tab === "quests" && <div className="tab-body quest-tab">
                <div className="tab-intro"><div><p className="eyebrow">CURRENT QUEST LOG</p><h3>{snapshot.quests.length} ongoing stories</h3></div><span>{snapshot.quests.filter((quest) => quest.status === 1).length} ready</span></div>
                <div className="quest-list">{snapshot.quests.map((quest) => <article className="quest-card" key={quest.id}>
                  <div className="quest-title-row"><span className={`quest-status status-${quest.status}`} /><div><h4>{quest.title}</h4><span>Quest #{quest.id} · {quest.status === 1 ? "Ready to turn in" : quest.status === 5 ? "Failed" : "In progress"}</span></div>{quest.timerMs > 0 && <strong className="quest-timer">{Math.ceil(quest.timerMs / 60000)}m</strong>}</div>
                  {quest.objectives.length > 0 ? <div className="objectives">{quest.objectives.map((objective, index) => <div className="objective" key={`${objective.kind}-${objective.id}-${index}`}><div><span>{objective.kind} #{objective.id}</span><strong>{objective.current}/{objective.required}</strong></div><div className="objective-track"><i style={{ width: `${percent(objective.current, objective.required)}%` }} /></div></div>)}</div> : <p className="quest-quiet">No countable objective. Probably walking or talking.</p>}
                </article>)}</div>
              </div>}

              {tab === "history" && <div className="tab-body history-tab">
                <div className="tab-intro"><div><p className="eyebrow">REWARDED QUESTS</p><h3>{completed.length} known victories</h3></div></div>
                <label className="search-box history-search"><span aria-hidden="true">⌕</span><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Filter by title or quest ID" aria-label="Filter completed quests" /></label>
                <div className="history-list">{filteredHistory.map((quest) => <div className="history-row" key={quest.id}><span>#{quest.id}</span><strong>{quest.title}</strong><i>✓</i></div>)}</div>
                <p className="history-footnote">Dropped quest history will join us later, once it actually exists.</p>
              </div>}

              <footer className="panel-footer"><span><i className={connection ? "pulse" : ""} /> Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><span>{connection ? "Selected bot refreshes every 2s" : "Exploring sample data"}</span></footer>
            </section>
          </div>
        </section>
      </div>

      {showConnection && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowConnection(false)}>
        <section className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="connect-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowConnection(false)} aria-label="Close">×</button>
          <p className="eyebrow">LOCAL PIPE</p><h2 id="connect-title">Connect to worldserver</h2><p className="modal-lead">Credentials stay in this browser. Aquarium only accepts a loopback SOAP address.</p>
          <form onSubmit={connect}>
            <label>SOAP address<input value={connectionDraft.url} onChange={(event) => setConnectionDraft({ ...connectionDraft, url: event.target.value })} placeholder="http://127.0.0.1:7878/" /></label>
            <label>Bridge account<input value={connectionDraft.user} onChange={(event) => setConnectionDraft({ ...connectionDraft, user: event.target.value })} autoComplete="username" /></label>
            <label>Password<input type="password" value={connectionDraft.password} onChange={(event) => setConnectionDraft({ ...connectionDraft, password: event.target.value })} autoComplete="current-password" /></label>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions"><button className="button primary" type="submit" disabled={connecting}>{connecting ? "Dipping a toe…" : "Connect"}</button><button className="button ghost" type="button" onClick={useDemo}>Use demo water</button></div>
          </form>
          <div className="setup-note"><strong>One-time worldserver setup</strong><code>SOAP.Enabled = 1</code><code>account create aquarium &lt;password&gt;</code><code>account set gmlevel aquarium 3 -1</code></div>
        </section>
      </div>}
    </main>
  );
}
