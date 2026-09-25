import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  SAVE_KEY,
  validateSave,
  sellPrice,
  type GameState,
  type SaveStore,
} from "../src/game";
import { Battle } from "../src/battle";
import {
  COMPONENTS,
  EQUIPMENT,
  combine,
  equipInto,
  itemStats,
} from "../src/equipment";
import {
  roundInfo,
  SHOP_ODDS,
  POOL_COPIES,
  MAX_LEVEL,
  MAX_ROUNDS,
} from "../src/rules";
import { HEROES, hero, RELICS } from "../src/data";
import { availableCopies } from "../src/pool";
import { rollShop } from "../src/ai";
import { playPreparation } from "../scripts/autoplay";
class Store implements SaveStore {
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
const settle = (g: Game, won = true, draw = false) => {
  g.start();
  g.settle(won, 2, draw ? 60 : 10, {}, 2, draw);
};
function poolValid(s: GameState) {
  for (const h of HEROES) {
    let count = 0;
    for (const o of [s, ...s.rivals.filter((r) => r.hp > 0)]) {
      count += o.units
        .filter((u) => u.heroId === h.id)
        .reduce((n, u) => n + 3 ** (u.star - 1), 0);
      count += o.shop.filter((id) => id === h.id).length;
    }
    count +=
      s.carousel?.offers.filter((o) => !o.claimedBy && o.heroId === h.id)
        .length ?? 0;
    assert.ok(
      count <= POOL_COPIES[h.cost],
      `${h.id}: ${count}/${POOL_COPIES[h.cost]} round ${s.round}`,
    );
  }
}

test("stage schedule has PvE, PvP, carousel and three augment nodes", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 7, 10, 12, 19].map((r) => [
      roundInfo(r).label,
      roundInfo(r).kind,
      !!roundInfo(r).augment,
    ]),
    [
      ["1-1", "pve", false],
      ["1-2", "pve", false],
      ["1-3", "pve", false],
      ["2-1", "pvp", true],
      ["2-4", "carousel", false],
      ["2-7", "pve", false],
      ["3-2", "pvp", true],
      ["4-2", "pvp", true],
    ],
  );
  assert.equal(RELICS.length, 18);
  for (let l = 1; l <= MAX_LEVEL; l++)
    assert.equal(
      SHOP_ODDS[l].reduce((a, b) => a + b, 0),
      100,
    );
  const g = new Game();
  g.state.gold = 1000;
  while (g.state.level < 10) g.buyXP();
  assert.equal(g.state.xp, 0);
  assert.match(g.buyXP(), /最高/);
});
test("all 36 symmetric recipes preserve both component stats and three-slot limits", () => {
  assert.equal(COMPONENTS.length, 8);
  assert.equal(EQUIPMENT.filter((e) => e.parts).length, 36);
  for (const a of COMPONENTS)
    for (const b of COMPONENTS) {
      const out = combine(a.id, b.id)!;
      assert.equal(out, combine(b.id, a.id));
      assert.ok(out);
      const stats = itemStats([out]);
      for (const [k, v] of Object.entries(itemStats([a.id, b.id])))
        assert.ok(stats[k as keyof typeof stats]! >= v);
    }
  assert.equal(combine("blade_blade", "rod"), null);
  assert.equal(equipInto(["blade_blade", "bow_bow", "rod_rod"], "belt"), null);
  assert.deepEqual(equipInto(["blade_blade", "rod", "bow_bow"], "tear"), [
    "blade_blade",
    "rod_tear",
    "bow_bow",
  ]);
});
test("equip, combine, merge and sale conserve gear and pay exactly once", () => {
  const store = new Store(),
    g = new Game(store, 12);
  g.state.inventory = ["blade", "rod", "belt", "belt"];
  g.equipItem(0, "u1");
  g.equipItem(0, "u1");
  assert.deepEqual(g.state.units[0].items, ["blade_rod"]);
  g.combineItems(0, 1);
  g.equipItem(0, "u1");
  assert.deepEqual(g.state.units[0].items, ["blade_rod", "belt_belt"]);
  g.buy(0);
  g.buy(1);
  assert.equal(g.state.units[0].star, 2);
  assert.equal(g.state.units[0].items!.length, 2);
  const gold = g.state.gold;
  g.sell("u1");
  assert.equal(g.state.gold, gold + 3);
  assert.deepEqual(g.state.inventory, ["blade_rod", "belt_belt"]);
  g.sell("u1");
  assert.equal(g.state.gold, gold + 3);
  assert.deepEqual(new Game(store).state.inventory, g.state.inventory);
});
test("merge overflows full item slots into inventory without dropping equipment", () => {
  const g = new Game();
  g.state.units = [
    {
      uid: "u1",
      heroId: "nezha",
      star: 1,
      position: 31,
      items: ["blade_blade", "rod_rod", "bow_bow"],
    },
    {
      uid: "u2",
      heroId: "nezha",
      star: 1,
      position: null,
      items: ["belt_belt", "tear_tear"],
    },
  ];
  g.state.nextUid = 3;
  g.state.shop[0] = "nezha";
  g.buy(0);
  assert.equal(g.state.units.length, 1);
  assert.equal(g.state.units[0].items!.length, 3);
  assert.deepEqual(g.state.inventory.slice(-2), ["belt_belt", "tear_tear"]);
});
test("items affect real battle stats, burn, mana and revival; neutral monsters receive no enemy augments", () => {
  const g = new Game();
  const b = new Battle(g.state, {
    left: [
      {
        uid: "u1",
        heroId: "nezha",
        star: 1,
        position: 31,
        items: ["rod_belt", "blade_tear", "cloak_belt"],
      },
    ],
    right: [{ uid: "enemy", heroId: "chiyou", star: 3, position: 24 }],
    leftRelics: [],
    rightRelics: [],
  });
  const a = b.fighters[0],
    enemy = b.fighters[1];
  assert.ok(a.maxHp > hero("nezha").hp);
  assert.ok(a.power > 1);
  assert.ok(a.revive > 0);
  a.cooldown = 0;
  b.update(0.1);
  assert.ok(enemy.burn);
  assert.ok(a.mana >= 38);
  a.hp = 1;
  enemy.atk = 1e6;
  enemy.cooldown = 0;
  b.update(0.1);
  assert.ok(a.revived && a.hp > 0);
  const regular = new Battle(g.state).fighters.find((f) => f.team === 1)!.maxHp;
  g.state.rivals[0].relics = ["jade", "sword"];
  assert.equal(
    new Battle(g.state).fighters.find((f) => f.team === 1)!.maxHp,
    regular,
  );
  for (const e of EQUIPMENT.filter((e) => e.parts)) {
    const f = new Battle(g.state, {
      left: [
        { uid: "u1", heroId: "nezha", star: 2, position: 31, items: [e.id] },
      ],
      right: [{ uid: "e1", heroId: "chiyou", star: 2, position: 24 }],
      leftRelics: [],
      rightRelics: [],
    });
    for (let t = 0; t < 610 && !f.done; t++) f.update(0.1);
    assert.ok(f.done, e.id);
    assert.ok(
      f.fighters.every((u) => Number.isFinite(u.hp) && u.hp >= 0),
      e.id,
    );
  }
});
test("shared pool reserves shops and merged copies, replenishes on sale and elimination", () => {
  const g = new Game(undefined, 21);
  poolValid(g.state);
  const before = availableCopies(g.state, "nezha");
  g.buy(0);
  assert.equal(availableCopies(g.state, "nezha"), before);
  g.buy(1);
  assert.equal(availableCopies(g.state, "nezha"), before);
  g.sell("u1");
  assert.equal(availableCopies(g.state, "nezha"), before + 3);
  assert.deepEqual(
    rollShop(
      10,
      () => 0.5,
      () => 0,
    ),
    [null, null, null, null, null],
  );
  assert.equal(
    rollShop(
      10,
      () => 0.1,
      (id) => (id === "nezha" ? 1 : 0),
    ).filter(Boolean).length,
    1,
  );
  assert.equal(
    rollShop(
      1,
      () => 0.2,
      (id) => (id === "nezha" ? 1 : id === "xuanwu" ? 30 : 0),
    )[0],
    "xuanwu",
    "remaining copies weight champion selection within a cost tier",
  );
  const r = g.state.rivals[0];
  const id = r.units[0].heroId;
  const held =
    r.units
      .filter((u) => u.heroId === id)
      .reduce((n, u) => n + 3 ** (u.star - 1), 0) +
    r.shop.filter((h) => h === id).length;
  const n = availableCopies(g.state, id);
  r.hp = 0;
  assert.equal(availableCopies(g.state, id), n + held);
});
test("carousel picks are ordered by HP, shared with AI, restored and awarded once", () => {
  const store = new Store(),
    g = new Game(store, 33);
  g.state.round = 6;
  g.state.hp = 40;
  g.state.rivals.forEach((r, i) => (r.hp = 50 + i * 6));
  settle(g);
  g.continue();
  assert.equal(g.state.phase, "carousel");
  assert.equal(g.state.carousel!.order[0], "player");
  poolValid(g.state);
  const restored = new Game(store);
  assert.deepEqual(restored.state.carousel, g.state.carousel);
  const offer = restored.state.carousel!.offers.find((o) => !o.claimedBy)!;
  const before = restored.state.units.length;
  assert.ok(restored.chooseCarousel(offer.id));
  assert.equal(restored.state.round, 8);
  assert.equal(restored.state.phase, "prepare");
  assert.equal(restored.state.carousel, null);
  assert.ok(restored.state.units.length >= before);
  assert.equal(restored.chooseCarousel(offer.id), false);
  assert.ok(validateSave(restored.state));
  poolValid(restored.state);
  const later = new Game(undefined, 4);
  later.state.round = 6;
  later.state.rivals.forEach((r) => (r.hp = 50));
  settle(later);
  later.continue();
  assert.ok(later.state.carousel!.turn > 0);
  assert.equal(
    later.state.carousel!.offers.filter((o) => o.claimedBy).length,
    later.state.carousel!.turn,
  );
});
test("carousel with full bench retains the item and refunds hero cost", () => {
  const g = new Game(undefined, 8);
  g.state.round = 6;
  g.state.hp = 1;
  g.state.rivals.forEach((r) => (r.hp = 80));
  settle(g);
  g.continue();
  const offer = g.state.carousel!.offers.find((o) => !o.claimedBy)!;
  g.state.level = 1;
  g.state.units = Array.from({ length: 10 }, (_, i) => ({
    uid: `u${i + 1}`,
    heroId: "nezha",
    star: 3,
    position: i === 0 ? 31 : null,
  }));
  g.state.nextUid = 11;
  const money = g.state.gold,
    gear = g.state.inventory.length;
  g.chooseCarousel(offer.id);
  assert.equal(g.state.gold, money + hero(offer.heroId).cost);
  assert.equal(g.state.inventory.length, gear + 1);
  assert.equal(g.bench.length, 9);
});
test("augment rerolls persist, choices exclude owned relics, instant bonuses are not repeatable", () => {
  const store = new Store(),
    g = new Game(store);
  g.state.round = 3;
  settle(g);
  g.continue();
  assert.equal(g.state.phase, "relic");
  const first = g.state.relicChoices[0];
  assert.equal(g.rerollRelic(0), true);
  assert.notEqual(g.state.relicChoices[0], first);
  assert.equal(g.rerollRelic(0), false);
  assert.equal(new Game(store).state.relicRerolls[0], true);
  g.state.relicChoices[0] = "treasure";
  const gold = g.state.gold;
  g.chooseRelic("treasure");
  assert.equal(g.state.gold, gold + 25);
  g.chooseRelic("treasure");
  assert.equal(g.state.gold, gold + 25);
});
test("battle shopping and bench sales leave deployed fighters intact; draws hurt both opponents", () => {
  const g = new Game();
  g.buy(2);
  const bench = g.bench[0];
  const battle = new Battle(g.state);
  g.start();
  const gold = g.state.gold;
  g.sell(bench.uid);
  assert.equal(g.state.gold, gold + sellPrice(bench));
  assert.match(g.sell("u1"), /战斗中/);
  assert.equal(battle.fighters[0].uid, "u1");
  const d = new Game();
  d.state.round = 11;
  const opponent = d.state.rivals.find((r) => r.id === d.state.opponentId)!;
  const hp = opponent.hp;
  settle(d, false, true);
  assert.ok(d.state.result!.draw);
  assert.ok(d.state.hp < 100);
  assert.ok(opponent.hp < hp);
  assert.equal(opponent.streak, -1);
  const timer = new Battle(g.state, {
    left: [{ uid: "a", heroId: "xuanwu", star: 1, position: 31 }],
    right: [{ uid: "b", heroId: "xuanwu", star: 1, position: 24 }],
    leftRelics: [],
    rightRelics: [],
  });
  timer.fighters.forEach((f) => {
    f.atk = 0;
    f.mana = -1e6;
    f.regen = 1;
  });
  for (let i = 0; i < 610 && !timer.done; i++) timer.update(0.1);
  assert.equal(timer.draw, true);
});
test("v2 migration preserves ownership, finances and a backup; damaged new items are rejected", () => {
  const store = new Store(),
    g = new Game();
  const v2: any = structuredClone(g.state);
  v2.version = 2;
  v2.round = 4;
  v2.gold = 37;
  v2.units.forEach((u: any) => {
    if (u.position !== null) u.position -= 7;
  });
  v2.rivals.forEach((r: any) =>
    r.units.forEach((u: any) => {
      if (u.position !== null) u.position -= 7;
    }),
  );
  delete v2.inventory;
  delete v2.carousel;
  delete v2.preparation;
  delete v2.autoAdvance;
  store.setItem("shanhai-yi.save.v2", JSON.stringify(v2));
  const upgraded = new Game(store);
  assert.equal(upgraded.state.gold, 37);
  assert.equal(upgraded.state.units[0].position, 31);
  assert.ok(store.getItem("shanhai-yi.save.v2.backup"));
  assert.ok(validateSave(upgraded.state));
  const bad = structuredClone(upgraded.state);
  bad.units[0].items = ["missing"];
  assert.equal(validateSave(bad), false);
});
test("complete deterministic matches conserve the shared pool through every phase", () => {
  for (const seed of [100, 222, 567]) {
    const store = new Store(),
      g = new Game(store, seed);
    let iterations = 0;
    while (g.state.phase !== "ended" && iterations++ < 200) {
      if (g.state.phase === "prepare") {
        playPreparation(g, "kunlun");
        const b = new Battle(g.state);
        for (let t = 0; t < 610 && !b.done; t++) b.update(0.1);
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
      assert.ok(validateSave(g.state), `${g.state.round}/${g.state.phase}`);
      poolValid(g.state);
      assert.equal(new Game(store).state.round, g.state.round);
    }
    assert.equal(g.state.phase, "ended");
    assert.ok(g.state.round <= MAX_ROUNDS);
    assert.ok(g.state.rank! >= 1 && g.state.rank! <= 8);
  }
});
