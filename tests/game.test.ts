import test from "node:test";
import { BENCH_SIZE, MAX_ROUNDS } from "../src/rules";
import { playPreparation } from "../scripts/autoplay";
import assert from "node:assert/strict";
import {
  Game,
  SAVE_KEY,
  validateSave,
  traits,
  type SaveStore,
  type Unit,
} from "../src/game";
import { HEROES, BONDS, TRAITS, hero } from "../src/data";
import { Battle, distance } from "../src/battle";
import {
  createRivals,
  prepareRival,
  optimizeLineup,
  rivalArmy,
  type Rival,
} from "../src/ai";
class MemoryStore implements SaveStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
const unit = (
  heroId: Unit["heroId"],
  uid: string,
  position: number | null,
  star = 1,
): Unit => ({ heroId, uid, position, star });
const fight = (b: Battle) => {
  for (let i = 0; i < 610 && !b.done; i++) b.update(0.1);
  assert.ok(b.done);
  return b;
};

test("three equal copies merge in place and a ninth copy recursively creates three stars", () => {
  const g = new Game();
  g.buy(0);
  g.buy(1);
  assert.equal(g.state.gold, 3);
  assert.equal(g.state.units.find((u) => u.uid === "u1")!.star, 2);
  assert.equal(g.state.units.find((u) => u.uid === "u1")!.position, 31);
  assert.equal(g.state.units.length, 1);
  g.state.units = [
    unit("nezha", "u1", 31, 2),
    unit("nezha", "u6", null, 2),
    unit("nezha", "u7", null),
    unit("nezha", "u8", null),
  ];
  g.state.nextUid = 9;
  g.state.shop[0] = "nezha";
  g.buy(0);
  assert.equal(g.state.units.length, 1);
  assert.equal(g.state.units[0].star, 3);
  assert.equal(g.state.units[0].position, 31);
});
test("full bench rejects ordinary buys but allows a merging purchase without losing money", () => {
  const g = new Game();
  g.state.units.push(
    ...Array.from({ length: BENCH_SIZE }, (_, i) =>
      unit(i < 2 ? "nezha" : "fox", `u${i + 4}`, null),
    ),
  );
  g.state.nextUid = 20;
  g.state.shop[0] = "change";
  const before = g.state.gold;
  assert.match(g.buy(0), /已满/);
  assert.equal(g.state.gold, before);
  assert.equal(g.state.shop[0], "change");
  g.state.shop[0] = "nezha";
  g.buy(0);
  assert.ok(g.bench.length <= BENCH_SIZE);
  assert.equal(g.state.gold, before - 1);
});
test("formation respects capacity, swaps bench for board, and rejects enemy cells", () => {
  const g = new Game();
  g.buy(2);
  const uid = g.bench[0].uid;
  assert.match(g.move(uid, 28)!, /人数已满/);
  assert.equal(g.move(uid, 31), null);
  assert.equal(g.state.units.find((u) => u.uid === uid)!.position, 31);
  assert.equal(g.state.units.find((u) => u.uid === "u1")!.position, null);
  assert.match(g.move(uid, 27)!, /己方半场/);
  assert.equal(new Set(g.deployed.map((u) => u.position)).size, 1);
});
test("same named copies cannot inflate traits; every threshold is reachable", () => {
  const ts = traits([
    unit("nezha", "u1", 21),
    unit("nezha", "u2", 22),
    unit("jiang", "u3", 23),
  ]);
  assert.equal(ts.find((t) => t.name === "昆仑")!.count, 2);
  for (const [name, t] of Object.entries(TRAITS))
    assert.ok(
      HEROES.filter((h) => h.origin === name || h.role === name).length >=
        Math.max(...t.thresholds),
      name,
    );
  assert.equal(HEROES.length, 24);
  assert.equal(Object.keys(TRAITS).length, 14);
  assert.equal(BONDS.length, 8);
});
test("store restores preparation after interrupted combat and settles a result only once", () => {
  const store = new MemoryStore(),
    g = new Game(store);
  assert.ok(g.start());
  const restored = new Game(store);
  assert.equal(restored.state.phase, "prepare");
  assert.equal(restored.state.gold, g.state.gold);
  assert.equal(restored.state.hp, 100);
  const b = fight(new Battle(g.state));
  g.settle(
    b.winner === 0,
    b.alive(1).filter((f) => !f.summonOf).length,
    b.time,
    {},
    b.alive(0).filter((f) => !f.summonOf).length,
  );
  const gold = g.state.gold,
    hp = g.state.hp;
  assert.equal(g.settle(true, 0, 4, {}), false);
  assert.equal(g.state.gold, gold);
  assert.equal(g.state.hp, hp);
  const result = new Game(store);
  assert.equal(result.state.phase, g.state.phase);
  assert.deepEqual(result.state.result, g.state.result);
  assert.ok(validateSave(result.state));
});
test("save validation rejects corrupted nested AI state, duplicate positions, and unknown heroes", () => {
  const g = new Game();
  assert.ok(validateSave(g.state));
  const corrupt = structuredClone(g.state);
  corrupt.rivals[0].units[0].heroId = "invalid" as never;
  assert.equal(validateSave(corrupt), false);
  const clone = structuredClone(g.state);
  clone.units.push(unit("jingwei", "u2", clone.units[0].position));
  clone.nextUid = 3;
  assert.equal(validateSave(clone), false);
  const store = new MemoryStore();
  store.setItem(SAVE_KEY, "{ broken");
  assert.equal(new Game(store).state.round, 1);
});
test("locked shop and augment choice preserve reward idempotence", () => {
  const g = new Game();
  g.state.round = 3;
  g.state.locked = true;
  const shop = [...g.state.shop];
  g.start();
  g.settle(true, 0, 10, {}, 3);
  g.continue();
  assert.equal(g.state.phase, "relic");
  const id = g.state.relicChoices[0];
  assert.equal(g.chooseRelic(id), true);
  assert.equal(g.state.round, 4);
  assert.deepEqual(g.state.shop, shop);
  const gold = g.state.gold;
  assert.equal(g.chooseRelic(id), false);
  assert.equal(g.state.gold, gold);
  assert.ok(validateSave(g.state));
});
test("all 24 hero skills and passives finish valid battles without nonfinite stats", () => {
  const g = new Game();
  for (const h of HEROES) {
    const b = new Battle(g.state, {
      left: [unit(h.id, "left", 23, 2), unit("xuanwu", "tank", 24, 2)],
      right: [unit("chiyou", "right", 16, 2), unit("shennong", "healer", 3, 2)],
      leftRelics: ["lotus"],
      rightRelics: [],
    });
    let skills = 0;
    for (let i = 0; i < 610 && !b.done; i++) {
      b.update(0.1);
      skills += b.events.filter(
        (e) => e.type === "skill" && e.from === "left",
      ).length;
      b.events = [];
    }
    assert.ok(b.done, h.id);
    assert.ok(skills > 0, `${h.name} should cast`);
    for (const f of b.fighters) {
      assert.ok(
        Number.isFinite(f.hp) && f.hp >= 0 && f.hp <= f.maxHp,
        `${h.id} hp`,
      );
      assert.ok(Number.isFinite(f.damage) && f.damage >= 0);
    }
  }
});
test("hex distance is symmetric and movement routes around allied blockers", () => {
  for (let a = 0; a < 56; a++)
    for (let b = 0; b < 56; b++) assert.equal(distance(a, b), distance(b, a));
  const g = new Game();
  const b = new Battle(g.state, {
    left: [
      unit("nezha", "melee", 38),
      unit("change", "b1", 30),
      unit("jiang", "b2", 31),
    ],
    right: [unit("xuanwu", "enemy", 3)],
    leftRelics: [],
    rightRelics: [],
  });
  const f = b.fighters[0];
  fight(b);
  assert.ok(f.damage > 0, "melee unit can reach an enemy behind blockers");
});
test("AI spends real currency, chooses synergies, and keeps legal boards", () => {
  const r = createRivals(42)[0];
  r.buildId = "kunlun";
  r.shop = ["nezha", "nezha", "jiang", "lei", "xuanwu"];
  const worth = (r: Rival) =>
    r.gold +
    r.units.reduce(
      (sum, u) => sum + hero(u.heroId).cost * 3 ** (u.star - 1),
      0,
    );
  const before = worth(r);
  prepareRival(r, 1);
  assert.ok(r.gold >= 0);
  assert.ok(worth(r) <= before, "AI cannot create currency or free copies");
  assert.ok(r.units.filter((u) => u.position !== null).length <= r.level);
  assert.ok(r.units.filter((u) => u.position === null).length <= BENCH_SIZE);
  r.level = 3;
  r.units = [
    unit("nezha", "a", null),
    unit("jiang", "b", null),
    unit("erlang", "c", null),
    unit("jingwei", "d", null),
  ];
  optimizeLineup(r);
  assert.ok(r.units.find((u) => u.heroId === "jiang")!.position !== null);
  assert.equal(
    new Set(r.units.filter((u) => u.position !== null).map((u) => u.position))
      .size,
    3,
  );
});
test("full eight-player matches reach a final rank and remain valid after each save", () => {
  for (let run = 0; run < 3; run++) {
    const store = new MemoryStore(),
      g = new Game(store);
    g.state.seed = 1234 + run;
    while (g.state.phase !== "ended") {
      if (g.state.phase === "prepare") {
        playPreparation(g, ["kunlun", "moon", "spirit"][run]);
        const b = fight(new Battle(g.state));
        g.start();
        g.settle(
          b.winner === 0,
          b.alive(1).filter((f) => !f.summonOf).length,
          b.time,
          {},
          b.alive(0).filter((f) => !f.summonOf).length,
          b.draw,
        );
      } else if (g.state.phase === "result") g.continue();
      else if (g.state.phase === "relic")
        g.chooseRelic(g.state.relicChoices[0]);
      else if (g.state.phase === "carousel")
        g.chooseCarousel(
          g.state.carousel!.offers.find((o) => !o.claimedBy)!.id,
        );
      else if (g.state.phase === "event") {
        const choice = g.state.eventId === "merchant" ? "gold" : "heal";
        g.chooseEvent(choice);
      }
      assert.ok(
        validateSave(g.state),
        `round ${g.state.round} ${g.state.phase}`,
      );
      assert.equal(new Game(store).state.round, g.state.round);
    }
    assert.ok(g.state.rank! >= 1 && g.state.rank! <= 8);
    assert.ok(g.state.round <= MAX_ROUNDS);
    assert.ok(
      g.state.hp === 0 ||
        g.state.rivals.every((r) => r.hp === 0) ||
        g.state.round === MAX_ROUNDS,
    );
  }
});
test("championship is awarded when the final living opponent is defeated", () => {
  const g = new Game();
  g.state.round = 4;
  g.state.rivals.forEach((r, i) => {
    r.hp = i === 0 ? 1 : 0;
    r.eliminatedRound = i === 0 ? null : 1;
  });
  g.state.opponentId = g.state.rivals[0].id;
  g.start();
  g.settle(true, 0, 10, {}, 3);
  assert.equal(g.state.phase, "ended");
  assert.equal(g.state.rank, 1);
  assert.equal(g.state.rivals.filter((r) => r.hp > 0).length, 0);
  assert.equal(
    new Battle(
      { ...g.state, rivals: createRivals(1) },
      {
        left: [unit("nezha", "a", 23)],
        right: rivalArmy(createRivals(1)[0]),
        leftRelics: [],
        rightRelics: [],
      },
    ).fighters.length,
    2,
  );
});

