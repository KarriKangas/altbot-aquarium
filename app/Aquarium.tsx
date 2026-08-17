"use client";

import type { CSSProperties, FormEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  itemLevel: number;
  requiredLevel: number;
  armor: number;
  armorSubclass?: number;
  damageMin: number;
  damageMax: number;
  speed: number;
  vendorValue: number;
  stats: { type: number; value: number }[];
  enchants: { id: number; name: string }[];
  gems: { id: number; name: string }[];
};
type RosterBot = {
  guid: number;
  name: string;
  level: number;
  classId: number;
  raceId: number;
  faction?: string;
  itemLevel?: number;
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
  name?: string;
  icon?: string;
  item?: ItemData;
};
type QuestRewards = {
  guaranteed?: ItemData[];
  choices?: ItemData[];
  money?: number;
  xp?: number;
  honor?: number;
};
type QuestData = {
  id: number;
  title: string;
  status: number;
  timerMs: number;
  objectives: Objective[];
  rewards?: QuestRewards;
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
type Faction = "alliance" | "horde";
type RosterSort = "level" | "name" | "itemLevel";
type ClassIcon = "swords" | "shield" | "bow" | "dagger" | "star" | "lightning" | "spark" | "flame" | "leaf" | "question";

const CLASSES: Record<number, { name: string; color: string; sigil: string; icon: ClassIcon }> = {
  1: { name: "Warrior", color: "#c79c6e", sigil: "W", icon: "swords" },
  2: { name: "Paladin", color: "#f58cba", sigil: "P", icon: "shield" },
  3: { name: "Hunter", color: "#abd473", sigil: "H", icon: "bow" },
  4: { name: "Rogue", color: "#fff569", sigil: "R", icon: "dagger" },
  5: { name: "Priest", color: "#f5f5f5", sigil: "Pr", icon: "star" },
  7: { name: "Shaman", color: "#277eea", sigil: "S", icon: "lightning" },
  8: { name: "Mage", color: "#69ccf0", sigil: "M", icon: "spark" },
  9: { name: "Warlock", color: "#9482c9", sigil: "Wl", icon: "flame" },
  11: { name: "Druid", color: "#ff7d0a", sigil: "D", icon: "leaf" },
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
const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]);
const HORDE_RACES = new Set([2, 5, 6, 8, 10]);
const FACTION_LABELS: Record<Faction, string> = { alliance: "Alliance", horde: "Horde" };

