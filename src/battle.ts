import { BOARD_CELLS } from "./rules";
import { itemStats, type ItemStats } from "./equipment";
import { BONDS, hero } from "./data";
import {
  starScale,
  traits,
  opponentUnits,
  type GameState,
  type Unit,
} from "./game";
export interface Fighter extends Unit {
  gear: ItemStats;
  team: 0 | 1;
  hp: number;
  maxHp: number;
  atk: number;
  armor: number;
  range: number;
  speed: number;
  mana: number;
  shield: number;
  cooldown: number;
  moveCooldown: number;
  stun: number;
  power: number;
  regen: number;
  healBonus: number;
  damage: number;
  control: string;
  slow: number;
  haste: number;
  regenBuff: number;
  armorBreak: number;
  taunt: number;
  attacks: number;
  lifesteal: number;
  healAmp: number;
  controlAmp: number;
  burnAmp: number;
  revive: number;
  revived: boolean;
  summonOf: string | null;
  burn: { remaining: number; amount: number; source: string } | null;
}
export interface BattleEvent {
  type: "attack" | "skill" | "damage" | "heal" | "death" | "revive" | "summon";
  from: string;
  to: string;
  value?: number;
  skill?: string;
  targets?: string[];
}
export interface BattleOptions {
  left: Unit[];
  right: Unit[];
  leftRelics: string[];
  rightRelics: string[];
}
export const coords = (p: number) => ({ col: p % 7, row: Math.floor(p / 7) });
export function distance(a: number, b: number) {
  const aa = coords(a),
    bb = coords(b);
  const aq = aa.col - (aa.row - (aa.row & 1)) / 2,
    bq = bb.col - (bb.row - (bb.row & 1)) / 2;
  const dq = aq - bq,
    dr = aa.row - bb.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
const neighborCache = Array.from({ length: BOARD_CELLS }, (_, p) =>
  Array.from({ length: BOARD_CELLS }, (_, i) => i).filter(
    (i) => distance(p, i) === 1,
  ),
);
export class Battle {
  fighters: Fighter[] = [];
  time = 0;
  done = false;
  winner: 0 | 1 = 1;
  draw = false;
  events: BattleEvent[] = [];
  private accumulator = 0;
  private stepCount = 0;
  private summonId = 0;
  private bonds: Set<string>[] = [];
  private teamTraits: Record<string, number>[] = [];
  constructor(s: GameState, options?: BattleOptions) {
    const squads = options
      ? [options.left, options.right]
      : [s.units.filter((u) => u.position !== null), opponentUnits(s)];
    const relics = options
      ? [options.leftRelics, options.rightRelics]
      : [
          s.relics,
          squads[1].some((u) => u.neutral)
            ? []
            : (s.rivals.find((r) => r.id === s.opponentId)?.relics ?? []),
        ];
    for (const team of [0, 1] as const) {
      const ts = Object.fromEntries(
        traits(squads[team]).map((t) => [t.name, t.tier]),
      );
      this.teamTraits[team] = ts;
      const ids = new Set(squads[team].map((u) => u.heroId));
      this.bonds[team] = new Set(
        BONDS.filter((b) => b.heroes.every((id) => ids.has(id))).map(
          (b) => b.id,
        ),
      );
      for (const u of squads[team]) {
        const h = hero(u.heroId),
          scale = starScale(u.star),
          bond = this.bonds[team];
        let hp = h.hp * scale,
          atk = h.atk * scale,
          armor = h.armor,
          speed = h.speed,
          mana = 0,
          power = 1,
          regen = 0,
          healBonus = 0,
          lifesteal = 0,
          healAmp = 1,
          controlAmp = 1,
          burnAmp = 1,
          revive = 0,
          shieldRate = 0;
        if (h.origin === "昆仑") mana += (ts["昆仑"] || 0) * 25;
        if (h.origin === "灵山" && ts["灵山"]) speed *= 1.25;
        if (h.origin === "月宫") regen = [0, 0.02, 0.035][ts["月宫"] || 0];
        if (h.origin === "青丘") power += [0, 0.3, 0.55][ts["青丘"] || 0];
        if (h.origin === "龙宫") {
          hp *= 1 + [0, 0.2, 0.35][ts["龙宫"] || 0];
          controlAmp += [0, 0.15, 0.3][ts["龙宫"] || 0];
        }
        if (ts["九黎"]) {
          burnAmp += [0, 0.3, 0.6][ts["九黎"]];
          if (h.origin === "九黎") lifesteal += [0, 0.15, 0.25][ts["九黎"]];
        }
        if (ts["蓬莱"]) healAmp += 0.25;
        if (h.origin === "幽冥") revive = [0, 0.2, 0.4][ts["幽冥"] || 0];
        if (h.role === "战将") atk *= 1 + [0, 0.18, 0.4][ts["战将"] || 0];
        if (h.role === "守御") {
          armor += [0, 25, 45][ts["守御"] || 0];
          shieldRate += [0, 0.12, 0.2][ts["守御"] || 0];
        }
        if (h.role === "术士") power += [0, 0.25, 0.5][ts["术士"] || 0];
        if (h.role === "灵祝") healBonus = [0, 0.04, 0.07][ts["灵祝"] || 0];
        if (h.role === "游侠") speed *= 1 + [0, 0.2, 0.35][ts["游侠"] || 0];
        if (h.role === "幻师" && ts["幻师"]) controlAmp += 0.4;
        if (relics[team].includes("sword")) atk *= 1.18;
        if (relics[team].includes("jade")) hp *= 1.22;
        if (relics[team].includes("bell")) armor += 18;
        if (relics[team].includes("fan")) speed *= 1.2;
        if (relics[team].includes("lotus")) mana += 35;
        if (bond.has("creation")) {
          hp *= 1.12;
          mana += 15;
        }
        if (bond.has("sun-moon")) {
          if (u.heroId === "houyi") atk *= 1.2;
          if (u.heroId === "change") power += 0.25;
        }
        if (bond.has("heaven") && ["wukong", "erlang"].includes(u.heroId)) {
          atk *= 1.15;
          shieldRate += 0.25;
        }
        if (bond.has("herbs")) {
          if (u.heroId === "chiyou") hp *= 1.2;
          if (u.heroId === "shennong") mana += 40;
        }
        if (bond.has("judges") && ["zhongkui", "yanluo"].includes(u.heroId))
          lifesteal += 0.15;
        if (["change", "nuwa"].includes(u.heroId)) healAmp += 0.15;
        if (u.heroId === "shennong") healAmp += 0.2;
        if (["aobing", "gonggong"].includes(u.heroId)) shieldRate += 0.12;
        if (["fuxi", "mengpo"].includes(u.heroId)) mana += 20;
        if (u.heroId === "phoenix") revive = Math.max(revive, 0.18);
        const gear = itemStats(u.items);
        hp =
          (hp + (gear.hp ?? 0)) * (relics[team].includes("rescue") ? 1.08 : 1);
        atk *=
          1 + (gear.atk ?? 0) + (relics[team].includes("balance") ? 0.1 : 0);
        power +=
          (gear.power ?? 0) +
          (relics[team].includes("scholar") ? 0.25 : 0) +
          (relics[team].includes("balance") ? 0.12 : 0);
        speed *=
          1 + (gear.speed ?? 0) + (relics[team].includes("swift") ? 0.12 : 0);
        mana += (gear.mana ?? 0) + (relics[team].includes("swift") ? 15 : 0);
        armor += gear.armor ?? 0;
        regen +=
          (gear.regen ?? 0) + (relics[team].includes("spring") ? 0.01 : 0);
        lifesteal +=
          (gear.lifesteal ?? 0) + (relics[team].includes("vampire") ? 0.12 : 0);
        shieldRate +=
          (gear.shield ?? 0) + (relics[team].includes("ward") ? 0.2 : 0);
        revive = Math.max(revive, gear.revive ?? 0);
        if (u.neutral) {
          hp *= u.neutral === 1 ? 0.26 : 0.45 + u.neutral * 0.12;
          atk *= u.neutral === 1 ? 0.3 : 0.4 + u.neutral * 0.12;
          revive = 0;
          power *= 0.65;
        }
        this.fighters.push({
          gear,
          ...u,
          team,
          hp,
          maxHp: hp,
          atk,
          armor,
          range: h.range,
          speed,
          mana: Math.min(100, mana),
          shield: hp * shieldRate * healAmp,
          cooldown: 0.4 + (this.fighters.length % 7) * 0.035,
          moveCooldown: 0,
          stun: 0,
          power,
          regen,
          healBonus,
          damage: 0,
          control: "",
          slow: 0,
          haste: 0,
          regenBuff: 0,
          armorBreak: 0,
          taunt: 0,
          attacks: 0,
          lifesteal,
          healAmp,
          controlAmp,
          burnAmp,
          revive,
          revived: false,
          summonOf: null,
          burn: null,
        });
      }
    }
  }
  alive(team?: number) {
    return this.fighters.filter(
      (f) => f.hp > 0 && (team === undefined || f.team === team),
    );
  }
  update(dt: number) {
    if (this.done) return;
    this.accumulator += Math.min(0.25, dt);
    while (this.accumulator >= 0.1 && !this.done) {
      this.accumulator -= 0.1;
      this.step(0.1);
    }
  }
  private step(dt: number) {
    this.time += dt;
    this.stepCount++;
    const fighters = this.alive().sort(
      (a, b) =>
        ((a.team + this.stepCount) % 2) - ((b.team + this.stepCount) % 2),
    );
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      f.cooldown -= dt;
      f.moveCooldown -= dt;
      f.stun = Math.max(0, f.stun - dt);
      for (const key of [
        "slow",
        "haste",
        "regenBuff",
        "armorBreak",
        "taunt",
      ] as const)
        f[key] = Math.max(0, f[key] - dt);
      if (f.stun === 0) f.control = "";
      if (f.burn) {
        f.burn.remaining -= dt;
        const source = this.fighters.find((v) => v.uid === f.burn!.source);
        if (source && this.stepCount % 10 === 0)
          this.hit(source, f, f.burn.amount, true, false, true);
        if (f.burn?.remaining <= 0) f.burn = null;
      }
      if (f.hp <= 0) continue;
      if (f.regen || f.regenBuff > 0)
        f.hp = Math.min(
          f.maxHp,
          f.hp +
            f.maxHp *
              (f.regen + (f.regenBuff > 0 ? 0.04 : 0)) *
              dt *
              f.healAmp *
              this.sustainFactor,
        );
      if (f.stun > 0) continue;
      const targets = this.alive(1 - f.team).sort(
        (a, b) =>
          distance(f.position!, a.position!) -
            distance(f.position!, b.position!) || a.hp - b.hp,
      );
      if (!targets.length) break;
      const target =
        targets.find(
          (t) => t.taunt > 0 && distance(t.position!, f.position!) <= 2,
        ) ?? targets[0];
      const speed =
        f.speed *
        (this.time >= 35 ? 1.4 : 1) *
        (f.slow > 0 ? 0.7 : 1) *
        (f.haste > 0 ? 1.35 : 1) *
        (f.hp < f.maxHp * 0.5
          ? f.heroId === "wukong"
            ? 1.3
            : f.heroId === "jingwei"
              ? 1.2
              : 1
          : 1);
      if (f.mana >= 100) {
        f.mana = 0;
        this.cast(f, target);
        f.cooldown = 0.45 / speed;
        continue;
      }
      if (distance(f.position!, target.position!) <= f.range) {
        if (f.cooldown <= 0) {
          f.cooldown = 1 / speed;
          f.attacks++;
          f.mana = Math.min(
            100,
            f.mana +
              24 +
              (f.gear.manaHit ?? 0) +
              (["jiang", "lei", "daji"].includes(f.heroId) ? 5 : 0),
          );
          this.events.push({ type: "attack", from: f.uid, to: target.uid });
          this.hit(f, target, f.atk, false, true);
          if (f.gear.burn && target.hp > 0)
            target.burn = {
              remaining: 4,
              amount: target.maxHp * f.gear.burn,
              source: f.uid,
            };
          if (f.gear.shred) target.armorBreak = 5;
          if (f.heroId === "nezha") this.heal(f, f, f.maxHp * 0.01);
          const ranger = this.teamTraits[f.team]["游侠"] || 0;
          if (f.attacks % 3 === 0) {
            if (f.heroId === "houyi") this.hit(f, target, f.atk * 0.5);
            if (hero(f.heroId).role === "游侠" && ranger) {
              const second =
                targets.find((t) => t.hp > 0 && t !== target) ?? target;
              this.events.push({ type: "attack", from: f.uid, to: second.uid });
              this.hit(f, second, f.atk * [0, 0.5, 0.8][ranger]);
            }
          }
        }
      } else if (f.moveCooldown <= 0) {
        const occupied = new Set(
          this.alive()
            .filter((v) => v !== f)
            .map((v) => v.position),
        );
        const queue = [{ p: f.position!, first: -1 }],
          seen = new Set([f.position!]);
        let move = -1;
        for (let i = 0; i < queue.length; i++) {
          const n = queue[i];
          if (n.first !== -1 && distance(n.p, target.position!) <= f.range) {
            move = n.first;
            break;
          }
          for (const p of [...neighborCache[n.p]].sort(
            (a, b) =>
              distance(a, target.position!) - distance(b, target.position!),
          )) {
            if (occupied.has(p) || seen.has(p)) continue;
            seen.add(p);
            queue.push({ p, first: n.first === -1 ? p : n.first });
          }
        }
        if (move !== -1) f.position = move;
        f.moveCooldown = 0.38;
      }
    }
    if (!this.alive(0).length || !this.alive(1).length) {
      this.done = true;
      this.winner = this.alive(0).length ? 0 : 1;
    }
    if (!this.done && this.time >= 60) {
      this.done = true;
      this.draw = true;
      this.winner = 1;
    }
  }

  private hit(
    from: Fighter,
    to: Fighter,
    amount: number,
    pure = false,
    basic = false,
    dot = false,
  ) {
    if (to.hp <= 0) return;
    let multiplier = 1;
    if (from.heroId === "tiger" && to.hp < to.maxHp * 0.5) multiplier += 0.2;
    if (["erlang", "zhongkui"].includes(from.heroId) && to.shield > 0)
      multiplier += 0.2;
    if (from.heroId === "yanluo" && to.hp < to.maxHp * 0.35) multiplier += 0.15;
    if (from.heroId === "zhurong" && to.burn && !dot) multiplier += 0.15;
    if (from.heroId === "fox" && to.stun > 0 && !basic) multiplier += 0.15;
    if (
      hero(from.heroId).role === "幻师" &&
      this.teamTraits[from.team]["幻师"] &&
      to.stun > 0
    )
      multiplier += 0.25;
    if (
      this.bonds[from.team].has("fire-water") &&
      ["gonggong", "zhurong"].includes(from.heroId)
    ) {
      multiplier += 0.25;
      if (to.stun > 0 && to.burn) multiplier += 0.3;
    }
    if (
      this.bonds[from.team].has("judges") &&
      ["zhongkui", "yanluo"].includes(from.heroId) &&
      to.hp < to.maxHp * 0.35
    )
      multiplier += 0.2;
    if (to.heroId === "xuanwu" && basic) multiplier *= 0.88;
    multiplier *= 1 + (this.time >= 35 ? Math.min(3, (this.time - 35) / 5) : 0);
    if (basic && from.attacks % 4 === 0)
      multiplier *= 1 + (from.gear.crit ?? 0);
    const armor = Math.max(
      0,
      to.armor - (to.armorBreak > 0 ? Math.max(25, from.gear.shred ?? 0) : 0),
    );
    let damage = amount * multiplier * (pure ? 1 : 100 / (100 + armor));
    if (!dot && to.hp / to.maxHp < (from.gear.execute ?? 0))
      damage = to.hp + to.shield;
    const absorbed = Math.min(to.shield, damage);
    to.shield -= absorbed;
    damage -= absorbed;
    const actual = Math.min(to.hp, damage);
    to.hp = Math.max(0, to.hp - damage);
    from.damage += actual;
    if (from.summonOf) {
      const parent = this.fighters.find((f) => f.uid === from.summonOf);
      if (parent) parent.damage += actual;
    }
    to.mana = Math.min(100, to.mana + 8);
    this.events.push({
      type: "damage",
      from: from.uid,
      to: to.uid,
      value: Math.round(actual),
    });
    if (from.lifesteal && from.hp > 0)
      this.heal(from, from, actual * from.lifesteal);
    if (to.hp === 0) {
      if (to.revive > 0 && !to.revived) {
        to.revived = true;
        to.hp = to.maxHp * to.revive;
        to.mana = 30;
        to.stun = 0.5;
        to.burn = null;
        to.control = "复苏";
        this.events.push({
          type: "revive",
          from: to.uid,
          to: to.uid,
          value: Math.round(to.hp),
        });
      } else {
        this.events.push({ type: "death", from: from.uid, to: to.uid });
        if (from.heroId === "bai") from.atk *= 1.15;
      }
    }
    if (to.heroId === "chiyou" && to.taunt > 0 && basic && from.hp > 0)
      this.hit(to, from, to.atk * 0.25, false, false);
  }
  private heal(from: Fighter, to: Fighter, amount: number) {
    if (to.hp <= 0) return;
    const value = Math.min(
      to.maxHp - to.hp,
      amount * to.healAmp * this.sustainFactor,
    );
    to.hp += value;
    if (value >= 5)
      this.events.push({
        type: "heal",
        from: from.uid,
        to: to.uid,
        value: Math.round(value),
      });
  }
  private shield(to: Fighter, amount: number) {
    if (to.hp > 0)
      to.shield = Math.min(
        to.maxHp,
        to.shield + amount * to.healAmp * this.sustainFactor,
      );
  }
  private get sustainFactor() {
    return this.time >= 45 ? 0.25 : this.time >= 35 ? 0.5 : 1;
  }
  private control(from: Fighter, to: Fighter, duration: number, name: string) {
    if (to.hp <= 0) return;
    to.stun = Math.max(to.stun, duration * from.controlAmp);
    to.control = name;
  }
  private burn(from: Fighter, to: Fighter, seconds: number, potency: number) {
    if (to.hp <= 0) return;
    to.burn = {
      remaining: seconds,
      amount: Math.max(
        to.burn?.amount ?? 0,
        from.atk * potency * from.power * from.burnAmp,
      ),
      source: from.uid,
    };
  }
  private cast(f: Fighter, target: Fighter) {
    const h = hero(f.heroId),
      power = f.power,
      foes = this.alive(1 - f.team),
      friends = this.alive(f.team),
      targets: Fighter[] = [];
    const hit = (t: Fighter, m: number, pure = false) => {
      targets.push(t);
      this.hit(f, t, f.atk * m * power, pure);
    };
    switch (f.heroId) {
      case "nezha":
        foes
          .filter((t) => distance(t.position!, target.position!) <= 1)
          .forEach((t) => hit(t, 1.8));
        this.heal(f, f, f.maxHp * 0.15 * power);
        break;
      case "erlang":
        hit([...foes].sort((a, b) => a.hp - b.hp)[0], 3.6, true);
        break;
      case "wukong":
        foes
          .filter((t) => distance(f.position!, t.position!) <= 2)
          .forEach((t) => {
            hit(t, 2.4);
            this.control(f, t, 1, "眩晕");
          });
        break;
      case "change":
        friends
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
          .slice(0, 2)
          .forEach((t) => {
            targets.push(t);
            this.heal(f, t, t.maxHp * 0.28 * power);
          });
        this.shield(f, f.maxHp * 0.12);
        break;
      case "jiang":
        friends.forEach((t) => {
          targets.push(t);
          this.heal(f, t, t.maxHp * 0.12 * power);
          t.mana = Math.min(100, t.mana + 15);
        });
        break;
      case "fox": {
        const far = foes.sort(
          (a, b) =>
            distance(f.position!, b.position!) -
            distance(f.position!, a.position!),
        )[0];
        this.control(f, far, 1.5, "魅惑");
        hit(far, 3.2);
        break;
      }
      case "aobing":
        foes
          .filter((t) => distance(t.position!, target.position!) <= 1)
          .forEach((t) => {
            hit(t, 2);
            this.control(f, t, 1, "冰冻");
          });
        break;
      case "phoenix":
        foes.forEach((t) => {
          hit(t, 1.5);
          this.burn(f, t, 4, 0.25);
        });
        break;
      case "xuanwu":
        this.shield(f, f.maxHp * 0.35 * power);
        friends
          .filter((t) => distance(f.position!, t.position!) <= 2)
          .forEach((t) => {
            targets.push(t);
            this.heal(f, t, t.maxHp * 0.1 * power);
          });
        break;
      case "tiger":
        hit(target, 2.8);
        this.shield(f, f.maxHp * 0.2 * power);
        break;
      case "nuwa":
        friends.forEach((t) => {
          targets.push(t);
          this.heal(f, t, t.maxHp * 0.24 * power);
        });
        foes.forEach((t) => hit(t, 1.6));
        break;
      case "lei":
        foes.slice(0, 3).forEach((t, i) => {
          hit(t, 2.6 - i * 0.5);
          this.control(f, t, 0.3, "雷击");
        });
        break;
      case "houyi": {
        const t = [...foes].sort((a, b) => b.hp - a.hp)[0];
        for (let i = 0; i < 3; i++) hit(t, 1.5);
        break;
      }
      case "gonggong":
        foes
          .filter((t) => distance(t.position!, target.position!) <= 2)
          .forEach((t) => {
            hit(t, 2.2);
            this.control(f, t, 1.5, "冰冻");
          });
        friends.forEach((t) => this.shield(t, t.maxHp * 0.1 * power));
        break;
      case "zhurong":
        foes
          .filter((t) => distance(t.position!, target.position!) <= 2)
          .forEach((t) => {
            hit(t, t.burn ? 3 : 2);
            this.burn(f, t, 5, 0.3);
          });
        break;
      case "chiyou":
        f.taunt = 3;
        this.shield(f, f.maxHp * 0.3 * power);
        targets.push(f);
        break;
      case "jingwei":
        hit(target, 2.2);
        this.summon(f);
        break;
      case "fuxi":
        friends.forEach((t) => {
          targets.push(t);
          this.shield(t, t.maxHp * 0.25 * power);
          t.haste = 5;
          t.stun = 0;
          t.control = "";
        });
        break;
      case "daji": {
        const t = foes.sort((a, b) => b.atk - a.atk)[0];
        this.control(f, t, 2.5, "魅惑");
        t.armorBreak = 6;
        hit(t, 2.5);
        break;
      }
      case "shennong": {
        friends.forEach((t) => (t.burn = null));
        const t = friends.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        targets.push(t);
        this.heal(f, t, t.maxHp * 0.35 * power);
        t.regenBuff = 5;
        break;
      }
      case "zhongkui": {
        const t = foes.sort(
          (a, b) =>
            distance(f.position!, b.position!) -
            distance(f.position!, a.position!),
        )[0];
        const free = neighborCache[f.position!].find(
          (p) => !this.alive().some((v) => v.position === p),
        );
        if (free !== undefined) t.position = free;
        hit(t, 2);
        this.control(f, t, 2, "镇压");
        break;
      }
      case "yanluo": {
        const t = foes.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (t.hp / t.maxHp < 0.25) {
          targets.push(t);
          this.hit(f, t, t.hp + t.shield + 1, true);
        } else hit(t, 4, true);
        break;
      }
      case "mengpo":
        foes.forEach((t) => {
          targets.push(t);
          t.mana = Math.max(0, t.mana - 30);
          t.slow = 3;
        });
        {
          const t = friends.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          this.heal(f, t, t.maxHp * 0.25 * power);
        }
        break;
      case "bai":
        foes
          .sort((a, b) => a.hp - b.hp)
          .slice(0, 2)
          .forEach((t) => hit(t, 2.4));
        break;
    }
    this.events.push({
      type: "skill",
      from: f.uid,
      to: target.uid,
      skill: h.skill,
      targets: [...new Set(targets.map((t) => t.uid))],
    });
    if (f.healBonus)
      friends.forEach((t) => this.heal(f, t, t.maxHp * f.healBonus));
    if (
      this.bonds[f.team].has("lotus-dragon") &&
      ["nezha", "aobing"].includes(f.heroId)
    ) {
      const partner = friends.find(
        (t) => t.heroId === (f.heroId === "nezha" ? "aobing" : "nezha"),
      );
      if (partner) this.heal(f, partner, partner.maxHp * 0.12);
    }
    if (this.bonds[f.team].has("foxes") && ["fox", "daji"].includes(f.heroId))
      f.mana = Math.min(100, f.mana + 20);
  }
  private summon(f: Fighter) {
    if (this.alive(f.team).filter((t) => t.summonOf === f.uid).length >= 2)
      return;
    const occupied = new Set(this.alive().map((t) => t.position));
    const pos = neighborCache[f.position!].find((p) => !occupied.has(p));
    if (pos === undefined) return;
    const hp = f.maxHp * 0.35 * (this.teamTraits[f.team]["蓬莱"] ? 1.5 : 1),
      id = `${f.uid}s${++this.summonId}`;
    this.fighters.push({
      ...f,
      gear: {},
      items: [],
      uid: id,
      position: pos,
      hp,
      maxHp: hp,
      atk: f.atk * 0.35,
      star: 1,
      mana: -9999,
      shield: 0,
      damage: 0,
      revive: 0,
      summonOf: f.uid,
      stun: 0,
      control: "",
      burn: null,
      attacks: 0,
      cooldown: 0.3,
    });
    this.events.push({ type: "summon", from: f.uid, to: id });
  }
}
