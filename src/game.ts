import {
  BOARD_CELLS,
  PLAYER_START,
  MAX_LEVEL,
  PREP_SECONDS,
  roundInfo,
  streakIncome,
  baseIncome,
} from "./rules";
import { BENCH_SIZE } from "./rules";
import { availableCopies } from "./pool";
import { validLineupPlan, type LineupPlan } from "./lineup";
import {
  COMPONENTS,
  EQUIPMENT,
  item,
  combine,
  equipInto,
  itemFit,
} from "./equipment";
import { Battle } from "./battle";
import {
  HEROES,
  BUILDS,
  RELICS,
  TRAITS,
  XP_NEEDED,
  MAX_ROUNDS,
  EVENTS,
  hero,
  type HeroId,
} from "./data";
import {
  createRivals,
  applyAugment,
  equipRival,
  mergeRival,
  prepareRival,
  rivalArmy,
  payRival,
  resolveOtherMatches,
  damageFor,
  rollShop,
  type Rival,
} from "./ai";

export interface Unit {
  items?: string[];
  neutral?: number;
  uid: string;
  heroId: HeroId;
  star: number;
  position: number | null;
}
export type Phase =
  "prepare" | "battle" | "result" | "relic" | "event" | "carousel" | "ended";
export interface CarouselOffer {
  id: string;
  heroId: HeroId;
  itemId: string;
  claimedBy: string | null;
}
export interface Carousel {
  offers: CarouselOffer[];
  order: string[];
  turn: number;
}
export interface RoundResult {
  loot?: string[];
  draw?: boolean;
  won: boolean;
  damage: number;
  income: number;
  interest: number;
  survivors: number;
  time: number;
  damageByUnit: Record<string, number>;
  opponentName: string;
  opponentDamage: number;
  reports: string[];
}
export interface GameState {
  version: 3;
  inventory: string[];
  carousel: Carousel | null;
  relicRerolls: boolean[];
  preparation: number;
  autoAdvance: boolean;
  lineupPlan: LineupPlan | null;
  lineupPromptSeen: boolean;
  phase: Phase;
  round: number;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  wins: number;
  streak: number;
  units: Unit[];
  shop: (HeroId | null)[];
  locked: boolean;
  relics: string[];
  relicChoices: string[];
  nextUid: number;
  seed: number;
  result: RoundResult | null;
  rivals: Rival[];
  opponentId: string;
  recentOpponents: string[];
  eventId: string | null;
  rank: number | null;
  difficulty: "normal" | "expert";
  matchId: string;
}
export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const SAVE_KEY = "shanhai-yi.save.v3";
export { BENCH_SIZE } from "./rules";
export function traits(units: Unit[]) {
  const counts: Record<string, number> = {};
  const ids = new Set(
    units.filter((u) => u.position !== null).map((u) => u.heroId),
  );
  for (const id of ids) {
    const h = hero(id);
    for (const t of [h.origin, h.role]) counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      tier: TRAITS[name].thresholds.filter((t) => count >= t).length,
    }))
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
}
export const starScale = (star: number) => [1, 1.8, 3.3][star - 1] ?? 1;
export const sellPrice = (unit: Unit) =>
  hero(unit.heroId).cost * 3 ** (unit.star - 1);