test("dragon control lasts longer and fire skills leave a real damage-over-time status", () => {
  const g = new Game();
  const ice = new Battle(g.state, {
    left: [
      unit("aobing", "a", 23),
      unit("xuanwu", "x", 25),
      unit("gonggong", "g", 38),
    ],
    right: [unit("chiyou", "target", 16, 3)],
    leftRelics: [],
    rightRelics: [],
  });
  ice.fighters.find((f) => f.uid === "a")!.mana = 100;
  ice.update(0.1);
  const frozen = ice.fighters.find((f) => f.uid === "target")!;
  assert.equal(frozen.control, "冰冻");
  assert.ok(frozen.stun >= 1.2);
  const fire = new Battle(g.state, {
    left: [unit("phoenix", "fire", 23)],
    right: [unit("chiyou", "target", 16, 3)],
    leftRelics: [],
    rightRelics: [],
  });
  fire.fighters[0].mana = 100;
  fire.update(0.1);
  const burning = fire.fighters[1];
  assert.ok(burning.burn);
  const hp = burning.hp;
  fire.fighters[0].stun = 2;
  for (let i = 0; i < 10; i++) fire.update(0.1);
  assert.ok(
    burning.hp < hp,
    "burning damages a target while the caster cannot attack",
  );
});

test("underworld revival occurs once per combat", () => {
  const g = new Game(),
    b = new Battle(g.state, {
      left: [unit("bai", "ghost", 23), unit("mengpo", "support", 38)],
      right: [unit("nezha", "killer", 16, 3)],
      leftRelics: [],
      rightRelics: [],
    });
  const ghost = b.fighters[0],
    killer = b.fighters[2];
  ghost.hp = 1;
  killer.atk = 100000;
  killer.cooldown = 0;
  b.update(0.1);
  assert.ok(ghost.revived);
  assert.ok(ghost.hp > 0);
  assert.equal(b.events.filter((e) => e.type === "revive").length, 1);
  killer.cooldown = 0;
  b.update(0.1);
  assert.equal(ghost.hp, 0);
  assert.equal(b.events.filter((e) => e.type === "revive").length, 1);
});