function ClassIcon({ icon }: { icon: ClassIcon }) {
  const commonProps = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.7 };
  const paths: Record<ClassIcon, ReactNode> = {
    swords: <><path d="m6 5 13 13M18 5 5 18" {...commonProps} /><path d="m4.5 4.5 2.5.7-.7 2.5M19.5 4.5l-2.5.7.7 2.5M4.5 19.5l2.5-.7-.7-2.5M19.5 19.5l-2.5-.7.7-2.5" {...commonProps} /></>,
    shield: <><path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.3-7 9.1-4.2-1.8-7-4.8-7-9.1V6l7-2.5Z" {...commonProps} /><path d="M12 7v8M8.5 11h7" {...commonProps} /></>,
    bow: <><path d="M7 4c8 3 8 9 0 16M7 4c2.4 1.2 2.4 2.3 0 3.5M7 16.5c2.4 1.2 2.4 2.3 0 3.5M5 12h13M15 9l3 3-3 3" {...commonProps} /></>,
    dagger: <><path d="m5 19 9.5-9.5M14.5 5.5 18.5 9.5M13 7l4 4M5 19l4-1 9.5-9.5-4-4L5 19Z" {...commonProps} /><path d="m4 20 3-3" {...commonProps} /></>,
    star: <path d="m12 3 2.1 6.2 6.4.1-5.1 3.8 1.9 6.3-5.3-3.6-5.3 3.6 1.9-6.3-5.1-3.8 6.4-.1L12 3Z" {...commonProps} />,
    lightning: <path d="m13.5 2.8-7 9.2h5.2L10.5 21l7-9.2h-5.2l1.2-9Z" {...commonProps} />,
    spark: <><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" {...commonProps} /><circle cx="12" cy="12" r="2.5" {...commonProps} /></>,
    flame: <path d="M13.3 2.8c.8 3.6-2.3 4.8-1.2 7.2.5 1.1 1.8 1.7 2.3 0 2.9 2.1 3.9 4.7 3.1 7.2-.8 2.8-3 4.7-6 4.7-3.6 0-6.2-2.4-6.2-5.8 0-2.3 1.4-4.1 3.7-5.9-.1 2.2.8 3.2 1.7 2.8C12.7 11.4 9.6 8 13.3 2.8Z" {...commonProps} />,
    leaf: <><path d="M19.7 4.3C10 4.3 5 8.1 5 14.1c0 3.2 2.1 5.6 5.2 5.6 5.9 0 9.5-5.8 9.5-15.4Z" {...commonProps} /><path d="M4.5 20.5c3.1-5.1 6.6-8.7 11-11" {...commonProps} /></>,
    question: <><path d="M9.5 8.5a2.7 2.7 0 1 1 4.8 1.7c-1.2 1.2-2.3 1.6-2.3 3.3M12 17.5h.01" {...commonProps} /><circle cx="12" cy="12" r="8.5" {...commonProps} /></>,
  };
  return <svg className="class-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[icon]}</svg>;
}
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
const STAT_NAMES: Record<number, string> = {
  0: "Mana", 1: "Health", 3: "Agility", 4: "Strength", 5: "Intellect", 6: "Spirit", 7: "Stamina",
  12: "Defense rating", 13: "Dodge rating", 14: "Parry rating", 15: "Block rating", 31: "Hit rating",
  32: "Critical strike rating", 35: "Resilience rating", 36: "Haste rating", 37: "Expertise rating",
  38: "Attack power", 39: "Ranged attack power", 43: "Mana per 5 sec", 44: "Armor penetration rating",
  45: "Spell power", 47: "Spell penetration", 48: "Block value",
};
const ARMOR_SUBCLASS_NAMES: Record<number, string> = {
  1: "Cloth",
  2: "Leather",
  3: "Mail",
  4: "Plate",
  6: "Shield",
};

function itemArmorType(item: Pick<ItemData, "armorSubclass">): string | null {
  return typeof item.armorSubclass === "number" ? ARMOR_SUBCLASS_NAMES[item.armorSubclass] ?? null : null;
}

function mockItem(
  id: number,
  name: string,
  quality: number,
  icon: string,
  count = 1,
  durability = 0,
  maxDurability = 0,
  armorSubclass?: number,
): ItemData {
  return {
    id, name, quality, icon, count, durability, maxDurability, soulbound: quality > 1, armorSubclass,
    itemLevel: 28, requiredLevel: 23, armor: maxDurability ? 54 : 0, damageMin: 0, damageMax: 0,
    speed: 0, vendorValue: Math.max(1, id * 3), stats: quality > 1 ? [{ type: 7, value: 5 }] : [],
    enchants: [], gems: [],
  };
}

const DEMO_ROSTER: RosterBot[] = [
  { guid: 187, name: "Aeloria", level: 27, classId: 11, raceId: 4, itemLevel: 32, online: true, area: "Ashenvale", gold: 186432, bagUsed: 39, bagTotal: 52, state: "non-combat", action: "choose travel target" },
  { guid: 203, name: "Brannoc", level: 24, classId: 1, raceId: 3, itemLevel: 28, online: true, area: "Wetlands", gold: 94510, bagUsed: 30, bagTotal: 44, state: "combat", action: "melee" },
  { guid: 219, name: "Cinderwick", level: 29, classId: 8, raceId: 7, itemLevel: 35, online: true, area: "Duskwood", gold: 240906, bagUsed: 47, bagTotal: 52, state: "non-combat", action: "rpg wander" },
  { guid: 221, name: "Drekka", level: 23, classId: 3, raceId: 2, itemLevel: 25, online: true, area: "Stonetalon Mountains", gold: 117320, bagUsed: 32, bagTotal: 44, state: "combat", action: "shoot" },
  { guid: 238, name: "Elyssara", level: 26, classId: 5, raceId: 11, itemLevel: 30, online: true, area: "Redridge Mountains", gold: 151007, bagUsed: 36, bagTotal: 48, state: "non-combat", action: "talk to quest giver" },
  { guid: 241, name: "Fenbar", level: 21, classId: 4, raceId: 5, itemLevel: 22, online: false, area: "", gold: 0, bagUsed: 0, bagTotal: 0, state: "offline", action: "" },
];

