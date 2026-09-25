import {
  MAX_LEVEL,
  BENCH_SIZE,
  SHOP_ODDS,
  PLAYER_START,
  BOARD_CELLS,
  roundInfo,
  streakIncome,
  baseIncome,
} from "./rules";
import { COMPONENTS, EQUIPMENT, itemFit, equipInto } from "./equipment";
import {
  BONDS,
  BUILDS,
  HEROES,
  RELICS,
  XP_NEEDED,
  hero,
  type HeroId,
} from "./data";
import { Battle } from "./battle";
import { starScale, traits, type GameState, type Unit } from "./game";

export interface Rival {
  inventory: string[];
  id: string;
  name: string;
  glyph: string;
  buildId: string;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  units: Unit[];
  shop: (HeroId | null)[];
  seed: number;
  nextUid: number;
  wins: number;
  streak: number;
  relics: string[];
  eliminatedRound: number | null;
  lastAction: string;
  style: "balanced" | "greedy" | "aggressive";
}
export function rng(r: { seed: number }) {
  let n = r.seed;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  r.seed = n >>> 0 || 123456789;
  return r.seed / 4294967296;
}
export function rollShop(
  level: number,
  random: () => number,
  available?: (id: HeroId) => number,
): (HeroId | null)[] {
  const weights = SHOP_ODDS[level] ?? SHOP_ODDS[10];
  const drawn: Record<string, number> = {};
  return Array.from({ length: 5 }, () => {
    const eligible = HEROES.filter(
      (h) =>
        (available?.(h.id) ?? 999) - (drawn[h.id] ?? 0) > 0 &&
        weights[h.cost - 1] > 0,
    );
    const costs = [1, 2, 3, 4, 5].filter((c) =>
      eligible.some((h) => h.cost === c),
    );
    let n = random() * costs.reduce((sum, c) => sum + weights[c - 1], 0);
    const cost = costs.find((c) => {
      n -= weights[c - 1];
      return n < 0;
    });
    if (!cost) return null;
    const pool = eligible.filter((h) => h.cost === cost);
    const remaining = (id: HeroId) =>
      (available?.(id) ?? 999) - (drawn[id] ?? 0);
    let ticket = random() * pool.reduce((sum, h) => sum + remaining(h.id), 0);
    const h =
      pool.find((h) => (ticket -= remaining(h.id)) < 0) ??
      pool[pool.length - 1];
    drawn[h.id] = (drawn[h.id] ?? 0) + 1;
    return h.id;
  });
}

export function createRivals(seed: number): Rival[] {
  const randomState = { seed },
    names = [
      "青岚散人",
      "赤霄真人",
      "白鹿仙子",
      "玄冥道君",
      "云中客",
      "扶摇子",
      "望舒仙君",
    ];
  const builds = [...BUILDS].sort(() => 0);
  for (let i = builds.length - 1; i > 0; i--) {
    const j = Math.floor(rng(randomState) * (i + 1));
    [builds[i], builds[j]] = [builds[j], builds[i]];
  }
  return names.map((name, i) => {
    const build = builds[i],
      pool = HEROES.filter((h) => build.heroes.includes(h.id) && h.cost === 1),
      fallback = HEROES.filter((h) => h.cost === 1);
    const starters: HeroId[] = [];
    for (let j = 0; j < 1; j++)
      starters.push((pool[j] ?? fallback[(i + j) % fallback.length]).id);
    const r: Rival = {
      id: `r${i}`,
      name,
      glyph: build.glyph,
      buildId: build.id,
      hp: 100,
      gold: 5,
      level: 1,
      xp: 0,
      units: starters.map((id, j) => ({
        uid: `r${i}u${j + 1}`,
        heroId: id,
        star: 1,
        position: 30 + j * 2,
      })),
      shop: [],
      seed: Math.floor(rng(randomState) * 4294967295) || 1,
      nextUid: 2,
      wins: 0,
      streak: 0,
      relics: [],
      inventory: ["blade", "rod"],
      eliminatedRound: null,
      lastAction: "初入山海，静候对弈",
      style: (["balanced", "greedy", "aggressive"] as const)[i % 3],
    };
    r.shop = rollShop(r.level, () => rng(r));
    return r;
  });
}
export const rivalArmy = (r: Rival) =>
  r.units
    .filter((u) => u.position !== null)
    .map((u) => ({ ...u, position: 55 - u.position! }));