export function validateSave(raw: unknown): raw is GameState {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as GameState;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  if (
    s.version !== 3 ||
    ![
      "prepare",
      "battle",
      "result",
      "relic",
      "event",
      "carousel",
      "ended",
    ].includes(s.phase)
  )
    return false;
  if (
    !int(s.round, 1, MAX_ROUNDS) ||
    !int(s.hp, 0, 100) ||
    !int(s.gold, 0, 100000) ||
    !int(s.level, 1, MAX_LEVEL) ||
    !int(s.xp, 0, 100) ||
    !int(s.nextUid, 1, 1000000) ||
    !int(s.seed, 0, 4294967295) ||
    !int(s.wins, 0, MAX_ROUNDS) ||
    !int(s.streak, -MAX_ROUNDS, MAX_ROUNDS)
  )
    return false;
  if (
    typeof s.locked !== "boolean" ||
    !Array.isArray(s.units) ||
    s.units.length > MAX_LEVEL + BENCH_SIZE ||
    !Array.isArray(s.shop) ||
    s.shop.length !== 5
  )
    return false;
  const validItems = (items: unknown, limit = 150): items is string[] =>
    Array.isArray(items) &&
    items.length <= limit &&
    items.every((id) => typeof id === "string" && !!item(id));
  if (
    !validItems(s.inventory) ||
    !int(s.preparation, 0, PREP_SECONDS) ||
    typeof s.autoAdvance !== "boolean" ||
    !validLineupPlan(s.lineupPlan) ||
    typeof s.lineupPromptSeen !== "boolean" ||
    !Array.isArray(s.relicRerolls) ||
    s.relicRerolls.length !== 3 ||
    s.relicRerolls.some((v) => typeof v !== "boolean")
  )
    return false;
  if (s.carousel !== null) {
    const c = s.carousel;
    if (
      !c ||
      !Array.isArray(c.offers) ||
      c.offers.length !== 9 ||
      new Set(c.offers.map((o) => o?.id)).size !== 9 ||
      !Array.isArray(c.order) ||
      c.order.length > 8 ||
      new Set(c.order).size !== c.order.length ||
      c.order.some((id) => id !== "player" && !/^r[0-6]$/.test(id)) ||
      !int(c.turn, 0, 8) ||
      c.offers.some(
        (o) =>
          !o ||
          !/^c[0-8]$/.test(o.id) ||
          !hero(o.heroId) ||
          !item(o.itemId) ||
          (o.claimedBy !== null && !c.order.includes(o.claimedBy)),
      )
    )
      return false;
  }
  if (
    s.phase === "carousel" &&
    (!s.carousel || s.carousel.order[s.carousel.turn] !== "player")
  )
    return false;
  const ids = new Set(HEROES.map((h) => h.id));
  const positions = new Set<number>(),
    uids = new Set<string>();
  for (const u of s.units) {
    if (
      !u ||
      typeof u.uid !== "string" ||
      !/^u\d+$/.test(u.uid) ||
      uids.has(u.uid) ||
      Number(u.uid.slice(1)) >= s.nextUid ||
      !ids.has(u.heroId) ||
      !int(u.star, 1, 3) ||
      !validItems(u.items ?? [], 3)
    )
      return false;
    uids.add(u.uid);
    if (u.position !== null) {
      if (
        !int(u.position, PLAYER_START, BOARD_CELLS - 1) ||
        positions.has(u.position)
      )
        return false;
      positions.add(u.position);
    }
  }
  if (
    s.units.filter((u) => u.position === null).length > BENCH_SIZE ||
    positions.size > s.level
  )
    return false;
  if (s.shop.some((id) => id !== null && !ids.has(id))) return false;
  if (
    !Array.isArray(s.relics) ||
    !Array.isArray(s.relicChoices) ||
    s.relics.length > 3 ||
    s.relicChoices.length > 3
  )
    return false;
  if (
    [...s.relics, ...s.relicChoices].some(
      (id) => !RELICS.some((r) => r.id === id),
    ) ||
    new Set(s.relics).size !== s.relics.length
  )
    return false;
  if (
    s.phase === "relic" &&
    (s.relicChoices.length === 0 ||
      s.relicChoices.some((id) => s.relics.includes(id)))
  )
    return false;
  if (
    !Array.isArray(s.rivals) ||
    s.rivals.length !== 7 ||
    !["normal", "expert"].includes(s.difficulty) ||
    typeof s.matchId !== "string" ||
    !/^m\d+$/.test(s.matchId)
  )
    return false;
  for (const r of s.rivals) {
    if (
      !r ||
      !validItems(r.inventory) ||
      !/^r[0-6]$/.test(r.id) ||
      typeof r.name !== "string" ||
      r.name.length > 12 ||
      typeof r.glyph !== "string" ||
      r.glyph.length > 2 ||
      ![
        "kunlun",
        "dragon",
        "fox",
        "fire",
        "moon",
        "spirit",
        "immortal",
        "warrior",
      ].includes(r.buildId) ||
      !["balanced", "greedy", "aggressive"].includes(r.style) ||
      !int(r.hp, 0, 100) ||
      !int(r.gold, 0, 100000) ||
      !int(r.level, 1, MAX_LEVEL) ||
      !int(r.xp, 0, 100) ||
      !int(r.seed, 1, 4294967295) ||
      !int(r.nextUid, 1, 1000000) ||
      !int(r.wins, 0, MAX_ROUNDS) ||
      !int(r.streak, -MAX_ROUNDS, MAX_ROUNDS)
    )
      return false;
    if (r.eliminatedRound !== null && !int(r.eliminatedRound, 1, MAX_ROUNDS))
      return false;
    if (
      !Array.isArray(r.units) ||
      r.units.length > MAX_LEVEL + BENCH_SIZE ||
      !Array.isArray(r.shop) ||
      r.shop.length !== 5 ||
      r.shop.some((id) => id !== null && !ids.has(id)) ||
      !Array.isArray(r.relics) ||
      r.relics.some((id) => !RELICS.some((v) => v.id === id))
    )
      return false;
    const places = new Set<number>(),
      ruids = new Set<string>();
    for (const u of r.units) {
      if (
        !u ||
        typeof u.uid !== "string" ||
        !/^r[0-6]u\d+$/.test(u.uid) ||
        ruids.has(u.uid) ||
        !ids.has(u.heroId) ||
        !int(u.star, 1, 3) ||
        !validItems(u.items ?? [], 3)
      )
        return false;
      ruids.add(u.uid);
      if (u.position !== null) {
        if (
          !int(u.position, PLAYER_START, BOARD_CELLS - 1) ||
          places.has(u.position)
        )
          return false;
        places.add(u.position);
      }
    }
    if (
      places.size > r.level ||
      r.units.filter((u) => u.position === null).length > BENCH_SIZE ||
      typeof r.lastAction !== "string" ||
      r.lastAction.length > 100
    )
      return false;
  }
  if (
    new Set(s.rivals.map((r) => r.id)).size !== 7 ||
    !s.rivals.some((r) => r.id === s.opponentId) ||
    !Array.isArray(s.recentOpponents) ||
    s.recentOpponents.length > 3 ||
    s.recentOpponents.some((id) => !s.rivals.some((r) => r.id === id))
  )
    return false;
  if (s.eventId !== null && !EVENTS.some((e) => e.id === s.eventId))
    return false;
  if (s.phase === "event" && s.eventId === null) return false;
  if (s.rank !== null && !int(s.rank, 1, 8)) return false;
  if (s.phase === "ended" && s.rank === null) return false;
  if (s.phase !== "ended" && (s.hp === 0 || !s.rivals.some((r) => r.hp > 0)))
    return false;
  if (["result", "ended"].includes(s.phase)) {
    const r = s.result;
    if (
      !r ||
      typeof r.won !== "boolean" ||
      !int(r.damage, 0, 100) ||
      !int(r.income, 0, 100) ||
      !int(r.interest, 0, 7) ||
      (r.loot !== undefined && !validItems(r.loot)) ||
      (r.draw !== undefined && typeof r.draw !== "boolean") ||
      !int(r.survivors, 0, 10) ||
      !Number.isFinite(r.time) ||
      r.time < 0 ||
      !r.damageByUnit ||
      typeof r.damageByUnit !== "object"
    )
      return false;
    if (
      Object.values(r.damageByUnit).some((v) => !Number.isFinite(v) || v < 0) ||
      typeof r.opponentName !== "string" ||
      !int(r.opponentDamage, 0, 100) ||
      !Array.isArray(r.reports) ||
      r.reports.some((v) => typeof v !== "string" || v.length > 100)
    )
      return false;
  }
  return true;
}
export class Game {
  state: GameState;
  onChange: () => void = () => {};
  storageWarning = false;
  constructor(
    private storage?: SaveStore,
    private initialSeed?: number,
  ) {
    let saved: GameState | undefined;
    try {
      const data =
        storage?.getItem(SAVE_KEY) ?? storage?.getItem("shanhai-yi.save.v2");
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed?.version === 2) {
          storage?.setItem("shanhai-yi.save.v2.backup", data);
          parsed.version = 3;
          parsed.round = Math.min(
            MAX_ROUNDS,
            parsed.round + 3 + (parsed.phase === "relic" ? 1 : 0),
          );
          if (
            roundInfo(parsed.round).kind === "carousel" &&
            parsed.phase !== "ended"
          )
            parsed.round++;
          parsed.inventory = ["blade", "rod"];
          parsed.carousel = null;
          parsed.relicRerolls = [false, false, false];
          parsed.preparation = PREP_SECONDS;
          parsed.autoAdvance = true;
          for (const owner of [parsed, ...(parsed.rivals ?? [])]) {
            owner.inventory ??= ["blade", "rod"];
            for (const u of owner.units ?? [])
              if (u.position !== null) u.position += 7;
          }
        }
        if (parsed?.version === 3) {
          // Older saves keep their progress without reopening the new-game picker.
          if (parsed.lineupPlan === undefined) parsed.lineupPlan = null;
          if (parsed.lineupPromptSeen === undefined)
            parsed.lineupPromptSeen = true;
        }
        if (validateSave(parsed)) saved = parsed;
      }
    } catch {
      this.storageWarning = true;
    }
    this.state = saved ?? this.fresh();
    // Combat is replayed from the last formation; no round income or health is applied until settlement.
    if (this.state.phase === "battle") {
      this.state.phase = "prepare";
      this.state.preparation = PREP_SECONDS;
    }
    this.save();
  }
  private fresh(difficulty: "normal" | "expert" = "normal"): GameState {
    const seed = (this.initialSeed ?? Date.now()) >>> 0 || 1;
    const state: GameState = {
      version: 3,
      inventory: ["blade", "rod"],
      carousel: null,
      relicRerolls: [false, false, false],
      preparation: PREP_SECONDS,
      autoAdvance: true,
      lineupPlan: null,
      lineupPromptSeen: false,
      phase: "prepare",
      round: 1,
      hp: 100,
      gold: 5,
      level: 1,
      xp: 0,
      wins: 0,
      streak: 0,
      units: [{ uid: "u1", heroId: "nezha", star: 1, position: 31, items: [] }],
      shop: ["nezha", "nezha", "xuanwu", "jiang", "jingwei"],
      locked: false,
      relics: [],
      relicChoices: [],
      nextUid: 2,
      seed,
      result: null,
      rivals: createRivals(seed),
      opponentId: "r0",
      recentOpponents: [],
      eventId: null,
      rank: null,
      difficulty,
      matchId: `m${Date.now()}`,
    };
    for (const rival of state.rivals) rival.shop = [];
    for (const rival of state.rivals) {
      rival.shop = rollShop(
        rival.level,
        () => {
          let n = state.seed;
          n ^= n << 13;
          n ^= n >>> 17;
          n ^= n << 5;
          state.seed = n >>> 0 || 1;
          return state.seed / 4294967296;
        },
        (id) => availableCopies(state, id),
      );
      prepareRival(rival, 1, [], (id) => availableCopies(state, id));
    }
    return state;
  }
  random() {
    let n = this.state.seed;
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    this.state.seed = n >>> 0 || 123456789;
    return this.state.seed / 4294967296;
  }
  save() {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      this.storageWarning = true;
    }
  }
  changed() {
    this.save();
    this.onChange();
  }
  restart(difficulty: "normal" | "expert" = this.state.difficulty) {
    this.state = this.fresh(difficulty);
    this.changed();
  }
  selectLineup(plan: LineupPlan | null) {
    if (!validLineupPlan(plan) || this.state.phase === "ended") return false;
    this.state.lineupPlan = plan === null ? null : structuredClone(plan);
    this.state.lineupPromptSeen = true;
    this.changed();
    return true;
  }
  dismissLineupPrompt() {
    if (this.state.lineupPromptSeen) return;
    this.state.lineupPromptSeen = true;
    this.save();
  }
  get deployed() {
    return this.state.units.filter((u) => u.position !== null);
  }
  get bench() {
    return this.state.units.filter((u) => u.position === null);
  }
  buy(index: number): string {
    const s = this.state;
    if (!["prepare", "battle"].includes(s.phase)) return "当前不能招募";
    const id = s.shop[index];
    if (!id) return "这位英灵已被招募";
    const h = hero(id);
    if (s.gold < h.cost) return "灵石不足";
    const merges =
      s.units.filter((u) => u.heroId === id && u.star === 1).length >= 2;
    if (this.bench.length >= BENCH_SIZE && !merges)
      return "备战席已满，请先上阵或出售英灵";
    s.gold -= h.cost;
    s.shop[index] = null;
    s.units.push({
      uid: `u${s.nextUid++}`,
      heroId: id,
      star: 1,
      position: null,
    });
    const merged = this.merge(id);
    this.changed();
    return merged
      ? `${h.name}升星！三位同星英灵已合一`
      : `${h.name}已加入备战席`;
  }
  private merge(id: HeroId) {
    let merged = false;
    for (let star = 1; star < 3; star++) {
      let matches = this.state.units
        .filter((u) => u.heroId === id && u.star === star)
        .sort(
          (a, b) => Number(a.position === null) - Number(b.position === null),
        );
      while (matches.length >= 3) {
        const [keep, ...consume] = matches.slice(0, 3);
        keep.star++;
        const gear = [keep, ...consume].flatMap((u) => u.items ?? []);
        keep.items = [];
        for (const id of gear) {
          const equipped = equipInto(keep.items, id);
          if (equipped) keep.items = equipped;
          else this.state.inventory.push(id);
        }
        this.state.units = this.state.units.filter((u) => !consume.includes(u));
        merged = true;
        matches = matches.slice(3);
      }
    }
    return merged;
  }
  move(uid: string, position: number | null): string | null {
    if (this.state.phase !== "prepare") return "战斗中不能调整阵容";
    const unit = this.state.units.find((u) => u.uid === uid);
    if (!unit) return "英灵不存在";
    if (
      position !== null &&
      (!Number.isInteger(position) ||
        position < PLAYER_START ||
        position >= BOARD_CELLS)
    )
      return "请放置在己方半场";
    if (unit.position === position) return null;
    const other =
      position === null
        ? undefined
        : this.state.units.find((u) => u.position === position);
    if (
      unit.position === null &&
      position !== null &&
      !other &&
      this.deployed.length >= this.state.level
    )
      return "上阵人数已满，修习可提升人口";
    if (position === null && this.bench.length >= BENCH_SIZE)
      return "备战席已满";
    if (other) other.position = unit.position;
    unit.position = position;
    this.changed();
    return null;
  }
  sell(uid: string) {
    if (!["prepare", "battle"].includes(this.state.phase))
      return "当前不能出售英灵";
    const u = this.state.units.find((u) => u.uid === uid);
    if (!u) return "请先选择英灵";
    if (this.state.phase === "battle" && u.position !== null)
      return "战斗中不能出售上阵英灵";
    const price = sellPrice(u);
    this.state.inventory.push(...(u.items ?? []));
    this.state.gold += price;
    this.state.units = this.state.units.filter((v) => v !== u);
    this.changed();
    return `已出售${hero(u.heroId).name}，获得 ${price} 灵石`;
  }
  roll(free = false) {
    const s = this.state;
    if (!["prepare", "battle"].includes(s.phase) && !free)
      return "战斗结束后才能刷新";
    if (!free && s.gold < 2) return "灵石不足";
    if (!free) s.gold -= 2;
    s.shop = [];
    s.shop = rollShop(
      s.level,
      () => this.random(),
      (id) => availableCopies(s, id),
    );
    if (!free) this.changed();
    return "新的英灵已应召而来";
  }
  addXP(amount: number) {
    const s = this.state;
    s.xp += amount;
    while (s.level < MAX_LEVEL && s.xp >= XP_NEEDED[s.level]) {
      s.xp -= XP_NEEDED[s.level];
      s.level++;
    }
    if (s.level === MAX_LEVEL) s.xp = 0;
  }
  buyXP() {
    const s = this.state;
    if (!["prepare", "battle"].includes(s.phase)) return "当前不能购买经验";
    if (s.level >= MAX_LEVEL) return "已达到最高境界";
    if (s.gold < 4) return "灵石不足";
    s.gold -= 4;
    this.addXP(4);
    this.changed();
    return "修习 +4，境界精进";
  }
  toggleLock() {
    if (!["prepare", "battle"].includes(this.state.phase)) return;
    this.state.locked = !this.state.locked;
    this.changed();
  }
  start() {
    if (this.state.phase !== "prepare") return false;

    this.state.phase = "battle";
    this.state.result = null;
    this.changed();
    return true;
  }
  settle(
    won: boolean,
    survivors: number,
    time: number,
    damageByUnit: Record<string, number>,
    allySurvivors = 1,
    draw = false,
  ) {
    const s = this.state;
    if (s.phase !== "battle") return false;
    if (draw) won = false;
    const pvp = roundInfo(s.round).kind === "pvp";
    const interest = Math.min(
      s.relics.includes("savings") ? 7 : 5,
      Math.floor(s.gold / 10),
    );
    if (pvp)
      s.streak = won ? Math.max(1, s.streak + 1) : Math.min(-1, s.streak - 1);
    const income =
      baseIncome(s.round) +
      interest +
      (won && pvp ? 1 : 0) +
      streakIncome(s.streak) +
      (s.relics.includes("coin") ? 2 : 0);
    const damage = won ? 0 : damageFor(s.round, survivors);
    s.hp = Math.max(0, s.hp - damage);
    s.gold += income;
    if (won && pvp) s.wins++;
    this.addXP(s.relics.includes("study") ? 4 : 2);
    const rival = s.rivals.find((r) => r.id === s.opponentId)!,
      opponentDamage =
        (won || draw) && pvp ? damageFor(s.round, allySurvivors) : 0;
    const reports = pvp
      ? resolveOtherMatches(s, rival.id)
      : this.resolvePveRivals();
    if (pvp) payRival(rival, !won && !draw, opponentDamage, s.round);
    const loot: string[] = [];
    if (!pvp && won) {
      for (let n = 0; n < (roundInfo(s.round).stage >= 3 ? 2 : 1); n++) {
        const id = COMPONENTS[Math.floor(this.random() * COMPONENTS.length)].id;
        s.inventory.push(id);
        loot.push(id);
      }
    }

    s.result = {
      won,
      draw,
      damage,
      income,
      interest,
      survivors,
      time,
      damageByUnit,
      opponentName: pvp ? rival.name : roundInfo(s.round).name,
      loot,
      opponentDamage,
      reports,
    };
    const alive = s.rivals.filter((r) => r.hp > 0).length;
    const ended = s.hp <= 0 || alive === 0 || s.round >= MAX_ROUNDS;
    if (ended) {
      s.rank =
        s.hp <= 0
          ? Math.min(8, alive + 1)
          : alive === 0
            ? 1
            : 1 +
              s.rivals.filter(
                (r) => r.hp > s.hp || (r.hp === s.hp && r.wins > s.wins),
              ).length;
    }
    s.phase = ended ? "ended" : "result";
    this.changed();
    return true;
  }
  continue() {
    if (this.state.phase === "result") this.nextRound();
  }
  chooseRelic(id: string) {
    const s = this.state;
    if (s.phase !== "relic" || !s.relicChoices.includes(id)) return false;
    s.relics.push(id);
    applyAugment(s, id, () => this.random());
    if (id === "study") this.addXP(12);
    s.relicChoices = [];
    s.phase = "prepare";
    s.preparation = PREP_SECONDS;
    this.changed();
    return true;
  }
  rerollRelic(index: number) {
    const s = this.state;
    if (
      s.phase !== "relic" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 2 ||
      s.relicRerolls[index]
    )
      return false;
    const pool = RELICS.filter(
      (r) => !s.relics.includes(r.id) && !s.relicChoices.includes(r.id),
    );
    if (!pool.length) return false;
    s.relicChoices[index] = pool[Math.floor(this.random() * pool.length)].id;
    s.relicRerolls[index] = true;
    this.changed();
    return true;
  }
  equipItem(index: number, uid: string) {
    const s = this.state,
      u = s.units.find((u) => u.uid === uid),
      id = s.inventory[index];
    if (!u || !id || !["prepare", "battle"].includes(s.phase))
      return "请选择可装备的英灵";
    if (s.phase === "battle" && u.position !== null)
      return "战斗中仅可为备战英灵装备";
    const next = equipInto(u.items ?? [], id);
    if (!next) return "每位英灵最多携带三件装备";
    u.items = next;
    s.inventory.splice(index, 1);
    this.changed();
    return `已为${hero(u.heroId).name}穿戴装备`;
  }
  combineItems(a: number, b: number) {
    const s = this.state;
    if (
      !["prepare", "battle"].includes(s.phase) ||
      a === b ||
      !s.inventory[a] ||
      !s.inventory[b]
    )
      return "请选择两件不同散件";
    const result = combine(s.inventory[a], s.inventory[b]);
    if (!result) return "仅基础装备可以两两合成";
    s.inventory.splice(Math.max(a, b), 1);
    s.inventory.splice(Math.min(a, b), 1, result);
    this.changed();
    return `合成${item(result).name}`;
  }
  setAuto(value: boolean) {
    this.state.autoAdvance = value;
    this.changed();
  }
  private resolvePveRivals() {
    const s = this.state,
      reports: string[] = [];
    for (const r of s.rivals) {
      if (r.hp <= 0) continue;
      const b = new Battle(s, {
        left: r.units.filter((u) => u.position !== null),
        right: neutralArmy(s.round),
        leftRelics: r.relics,
        rightRelics: [],
      });
      for (let i = 0; i < 610 && !b.done; i++) b.update(0.1);
      const won = b.winner === 0;
      payRival(r, won, damageFor(s.round, b.alive(1).length), s.round);
      if (won)
        for (let n = 0; n < (roundInfo(s.round).stage >= 3 ? 2 : 1); n++)
          r.inventory.push(
            COMPONENTS[Math.floor(this.random() * COMPONENTS.length)].id,
          );
      reports.push(
        `${r.name}${won ? "击败" : "负于"}${roundInfo(s.round).name}`,
      );
    }
    return reports;
  }
  private openCarousel() {
    const s = this.state,
      info = roundInfo(s.round);
    s.carousel = { offers: [], order: [], turn: 0 };
    for (let i = 0; i < 9; i++) {
      const pool = HEROES.filter(
        (h) =>
          h.cost === Math.min(5, info.stage) && availableCopies(s, h.id) > 0,
      );
      const fallback = pool.length
        ? pool
        : HEROES.filter((h) => availableCopies(s, h.id) > 0);
      const h = fallback[Math.floor(this.random() * fallback.length)];
      if (!h) throw new Error("选秀卡池不足");
      s.carousel.offers.push({
        id: `c${i}`,
        heroId: h.id,
        itemId: COMPONENTS[Math.floor(this.random() * COMPONENTS.length)].id,
        claimedBy: null,
      });
    }
    s.carousel.order = [
      { id: "player", hp: s.hp },
      ...s.rivals.filter((r) => r.hp > 0).map((r) => ({ id: r.id, hp: r.hp })),
    ]
      .map((v) => ({ ...v, tie: this.random() }))
      .sort((a, b) => a.hp - b.hp || a.tie - b.tie)
      .map((v) => v.id);
    s.phase = "carousel";
    this.advanceCarouselAi();
  }
  private receiveCarousel(owner: GameState | Rival, offer: CarouselOffer) {
    offer.claimedBy = "id" in owner ? owner.id : "player";
    const uid =
      "id" in owner ? `${owner.id}u${owner.nextUid++}` : `u${owner.nextUid++}`;
    const u: Unit = {
      uid,
      heroId: offer.heroId,
      star: 1,
      position: null,
      items: [offer.itemId],
    };
    if (
      owner.units.filter((u) => u.position === null).length >= BENCH_SIZE &&
      owner.units.filter((v) => v.heroId === u.heroId && v.star === 1).length <
        2
    ) {
      if (owner.units.filter((u) => u.position !== null).length < owner.level) {
        u.position = Array.from({ length: 28 }, (_, i) => 28 + i).find(
          (p) => !owner.units.some((v) => v.position === p),
        )!;
      } else {
        owner.gold += hero(u.heroId).cost;
        owner.inventory.push(offer.itemId);
        return;
      }
    }
    owner.units.push(u);
    if (owner === this.state) this.merge(u.heroId);
    else mergeRival(owner as Rival, u.heroId);
  }
  private advanceCarouselAi() {
    const s = this.state,
      c = s.carousel!;
    while (c.turn < c.order.length && c.order[c.turn] !== "player") {
      const r = s.rivals.find((r) => r.id === c.order[c.turn])!;
      const build = BUILDS.find((b) => b.id === r.buildId)!;
      const score = (o: CarouselOffer) =>
        (build.heroes.includes(o.heroId) ? 20 : 0) +
        r.units.filter((u) => u.heroId === o.heroId && u.star === 1).length *
          18 +
        Math.max(
          itemFit(o.itemId, o.heroId),
          ...r.units.map((u) => itemFit(o.itemId, u.heroId)),
        );
      const offers = c.offers
        .filter((o) => !o.claimedBy)
        .sort((a, b) => score(b) - score(a));
      this.receiveCarousel(r, offers[0]);
      c.turn++;
    }
  }
  chooseCarousel(id: string) {
    const s = this.state,
      c = s.carousel;
    if (s.phase !== "carousel" || !c || c.order[c.turn] !== "player")
      return false;
    const offer = c.offers.find((o) => o.id === id && !o.claimedBy);
    if (!offer) return false;
    this.receiveCarousel(s, offer);
    c.turn++;
    this.advanceCarouselAi();
    s.carousel = null;
    this.nextRound();
    return true;
  }
  private openEvent() {
    this.state.eventId = EVENTS[Math.floor(this.random() * EVENTS.length)].id;
    this.state.phase = "event";
    this.changed();
  }
  chooseEvent(id: string) {
    const s = this.state;
    if (s.phase !== "event") return "当前没有奇遇";
    const event = EVENTS.find((e) => e.id === s.eventId);
    if (!event?.choices.some((c) => c.id === id)) return "请选择当前奇遇";
    if (id === "trade" && s.hp <= 10) return "气血不足，无法签订此契";
    if (id === "gift" && this.bench.length >= BENCH_SIZE)
      return "备战席已满，请选择灵泉";
    if (id === "heal") s.hp = Math.min(100, s.hp + 15);
    if (id === "study") this.addXP(8);
    if (id === "trade") {
      s.hp -= 10;
      s.gold += 16;
    }
    if (id === "gold") s.gold += 7;
    if (id === "gift") {
      const pool = HEROES.filter((h) => h.cost === 3),
        h = pool[Math.floor(this.random() * pool.length)];
      s.units.push({
        uid: `u${s.nextUid++}`,
        heroId: h.id,
        star: 1,
        position: null,
      });
      this.merge(h.id);
    }
    s.eventId = null;
    this.nextRound();
    return "";
  }
  private nextRound() {
    const s = this.state;
    s.round++;
    s.phase = "prepare";
    s.preparation = PREP_SECONDS;
    s.result = null;
    if (!s.locked) this.roll(true);
    s.recentOpponents = [...s.recentOpponents, s.opponentId].slice(-3);
    for (const rival of s.rivals) {
      if (rival.hp <= 0) continue;
      prepareRival(
        rival,
        s.round,
        s.difficulty === "expert" ? s.units : [],
        (id) => availableCopies(s, id),
      );
    }
    const candidates = s.rivals.filter((r) => r.hp > 0);
    const unseen = candidates.filter(
      (r) => !s.recentOpponents.slice(-2).includes(r.id),
    );
    const pool = unseen.length ? unseen : candidates;
    s.opponentId = pool[Math.floor(this.random() * pool.length)].id;
    const info = roundInfo(s.round);
    if (info.kind === "carousel") this.openCarousel();
    else if (info.augment && s.relics.length < 3) {
      s.phase = "relic";
      s.relicRerolls = [false, false, false];
      s.relicChoices = RELICS.filter((r) => !s.relics.includes(r.id))
        .map((r) => ({ id: r.id, n: this.random() }))
        .sort((a, b) => a.n - b.n)
        .slice(0, 3)
        .map((r) => r.id);
    }
    this.changed();
  }
}

