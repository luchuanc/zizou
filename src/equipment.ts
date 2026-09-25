import { hero, type HeroId } from "./data";
export interface ItemStats {
  hp?: number;
  atk?: number;
  power?: number;
  speed?: number;
  armor?: number;
  mana?: number;
  regen?: number;
  lifesteal?: number;
  shield?: number;
  crit?: number;
  manaHit?: number;
  burn?: number;
  shred?: number;
  execute?: number;
  revive?: number;
}
export interface Equipment {
  id: string;
  name: string;
  glyph: string;
  description: string;
  stats: ItemStats;
  parts?: [string, string];
}
export const COMPONENTS: Equipment[] = [
  {
    id: "blade",
    name: "玄铁剑",
    glyph: "剑",
    description: "攻击 +12%",
    stats: { atk: 0.12 },
  },
  {
    id: "bow",
    name: "疾风弓",
    glyph: "弓",
    description: "攻速 +12%",
    stats: { speed: 0.12 },
  },
  {
    id: "rod",
    name: "灵玉杖",
    glyph: "杖",
    description: "技能强度 +15%",
    stats: { power: 0.15 },
  },
  {
    id: "tear",
    name: "天河泪",
    glyph: "泪",
    description: "初始法力 +15",
    stats: { mana: 15 },
  },
  {
    id: "armor",
    name: "玄武甲",
    glyph: "甲",
    description: "护甲 +20",
    stats: { armor: 20 },
  },
  {
    id: "cloak",
    name: "云霞衣",
    glyph: "衣",
    description: "生命 +100，技能强度 +5%",
    stats: { hp: 100, power: 0.05 },
  },
  {
    id: "belt",
    name: "蟠龙带",
    glyph: "带",
    description: "生命 +160",
    stats: { hp: 160 },
  },
  {
    id: "glove",
    name: "灵犀手",
    glyph: "拳",
    description: "每四次普攻，造成额外 40% 伤害",
    stats: { crit: 0.4 },
  },
];
const names = [
  [
    "开天斧",
    "逐日弓",
    "两仪剑",
    "青龙枪",
    "破军刃",
    "饮血刃",
    "血战旗",
    "无双刃",
  ],
  ["追风弩", "怒莲弓", "雷鸣弓", "伏魔弩", "斩妖弩", "巨灵弓", "穿云弓"],
  ["太虚冠", "星河卷", "离火珠", "九转丹", "焚天书", "通玄印"],
  ["归元鼎", "冰心镜", "观星盘", "甘露瓶", "天机符"],
  ["不动铠", "龙鳞铠", "日轮甲", "镇岳盾"],
  ["避劫衣", "长生衣", "净心玉"],
  ["万寿袍", "破浪带"],
  ["天罡拳"],
];
const extra: Record<string, ItemStats> = {
  "blade+blade": { atk: 0.32 },
  "blade+bow": { speed: 0.15 },
  "blade+rod": { power: 0.3 },
  "blade+tear": { manaHit: 8 },
  "blade+armor": { shred: 12 },
  "blade+cloak": { lifesteal: 0.25 },
  "blade+belt": { shield: 0.3 },
  "blade+glove": { crit: 0.8 },
  "bow+bow": { speed: 0.3 },
  "bow+rod": { speed: 0.18, power: 0.2 },
  "bow+tear": { manaHit: 6 },
  "bow+armor": { shred: 15 },
  "bow+cloak": { execute: 0.12 },
  "bow+belt": { atk: 0.25 },
  "bow+glove": { crit: 0.65 },
  "rod+rod": { power: 0.65 },
  "rod+tear": { manaHit: 7 },
  "rod+armor": { burn: 0.018 },
  "rod+cloak": { lifesteal: 0.2 },
  "rod+belt": { burn: 0.025 },
  "rod+glove": { power: 0.3, crit: 0.5 },
  "tear+tear": { manaHit: 10 },
  "tear+armor": { armor: 30 },
  "tear+cloak": { power: 0.3 },
  "tear+belt": { regen: 0.018 },
  "tear+glove": { mana: 30 },
  "armor+armor": { armor: 60 },
  "armor+cloak": { hp: 240, regen: 0.009 },
  "armor+belt": { burn: 0.02 },
  "armor+glove": { shield: 0.35 },
  "cloak+cloak": { hp: 400, regen: 0.015 },
  "cloak+belt": { revive: 0.3 },
  "cloak+glove": { shield: 0.3 },
  "belt+belt": { hp: 550 },
  "belt+glove": { lifesteal: 0.2 },
  "glove+glove": { crit: 1.2, atk: 0.15 },
};
const statNames: Record<keyof ItemStats, string> = {
  hp: "生命",
  atk: "攻击",
  power: "技能强度",
  speed: "攻速",
  armor: "护甲",
  mana: "初始法力",
  regen: "每秒回复最大生命",
  lifesteal: "伤害吸血",
  shield: "开战护盾",
  crit: "每四次普攻额外伤害",
  manaHit: "普攻额外回蓝",
  burn: "普攻附带灼烧",
  shred: "普攻破甲",
  execute: "斩杀血线",
  revive: "一次复苏生命",
};
export function describeStats(stats: ItemStats) {
  return Object.entries(stats)
    .map(
      ([k, v]) =>
        `${statNames[k as keyof ItemStats]} +${["hp", "armor", "mana", "manaHit", "shred"].includes(k) ? v : Math.round(v * 100) + "%"}`,
    )
    .join(" · ");
}
export const EQUIPMENT: Equipment[] = [...COMPONENTS];
for (let i = 0; i < COMPONENTS.length; i++)
  for (let j = i; j < COMPONENTS.length; j++) {
    const a = COMPONENTS[i],
      b = COMPONENTS[j],
      stats: ItemStats = {};
    for (const source of [a.stats, b.stats, extra[`${a.id}+${b.id}`] ?? {}])
      for (const [k, v] of Object.entries(source))
        stats[k as keyof ItemStats] = (stats[k as keyof ItemStats] ?? 0) + v;
    EQUIPMENT.push({
      id: `${a.id}_${b.id}`,
      name: names[i][j - i],
      glyph: names[i][j - i][0],
      description: describeStats(stats),
      stats,
      parts: [a.id, b.id],
    });
  }