function unitStrength(u: Unit) {
  const h = hero(u.heroId);
  return (14 + h.cost * 4) * starScale(u.star);
}
export function lineupScore(
  units: Unit[],
  buildId: string,
  enemy: Unit[] = [],
) {
  const build = BUILDS.find((b) => b.id === buildId)!;
  const deployed = units.map((u, i) => ({ ...u, position: PLAYER_START + i }));
  let value = units.reduce(
    (sum, u) =>
      sum + unitStrength(u) + (build.heroes.includes(u.heroId) ? 6 : 0),
    0,
  );
  const active = traits(deployed);
  value += active.reduce((sum, t) => sum + t.tier * 11, 0);
  const set = new Set(units.map((u) => u.heroId));
  for (const b of BONDS) if (b.heroes.every((id) => set.has(id))) value += 15;
  const front = units.filter((u) => hero(u.heroId).range === 1),
    back = units.filter((u) => hero(u.heroId).range > 1);
  if (front.length === 0) value -= 30;
  if (front.length >= 2 && back.length >= 2) value += 13;
  if (back.length === 0 && units.length >= 4) value -= 15;
  const enemyCasters = enemy.filter(
    (u) => hero(u.heroId).role === "术士",
  ).length;
  if (enemyCasters >= 2 && set.has("mengpo")) value += 12;
  if (
    enemy.filter((u) => hero(u.heroId).range > 1).length >= 3 &&
    set.has("zhongkui")
  )
    value += 12;
  if (
    enemy.some((u) => ["zhurong", "phoenix"].includes(u.heroId)) &&
    set.has("shennong")
  )
    value += 12;
  return value;
}
export function optimizeLineup(r: Rival, enemy: Unit[] = []) {
  const available = [...r.units].sort(
    (a, b) => unitStrength(b) - unitStrength(a),
  );
  // Beam search considers complete trait combinations; it can keep a cheaper unit to complete a synergy.
  let beam: { units: Unit[]; score: number }[] = [{ units: [], score: 0 }];
  const count = Math.min(r.level, available.length);
  for (let depth = 0; depth < count; depth++) {
    const seen = new Set<string>(),
      next: { units: Unit[]; score: number }[] = [];
    for (const option of beam)
      for (const u of available) {
        if (option.units.includes(u)) continue;
        const units = [...option.units, u],
          key = units
            .map((v) => v.uid)
            .sort()
            .join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ units, score: lineupScore(units, r.buildId, enemy) });
      }
    beam = next.sort((a, b) => b.score - a.score).slice(0, 14);
  }
  const lineup = beam[0]?.units ?? [];
  r.units.forEach((u) => (u.position = null));
  const enemyCarry = enemy
    .filter((u) => u.position !== null)
    .sort((a, b) => unitStrength(b) - unitStrength(a))[0];
  const carryCol = enemyCarry ? enemyCarry.position! % 7 : 3;
  const frontSlots = [30, 32, 31, 29, 33, 28, 34, 37, 39, 38],
    backSlots = [49, 55, 52, 50, 54, 51, 53, 42, 48, 45];
  const front = lineup
    .filter((u) => hero(u.heroId).range === 1)
    .sort(
      (a, b) =>
        hero(b.heroId).hp * starScale(b.star) -
        hero(a.heroId).hp * starScale(a.star),
    );
  const back = lineup
    .filter((u) => hero(u.heroId).range > 1)
    .sort((a, b) => unitStrength(b) - unitStrength(a));
  front.forEach((u, i) => {
    u.position = frontSlots[i];
  });
  back.forEach((u, i) => {
    u.position = backSlots[i];
  });
  // Avoid placing our main ranged carry opposite the scouted hook; move it closer to the front if needed.
  if (enemy.some((u) => u.heroId === "zhongkui") && back[0]) {
    const safe = 42 + (carryCol < 3 ? 1 : 5);
    if (!lineup.some((u) => u.position === safe)) back[0].position = safe;
  }
}
export function mergeRival(r: Rival, id: HeroId) {
  for (let star = 1; star < 3; star++) {
    let same = r.units
      .filter((u) => u.heroId === id && u.star === star)
      .sort(
        (a, b) => Number(a.position === null) - Number(b.position === null),
      );
    while (same.length >= 3) {
      same[0].star++;
      const gear = same.slice(0, 3).flatMap((u) => u.items ?? []);
      same[0].items = [];
      for (const id of gear) {
        const equipped = equipInto(same[0].items, id);
        if (equipped) same[0].items = equipped;
        else r.inventory.push(id);
      }
      const remove = same.slice(1, 3);
      r.units = r.units.filter((u) => !remove.includes(u));
      same = same.slice(3);
    }
  }
}
function addXP(r: Rival, n: number) {
  r.xp += n;
  while (r.level < MAX_LEVEL && r.xp >= XP_NEEDED[r.level]) {
    r.xp -= XP_NEEDED[r.level];
    r.level++;
  }
  if (r.level === MAX_LEVEL) r.xp = 0;
}
export function prepareRival(
  r: Rival,
  round: number,
  enemy: Unit[] = [],
  available?: (id: HeroId) => number,
) {
  const roll = () => {
    r.shop = [];
    r.shop = rollShop(r.level, () => rng(r), available);
  };
  if (r.hp <= 0) return;
  if (round > 1) roll();
  const build = BUILDS.find((b) => b.id === r.buildId)!;
  let bought = 0,
    upgraded = 0;
  const urgent = r.hp <= 40 || round > 15;
  const reserve = urgent
    ? 0
    : round < 4
      ? 0
      : r.style === "greedy"
        ? 30
        : r.style === "aggressive"
          ? 10
          : 20;
  for (let pass = 0; pass < 4; pass++) {
    const offers = r.shop
      .map((id, index) => ({ id, index }))
      .filter((v): v is { id: HeroId; index: number } => v.id !== null)
      .map((v) => {
        const owned = r.units.filter(
          (u) => u.heroId === v.id && u.star === 1,
        ).length;
        const score =
          (build.heroes.includes(v.id) ? 35 : 5) +
          owned * 22 +
          hero(v.id).cost * 3 +
          (r.units.length < r.level ? 25 : 0);
        return { ...v, score, owned };
      })
      .sort((a, b) => b.score - a.score);
    for (const offer of offers) {
      const h = hero(offer.id);
      if (h.cost > r.gold) continue;
      if (
        offer.score < 27 ||
        r.units.some((u) => u.heroId === offer.id && u.star === 3)
      )
        continue;
      if (
        r.gold - h.cost < reserve &&
        offer.owned < 2 &&
        r.units.length >= r.level &&
        round > 3
      )
        continue;
      if (r.units.length >= r.level + BENCH_SIZE && offer.owned < 2) continue;
      r.gold -= h.cost;
      r.shop[offer.index] = null;
      r.units.push({
        uid: `${r.id}u${r.nextUid++}`,
        heroId: offer.id,
        star: 1,
        position: null,
      });
      bought++;
      if (offer.owned >= 2) upgraded++;
      mergeRival(r, offer.id);
    }
    if (
      pass < 3 &&
      r.gold >= reserve + 2 &&
      (urgent ||
        r.units.some(
          (u) =>
            u.star === 1 &&
            r.units.filter((v) => v.heroId === u.heroId && v.star === 1)
              .length === 2,
        ))
    ) {
      r.gold -= 2;
      roll();
    } else break;
  }
  // Sell off-plan surplus to free bench slots. Investment is never conjured out of thin air.
  const removable = r.units
    .filter((u) => !build.heroes.includes(u.heroId) && u.star === 1)
    .sort((a, b) => unitStrength(a) - unitStrength(b));
  while (r.units.length > r.level + 5 && removable.length) {
    const u = removable.shift()!;
    r.gold += hero(u.heroId).cost;
    r.inventory.push(...(u.items ?? []));
    r.units = r.units.filter((v) => v !== u);
  }
  const info = roundInfo(round);
  const desired = Math.min(
    MAX_LEVEL,
    info.stage === 1 ? info.step : info.stage + 2 + (info.step >= 5 ? 1 : 0),
  );
  let levels = 0;
  while (
    r.level < desired &&
    r.gold >= 4 + (urgent ? 0 : Math.min(reserve, 10))
  ) {
    r.gold -= 4;
    const before = r.level;
    addXP(r, 4);
    levels += r.level - before;
  }
  optimizeLineup(r, enemy);
  if (r.id !== "p" && roundInfo(round).augment && r.relics.length < 3) {
    const available = RELICS.filter((x) => !r.relics.includes(x.id));
    const prefer = build.traits.includes("术士")
      ? "lotus"
      : build.traits.includes("游侠")
        ? "fan"
        : build.traits.includes("守御")
          ? "jade"
          : "sword";
    const pick =
      available.find((x) => x.id === prefer) ??
      available[Math.floor(rng(r) * available.length)];
    r.relics.push(pick.id);
    applyAugment(r, pick.id, () => rng(r));
    if (pick.id === "study") addXP(r, 12);
  }
  equipRival(r);
  r.lastAction = upgraded
    ? "追星成形，调整主力站位"
    : levels
      ? "提升境界，增加上阵人数"
      : bought
        ? "招募补强，完善流派羁绊"
        : r.gold >= 20
          ? "保留灵石，积蓄利息"
          : "调整阵型，等待下一次仙缘";
}
export function payRival(
  r: Rival,
  won: boolean,
  damage: number,
  round: number,
) {
  if (r.hp <= 0) return;
  const pvp = roundInfo(round).kind === "pvp";
  if (pvp)
    r.streak = won ? Math.max(1, r.streak + 1) : Math.min(-1, r.streak - 1);
  r.gold +=
    baseIncome(round) +
    Math.min(r.relics.includes("savings") ? 7 : 5, Math.floor(r.gold / 10)) +
    (won && pvp ? 1 : 0) +
    streakIncome(r.streak) +
    (r.relics.includes("coin") ? 2 : 0);
  if (won && pvp) r.wins++;
  if (!won) r.hp = Math.max(0, r.hp - damage);
  addXP(r, r.relics.includes("study") ? 4 : 2);
  if (r.hp === 0) r.eliminatedRound = round;
}
export function damageFor(round: number, survivors: number) {
  const info = roundInfo(round);
  return Math.min(
    100,
    (info.kind === "pve"
      ? 2
      : [0, 0, 0, 3, 5, 8, 12, 18, 25][Math.min(8, info.stage)]) +
      survivors * 2,
  );
}
export function equipRival(r: Rival) {
  for (let i = r.inventory.length - 1; i >= 0; i--) {
    const id = r.inventory[i];
    const candidates = r.units
      .filter((u) => u.position !== null && equipInto(u.items ?? [], id))
      .sort(
        (a, b) =>
          itemFit(id, b.heroId) * starScale(b.star) -
          itemFit(id, a.heroId) * starScale(a.star),
      );
    if (candidates[0]) {
      const u = candidates[0];
      u.items = equipInto(u.items ?? [], id)!;
      r.inventory.splice(i, 1);
    }
  }
}
export function applyAugment(
  owner: { gold: number; hp: number; inventory: string[] },
  id: string,
  random: () => number,
) {
  if (id === "coin") owner.gold += 12;
  if (id === "treasure") owner.gold += 25;
  if (id === "savings") owner.gold += 10;
  if (id === "rescue") owner.hp = Math.min(100, owner.hp + 20);
  if (id === "forge")
    for (let i = 0; i < 3; i++)
      owner.inventory.push(
        COMPONENTS[Math.floor(random() * COMPONENTS.length)].id,
      );
  if (id === "arsenal") {
    const pool = EQUIPMENT.filter((x) => x.parts);
    owner.inventory.push(pool[Math.floor(random() * pool.length)].id);
    owner.gold += 5;
  }
}
export function resolveOtherMatches(s: GameState, excludedId: string) {
  const rest = s.rivals.filter((r) => r.hp > 0 && r.id !== excludedId);
  const reports: string[] = [];
  // An unmatched AI fights a ghost copy. Ghosts do not receive duplicate damage or income.
  for (let i = 0; i < rest.length; i += 2) {
    const a = rest[i],
      b = rest[i + 1] ?? s.rivals.find((r) => r.id === excludedId) ?? rest[0];
    const battle = new Battle(s, {
      left: a.units.filter((u) => u.position !== null),
      right: rivalArmy(b),
      leftRelics: a.relics,
      rightRelics: b.relics,
    });
    for (let tick = 0; tick < 700 && !battle.done; tick++) battle.update(0.1);
    const aWon = battle.winner === 0;
    payRival(
      a,
      aWon,
      damageFor(s.round, battle.alive(1).filter((f) => !f.summonOf).length),
      s.round,
    );
    if (rest[i + 1])
      payRival(
        b,
        !aWon && !battle.draw,
        damageFor(s.round, battle.alive(0).filter((f) => !f.summonOf).length),
        s.round,
      );
    reports.push(
      `${a.name} ${battle.draw ? "平" : aWon ? "胜" : "负"} ${b.name}${rest[i + 1] ? "" : "的镜像"}`,
    );
  }
  return reports;
}