export function opponentUnits(s: GameState): Unit[] {
  if (roundInfo(s.round).kind === "pve") return neutralArmy(s.round);
  const r = s.rivals.find((r) => r.id === s.opponentId);
  return r ? rivalArmy(r) : enemies(Math.min(12, s.round));
}

export function enemies(round: number): Unit[] {
  const formations: HeroId[][] = [
    ["xuanwu", "nezha"],
    ["tiger", "fox"],
    ["aobing", "xuanwu", "change"],
    ["erlang", "nezha", "jiang"],
    ["tiger", "change", "fox", "lei"],
    ["fox", "nuwa", "xuanwu", "tiger"],
    ["aobing", "xuanwu", "erlang", "change", "lei"],
    ["xuanwu", "tiger", "phoenix", "aobing", "jiang"],
    ["erlang", "nezha", "lei", "jiang", "wukong"],
    ["lei", "phoenix", "fox", "xuanwu", "erlang", "change"],
    ["nuwa", "fox", "aobing", "xuanwu", "tiger", "wukong"],
    ["wukong", "erlang", "xuanwu", "nuwa", "phoenix", "lei", "aobing"],
  ];
  const positions = [16, 18, 3, 7, 11, 5, 20];
  return formations[round - 1].map((id, i) => ({
    uid: `e${i}`,
    heroId: id,
    position: positions[i],
    star: round >= 9 ? 2 : round >= 4 && i === 0 ? 2 : 1,
  }));
}

export function neutralArmy(round: number): Unit[] {
  const info = roundInfo(round);
  const count = info.stage === 1 ? info.step : Math.min(6, info.stage + 1);
  return Array.from({ length: count }, (_, i) => ({
    uid: `n${i}`,
    heroId: (["xuanwu", "tiger", "phoenix"] as HeroId[])[i % 3],
    star: info.stage >= 4 ? 2 : 1,
    position: [17, 19, 10, 8, 24, 26][i],
    neutral: info.stage,
    items: [],
  }));
}