export const item = (id: string) => EQUIPMENT.find((x) => x.id === id)!;
export function combine(a: string, b: string) {
  return (
    EQUIPMENT.find(
      (x) =>
        x.parts &&
        ((x.parts[0] === a && x.parts[1] === b) ||
          (x.parts[0] === b && x.parts[1] === a)),
    )?.id ?? null
  );
}
export function itemStats(ids: string[] = []) {
  const stats: ItemStats = {};
  for (const id of ids)
    for (const [k, v] of Object.entries(item(id)?.stats ?? {}))
      stats[k as keyof ItemStats] = (stats[k as keyof ItemStats] ?? 0) + v;
  return stats;
}
export function itemFit(id: string, heroId: HeroId) {
  const h = hero(heroId),
    s = item(id).stats;
  return (
    (s.hp ?? 0) / 60 +
    (s.armor ?? 0) / 8 +
    (s.atk ?? 0) * (h.role === "游侠" || h.role === "战将" ? 70 : 20) +
    (s.power ?? 0) * (h.role === "术士" || h.role === "灵祝" ? 80 : 25) +
    (s.speed ?? 0) * 45 +
    (s.manaHit ?? 0) * 4 +
    (s.lifesteal ?? 0) * 45 +
    (s.regen ?? 0) * 700 +
    (s.shield ?? 0) * 30
  );
}
export function equipInto(items: string[], incoming: string) {
  const list = [...items];
  const partIndex = list.findIndex(
    (id) => !item(id).parts && !item(incoming).parts,
  );
  if (partIndex >= 0) {
    list[partIndex] = combine(list[partIndex], incoming)!;
    return list;
  }
  return list.length < 3 ? [...list, incoming] : null;
}
