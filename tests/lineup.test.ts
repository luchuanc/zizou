import test from "node:test";
import assert from "node:assert/strict";
import { Game, SAVE_KEY, validateSave, type SaveStore } from "../src/game";
import { HEROES } from "../src/data";
import {
  collectedLineup,
  lineupRecommendation,
  type LineupPlan,
} from "../src/lineup";

class MemoryStore implements SaveStore {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

test("switching or clearing a plan preserves the locked shop, economy, army, and random state", () => {
  const game = new Game(undefined, 123);
  game.toggleLock();
  const before = structuredClone(game.state);
  const stripPlan = (state: typeof before) => {
    const { lineupPlan, lineupPromptSeen, ...rest } = state;
    return rest;
  };
  assert.equal(game.selectLineup({ kind: "preset", buildId: "kunlun" }), true);
  assert.equal(
    lineupRecommendation(game.state.lineupPlan, "nezha")?.kind,
    "core",
  );
  assert.equal(
    lineupRecommendation(game.state.lineupPlan, "xuanwu")?.kind,
    "support",
  );
  assert.equal(lineupRecommendation(game.state.lineupPlan, "jingwei"), null);
  game.selectLineup({ kind: "preset", buildId: "moon" });
  assert.equal(lineupRecommendation(game.state.lineupPlan, "nezha"), null);
  assert.equal(
    lineupRecommendation(game.state.lineupPlan, "jingwei")?.kind,
    "support",
  );
  game.selectLineup(null);
  assert.equal(lineupRecommendation(game.state.lineupPlan, "jingwei"), null);
  assert.deepEqual(stripPlan(game.state), stripPlan(before));
});

test("collection counts bench and board once per hero across buying, merging, and selling", () => {
  const game = new Game();
  game.selectLineup({ kind: "preset", buildId: "kunlun" });
  const count = () => collectedLineup(game.state.lineupPlan, game.state.units);
  assert.equal(count(), 1);
  game.buy(0);
  assert.equal(count(), 1);
  game.buy(1);
  assert.equal(game.state.units[0].star, 2);
  assert.equal(count(), 1);
  game.buy(2);
  assert.equal(count(), 2);
  game.sell(game.bench[0].uid);
  assert.equal(count(), 1);
  game.sell("u1");
  assert.equal(count(), 0);
});

test("plans survive battle changes, round transitions and refresh, and reset for a new match", () => {
  const store = new MemoryStore(),
    game = new Game(store);
  assert.equal(game.state.lineupPromptSeen, false);
  game.selectLineup({ kind: "preset", buildId: "kunlun" });
  game.start();
  const custom: LineupPlan = { kind: "custom", heroes: ["nezha", "jingwei"] };
  game.selectLineup(custom);
  custom.heroes.push("jiang");
  assert.deepEqual(game.state.lineupPlan, {
    kind: "custom",
    heroes: ["nezha", "jingwei"],
  });
  assert.equal(
    lineupRecommendation(game.state.lineupPlan, "jingwei")?.label,
    "自选推荐",
  );
  const interrupted = new Game(store);
  assert.equal(interrupted.state.phase, "prepare");
  assert.deepEqual(interrupted.state.lineupPlan, game.state.lineupPlan);
  assert.equal(interrupted.state.lineupPromptSeen, true);
  game.settle(true, 0, 5, {}, 1);
  game.continue();
  const restored = new Game(store);
  assert.equal(restored.state.round, 2);
  assert.deepEqual(restored.state.lineupPlan, game.state.lineupPlan);
  assert.ok(validateSave(restored.state));
  restored.restart();
  assert.equal(restored.state.lineupPlan, null);
  assert.equal(restored.state.lineupPromptSeen, false);
  restored.dismissLineupPrompt();
  assert.equal(new Game(store).state.lineupPromptSeen, true);
});

test("existing v3 saves gain empty planning fields without losing match progress", () => {
  const store = new MemoryStore(),
    game = new Game();
  game.buy(2);
  game.toggleLock();
  const { lineupPlan, lineupPromptSeen, ...legacy } = game.state;
  store.setItem(SAVE_KEY, JSON.stringify(legacy));
  const restored = new Game(store);
  assert.deepEqual(restored.state, {
    ...legacy,
    lineupPlan: null,
    lineupPromptSeen: true,
  });
});

test("invalid and oversized plans are rejected without mutating the match", () => {
  const game = new Game(),
    before = structuredClone(game.state);
  for (const plan of [
    { kind: "preset", buildId: "missing" },
    { kind: "custom", heroes: [] },
    { kind: "custom", heroes: ["nezha", "nezha"] },
    { kind: "custom", heroes: ["missing"] },
    { kind: "custom", heroes: HEROES.slice(0, 11).map((h) => h.id) },
  ]) {
    assert.equal(game.selectLineup(plan as LineupPlan), false);
    assert.equal(validateSave({ ...game.state, lineupPlan: plan }), false);
    assert.deepEqual(game.state, before);
  }
  assert.equal(
    game.selectLineup({
      kind: "custom",
      heroes: HEROES.slice(0, 10).map((h) => h.id),
    }),
    true,
  );
  assert.ok(validateSave(game.state));
});