test("summons have limited occupancy and cannot recursively summon", () => {
  const g = new Game(),
    b = new Battle(g.state, {
      left: [unit("jingwei", "bird", 38), unit("xuanwu", "tank", 23)],
      right: [unit("chiyou", "enemy", 16, 3)],
      leftRelics: [],
      rightRelics: [],
    });
  const bird = b.fighters[0];
  for (let i = 0; i < 5; i++) {
    bird.mana = 100;
    b.update(0.1);
  }
  const summons = b.fighters.filter((f) => f.summonOf === "bird");
  assert.equal(summons.length, 2);
  assert.ok(summons.every((f) => f.mana < 0));
  assert.equal(
    new Set(b.alive().map((f) => f.position)).size,
    b.alive().length,
  );
});

test("render frame rate cannot change deterministic battle results", () => {
  const g = new Game(),
    a = new Battle(g.state),
    b = new Battle(g.state);
  fight(a);
  for (let frame = 0; frame < 4000 && !b.done; frame++) b.update(1 / 60);
  assert.ok(b.done);
  assert.equal(a.winner, b.winner);
  assert.equal(Math.round(a.time * 10), Math.round(b.time * 10));
  assert.deepEqual(
    a.fighters.map((f) => Math.round(f.hp)),
    b.fighters.map((f) => Math.round(f.hp)),
  );
});