const DEMO_EQUIPMENT: Snapshot["equipment"] = [
  mockItem(12018, "Conservator Helm", 2, "inv_helmet_08", 1, 41, 45, 2),
  mockItem(10711, "Dragon's Blood Necklace", 3, "inv_jewelry_necklace_07"),
  mockItem(14170, "Buccaneer's Mantle", 2, "inv_shoulder_09", 1, 34, 40, 1),
  mockItem(2575, "Red Linen Shirt", 1, "inv_shirt_red_01", 1, 0, 0, 1),
  mockItem(2800, "Black Velvet Robes", 2, "inv_chest_cloth_25", 1, 61, 70, 1),
  mockItem(6726, "Razzeric's Customized Seatbelt", 2, "inv_belt_06", 1, 24, 25, 2),
  mockItem(14242, "Darkmist Pants", 2, "inv_pants_09", 1, 38, 45, 1),
  mockItem(9454, "Acidic Walkers", 3, "inv_boots_05", 1, 42, 45),
  mockItem(9821, "Durable Bracers", 2, "inv_bracer_07", 1, 22, 25),
  mockItem(9910, "Royal Gloves", 2, "inv_gauntlets_17", 1, 27, 30, 1),
  mockItem(11965, "Quartz Ring", 2, "inv_jewelry_ring_10"),
  mockItem(12014, "Arctic Ring", 2, "inv_jewelry_ring_12"),
  mockItem(17774, "Mark of the Chosen", 3, "inv_jewelry_talisman_08"),
  null,
  mockItem(7411, "Infiltrator Cloak", 2, "inv_misc_cape_18", 1, 31, 35, 1),
  mockItem(15230, "Ridge Cleaver", 2, "inv_axe_01", 1, 54, 60),
  mockItem(7002, "Arctic Buckler", 2, "inv_shield_09", 1, 46, 50, 6),
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
  {
    id: 1010,
    title: "Bathran's Hair",
    status: 3,
    timerMs: 0,
    objectives: [{ kind: "item", id: 5437, current: 3, required: 5, item: mockItem(5437, "Bathran's Hair", 1, "inv_misc_herb_08") }],
    rewards: { guaranteed: [mockItem(5465, "Small Spider Leg", 1, "inv_misc_food_09", 3)], money: 4200, xp: 850 },
  },
  {
    id: 1056,
    title: "Journey to Stonetalon Peak",
    status: 3,
    timerMs: 0,
    objectives: [{ kind: "creature", id: 16534, name: "Stonetalon Protector", current: 0, required: 6 }],
    rewards: { guaranteed: [mockItem(17056, "Light Feather", 1, "inv_feather_04", 5)], money: 1800, xp: 1200 },
  },
  {
    id: 1022,
    title: "The Howling Vale",
    status: 1,
    timerMs: 0,
    objectives: [{ kind: "object", id: 19027, name: "Howling Vale Totem", current: 1, required: 1 }],
    rewards: { choices: [mockItem(15230, "Ridge Cleaver", 2, "inv_axe_01"), mockItem(7002, "Arctic Buckler", 2, "inv_shield_09")], money: 7600, xp: 1800, honor: 10 },
  },
  {
    id: 976,
    title: "Supplies to Auberdine",
    status: 3,
    timerMs: 438000,
    objectives: [{ kind: "item", id: 12342, current: 1, required: 1, item: mockItem(12342, "Blackwood Grain", 1, "inv_misc_food_14") }],
    rewards: { guaranteed: [mockItem(929, "Healing Potion", 1, "inv_potion_51", 2)], money: 3200, xp: 950 },
  },
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

function factionForBot(bot: Pick<RosterBot, "raceId" | "faction">): Faction | null {
  const suppliedFaction = bot.faction?.trim().toLowerCase();
  if (suppliedFaction === "alliance" || suppliedFaction === "horde") return suppliedFaction;
  if (ALLIANCE_RACES.has(bot.raceId)) return "alliance";
  if (HORDE_RACES.has(bot.raceId)) return "horde";
  return null;
}

function itemLevelFromSnapshot(snapshot: Snapshot): number {
  const itemLevels = snapshot.equipment
    .map((entry) => entry.item?.itemLevel)
    .filter((level): level is number => typeof level === "number" && level > 0);
  if (!itemLevels.length) return 0;
  return Math.round(itemLevels.reduce((total, level) => total + level, 0) / itemLevels.length);
}

function rosterItemLevel(bot: Pick<RosterBot, "guid" | "itemLevel">, cachedLevels: Record<number, number>): number {
  return bot.itemLevel && bot.itemLevel > 0 ? bot.itemLevel : cachedLevels[bot.guid] ?? 0;
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

const OBJECTIVE_LABELS: Record<Objective["kind"], string> = {
  creature: "Creature",
  object: "GameObject",
  item: "Item",
  player: "Player",
};

function itemIconUrl(icon: string): string {
  return icon.startsWith("http")
    ? icon
    : `https://wow.zamimg.com/images/wow/icons/large/${icon.toLowerCase()}.jpg`;
}

function objectiveName(objective: Objective): string {
  return objective.item?.name || objective.name || `${OBJECTIVE_LABELS[objective.kind]} #${objective.id}`;
}

function findSnapshotItem(snapshot: Snapshot, itemId: number): ItemData | undefined {
  for (const entry of snapshot.equipment) {
    if (entry.item?.id === itemId) return entry.item;
  }
  for (const bag of snapshot.bags) {
    for (const item of bag.items) {
      if (item?.id === itemId) return item;
    }
  }
  return undefined;
}

function ItemTooltip({ item, x, y }: { item: ItemData; x: number; y: number }) {
  const value = money(item.vendorValue);
  const armorType = itemArmorType(item);
  return createPortal(
    <div className="wow-item-tooltip" style={{ left: x, top: y }}>
      <div className={`tooltip-name quality-text-${Math.min(item.quality, 5)}`}>{item.name}</div>
      <div>Item Level {item.itemLevel}</div>
      {armorType && <div className="tooltip-armor-type">Armor Type: {armorType}</div>}
      {item.requiredLevel > 0 && <div>Requires Level {item.requiredLevel}</div>}
      {item.soulbound && <div>Soulbound</div>}
      {item.armor > 0 && <div>{item.armor} Armor</div>}
      {item.damageMax > 0 && <div className="tooltip-split"><span>{item.damageMin.toFixed(0)} - {item.damageMax.toFixed(0)} Damage</span><span>Speed {(item.speed / 1000).toFixed(2)}</span></div>}
      {item.stats.map((stat, index) => <div key={`${stat.type}-${index}`}>+{stat.value} {STAT_NAMES[stat.type] || `Stat ${stat.type}`}</div>)}
      {item.enchants.map((enchant) => <div className="tooltip-enchant" key={`e-${enchant.id}`}>{enchant.name}</div>)}
      {item.gems.map((gem) => <div className="tooltip-gem" key={`g-${gem.id}`}>◆ {gem.name}</div>)}
      {item.maxDurability > 0 && <div>Durability {item.durability} / {item.maxDurability}</div>}
      {item.count > 1 && <div>Stack Count: {item.count}</div>}
      {item.vendorValue > 0 && <div className="tooltip-vendor">Sell Price: {value.gold > 0 && <><i className="coin gold" /> {value.gold}</>} {value.silver > 0 && <><i className="coin silver" /> {value.silver}</>} <i className="coin copper" /> {value.copper}</div>}
      <div className="tooltip-debug">Item ID: {item.id}</div>
    </div>,
    document.body,
  );
}

function ItemCell({ item, label, compact = false }: { item: ItemData | null; label?: string; compact?: boolean }) {
  const quality = item ? Math.min(item.quality, QUALITY_NAMES.length - 1) : 0;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const enter = (event: MouseEvent<HTMLDivElement>) => {
    if (!item) return;
    const { clientX, clientY } = event;
    timer.current = setTimeout(() => setTooltip({
      x: Math.max(8, Math.min(clientX + 14, window.innerWidth - 340)),
      y: Math.max(8, Math.min(clientY + 16, window.innerHeight - 340)),
    }), 85);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setTooltip(null);
  };
  return (
    <div className={`item-cell quality-${quality} ${compact ? "compact" : ""} ${item ? "filled" : "empty"}`} aria-label={item?.name || label || "Empty slot"} onMouseEnter={enter} onMouseLeave={leave}>
      {item?.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={itemIconUrl(item.icon)} alt="" loading="lazy" />
      ) : <span className="empty-rune">·</span>}
      {item && item.count > 1 && <span className="item-count">{item.count}</span>}
      {item && item.maxDurability > 0 && item.durability / item.maxDurability < 0.3 && <span className="broken-mark">!</span>}
      {item && tooltip && <ItemTooltip item={item} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}

function ObjectiveTooltip({ objective, x, y }: { objective: Objective; x: number; y: number }) {
  return createPortal(
    <div className="wow-item-tooltip" style={{ left: x, top: y }}>
      <div className="tooltip-name">{objectiveName(objective)}</div>
      <div>{OBJECTIVE_LABELS[objective.kind]} objective</div>
      <div className="tooltip-debug">Entry ID: {objective.id}</div>
    </div>,
    document.body,
  );
}

function ObjectiveCell({ objective }: { objective: Objective }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const enter = (event: MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = event;
    timer.current = setTimeout(() => setTooltip({
      x: Math.max(8, Math.min(clientX + 14, window.innerWidth - 340)),
      y: Math.max(8, Math.min(clientY + 16, window.innerHeight - 220)),
    }), 85);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setTooltip(null);
  };
  const icon = objective.icon ? itemIconUrl(objective.icon) : "";
  return (
    <button type="button" className="objective-cell" aria-label={objectiveName(objective)} onMouseEnter={enter} onMouseLeave={leave}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" loading="lazy" />
      ) : <span className="objective-glyph">{OBJECTIVE_LABELS[objective.kind][0]}</span>}
      {tooltip && <ObjectiveTooltip objective={objective} x={tooltip.x} y={tooltip.y} />}
    </button>
  );
}

function ObjectiveTarget({ objective, snapshot }: { objective: Objective; snapshot: Snapshot }) {
  const item = objective.item ?? (objective.kind === "item" ? findSnapshotItem(snapshot, objective.id) : undefined);
  return (
    <div className="objective-target">
      {item ? <ItemCell item={item} compact label={objectiveName(objective)} /> : <ObjectiveCell objective={objective} />}
      <span className="objective-target-name">{objectiveName(objective)}</span>
    </div>
  );
}

function RewardItem({ item }: { item: ItemData }) {
  return (
    <div className="quest-reward-item">
      <ItemCell item={item} compact />
      <span>{item.name}{item.count > 1 ? ` ×${item.count}` : ""}</span>
    </div>
  );
}

function QuestRewardPanel({ rewards }: { rewards?: QuestRewards }) {
  const guaranteed = rewards?.guaranteed ?? [];
  const choices = rewards?.choices ?? [];
  const hasMoney = (rewards?.money ?? 0) > 0;
  const hasExtras = (rewards?.xp ?? 0) > 0 || (rewards?.honor ?? 0) > 0;
  if (!guaranteed.length && !choices.length && !hasMoney && !hasExtras) return null;
  const rewardCount = guaranteed.length + choices.length;
  return (
    <details className="quest-rewards">
      <summary>Rewards <span>{rewardCount || "details"}</span></summary>
      {guaranteed.length > 0 && <div className="quest-reward-group"><strong>Guaranteed</strong><div className="quest-reward-items">{guaranteed.map((item) => <RewardItem key={item.id} item={item} />)}</div></div>}
      {choices.length > 0 && <div className="quest-reward-group"><strong>Choose one</strong><div className="quest-reward-items">{choices.map((item) => <RewardItem key={item.id} item={item} />)}</div></div>}
      {hasMoney && <div className="quest-reward-stat">Money <span>{(() => { const value = money(rewards?.money ?? 0); return <>{value.gold > 0 && <><i className="coin gold" /> {value.gold} </>}{value.silver > 0 && <><i className="coin silver" /> {value.silver} </>}<i className="coin copper" /> {value.copper}</>; })()}</span></div>}
      {hasExtras && <div className="quest-reward-stat">Extra <span>{(rewards?.xp ?? 0) > 0 && `${rewards?.xp?.toLocaleString("en-US")} XP`}{(rewards?.xp ?? 0) > 0 && (rewards?.honor ?? 0) > 0 ? " · " : ""}{(rewards?.honor ?? 0) > 0 && `${rewards?.honor} honor`}</span></div>}
    </details>
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
      <div className="meter-numbers">{current.toLocaleString("en-US")} / {maximum.toLocaleString("en-US")}</div>
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
  const [factionFilters, setFactionFilters] = useState<Record<Faction, boolean>>({ alliance: true, horde: true });
  const [rosterSort, setRosterSort] = useState<RosterSort>("name");
  const [itemLevels, setItemLevels] = useState<Record<number, number>>({});
  const [historySearch, setHistorySearch] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const connectionKey = connection ? JSON.stringify(connection) : "demo";
  const selectedBot = roster.find((bot) => bot.guid === selectedGuid) ?? roster[0];
  const classInfo = CLASSES[snapshot.classId] ?? { name: "Unknown", color: "#82b7ad", sigil: "?", icon: "question" as ClassIcon };
  const coin = money(snapshot.gold);
  const filteredRoster = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const visibleFactions = (faction: Faction | null) => faction === null
      ? factionFilters.alliance && factionFilters.horde
      : factionFilters[faction];
    const matches = roster.filter((bot) => {
      const matchesSearch = !needle || `${bot.name} ${bot.area} ${RACES[bot.raceId] ?? ""} ${CLASSES[bot.classId]?.name ?? ""}`.toLowerCase().includes(needle);
      return matchesSearch && visibleFactions(factionForBot(bot));
    });
    return matches.sort((left, right) => {
      if (rosterSort === "name") return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      if (rosterSort === "level") return right.level - left.level || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      const leftItemLevel = rosterItemLevel(left, itemLevels);
      const rightItemLevel = rosterItemLevel(right, itemLevels);
      return rightItemLevel - leftItemLevel || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }, [roster, search, factionFilters, rosterSort, itemLevels]);
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
    if (!connection || rosterSort !== "itemLevel") return;
    const missingBots = roster.filter((bot) => !(bot.itemLevel && bot.itemLevel > 0) && !Object.hasOwn(itemLevels, bot.guid));
    if (!missingBots.length) return;
    let cancelled = false;
    const loadItemLevels = async () => {
      const results = await Promise.all(missingBots.map(async (bot) => {
        try {
          const data = await aquariumRequest<Snapshot>(connection, "inspect", bot.guid);
          return { guid: bot.guid, level: itemLevelFromSnapshot(data) };
        } catch {
          return { guid: bot.guid, level: 0 };
        }
      }));
      if (cancelled) return;
      setItemLevels((current) => results.reduce((next, result) => ({ ...next, [result.guid]: result.level }), current));
    };
    void loadItemLevels();
    return () => { cancelled = true; };
  }, [connection, roster, rosterSort, itemLevels]);

  useEffect(() => {
    if (!connection || !selectedGuid) return;
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
  }, [connectionKey, connection, selectedGuid]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnecting(true);
    setError("");
    try {
      const data = await aquariumRequest<{ bots: RosterBot[] }>(connectionDraft, "roster");
      setConnection(connectionDraft);
      setRoster(data.bots);
      setItemLevels({});
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
    setItemLevels({});
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
            <div><p className="eyebrow">THE COHORT</p><h2>{filteredRoster.length === roster.length ? roster.length : `${filteredRoster.length}/${roster.length}`} altbots</h2></div>
            <span className="online-count">{roster.filter((bot) => bot.online).length} awake</span>
          </div>
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a bot, class, or zone" aria-label="Find an altbot" /></label>
          <div className="cohort-controls">
            <div className="faction-filters" aria-label="Faction filters">
              <span className="control-label">Show</span>
              {(["alliance", "horde"] as Faction[]).map((faction) => (
                <label className={`faction-toggle ${faction} ${factionFilters[faction] ? "active" : ""}`} key={faction}>
                  <input
                    type="checkbox"
                    checked={factionFilters[faction]}
                    onChange={() => setFactionFilters((current) => ({ ...current, [faction]: !current[faction] }))}
                    aria-label={`Show ${FACTION_LABELS[faction]}`}
                  />
                  <span className="toggle-track" aria-hidden="true"><i /></span>
                  <span>{FACTION_LABELS[faction]}</span>
                </label>
              ))}
            </div>
            <label className="sort-control">
              <span className="control-label">Sort by</span>
              <select value={rosterSort} onChange={(event) => setRosterSort(event.target.value as RosterSort)} aria-label="Sort the cohort">
                <option value="name">Name</option>
                <option value="level">Level</option>
                <option value="itemLevel">Item level</option>
              </select>
            </label>
          </div>
          <div className="roster-list">
            {filteredRoster.length ? filteredRoster.map((bot) => {
              const botClass = CLASSES[bot.classId] ?? { name: "Unknown", color: "#82b7ad", sigil: "?", icon: "question" as ClassIcon };
              const botItemLevel = rosterItemLevel(bot, itemLevels);
              return (
                <button key={bot.guid} className={`roster-card ${bot.guid === selectedGuid ? "selected" : ""}`} onClick={() => setSelectedGuid(bot.guid)} style={{ "--bot-color": botClass.color } as CSSProperties}>
                  <span className="roster-avatar"><ClassIcon icon={botClass.icon} /></span>
                  <span className="roster-copy"><strong>{bot.name}</strong><small>Lv {bot.level} {RACES[bot.raceId] ?? "Unknown"} {botClass.name} · iLvl {botItemLevel || "—"}</small><span>{bot.online ? bot.area || "Somewhere suspicious" : "Sleeping"}</span></span>
                  <span className={`state-dot ${bot.online ? bot.state.replace("-", "") : "offline"}`} />
                </button>
              );
            }) : <div className="roster-empty">No altbots match these filters.</div>}
          </div>
          <div className="roster-footer"><span>Refreshes every 10s</span><span>{connection ? "SOAP" : "Sample cohort"}</span></div>
        </aside>

        <section className="bot-detail">
          <article className="identity-card panel">
            <div className="identity-primary">
              <div className="hero-avatar"><ClassIcon icon={classInfo.icon} /><i className={selectedBot?.online === false ? "offline" : ""} /></div>
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
                {(["brain", "quests", "history"] as AquariumTab[]).map((candidate) => <button key={candidate} className={tab === candidate ? "active" : ""} onClick={() => setTab(candidate)}>{candidate === "brain" ? "Brain" : candidate === "quests" ? `Quests ${snapshot.quests.length}` : `Completed ${completed.length}`}</button>)}
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
                  {quest.objectives.length > 0 ? <div className="objectives">{quest.objectives.map((objective, index) => <div className="objective" key={`${objective.kind}-${objective.id}-${index}`}><div><ObjectiveTarget objective={objective} snapshot={snapshot} /><strong>{objective.current}/{objective.required}</strong></div><div className="objective-track"><i style={{ width: `${percent(objective.current, objective.required)}%` }} /></div></div>)}</div> : <p className="quest-quiet">No countable objective. Probably walking or talking.</p>}
                  <QuestRewardPanel rewards={quest.rewards} />
                </article>)}</div>
              </div>}

              {tab === "history" && <div className="tab-body history-tab">
                <div className="tab-intro"><div><p className="eyebrow">REWARDED QUESTS</p><h3>{completed.length} known victories</h3></div></div>
                <label className="search-box history-search"><span aria-hidden="true">⌕</span><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Filter by title or quest ID" aria-label="Filter completed quests" /></label>
                <div className="history-list">{filteredHistory.map((quest) => <div className="history-row" key={quest.id}><span>#{quest.id}</span><strong>{quest.title}</strong><i>✓</i></div>)}</div>
                <p className="history-footnote">Dropped quest history will join us later, once it actually exists.</p>
              </div>}

              <footer className="panel-footer"><span><i className={connection ? "pulse" : ""} /> Updated {lastUpdated ? lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Starting"}</span><span>{connection ? "Selected bot refreshes every 2s" : "Exploring sample data"}</span></footer>
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
