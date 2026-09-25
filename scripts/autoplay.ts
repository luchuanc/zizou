import { createRivals, prepareRival, type Rival } from "../src/ai";
import { availableCopies } from "../src/pool";
import type { Game } from "../src/game";
/** Deterministic player policy for validation; purchases use the real shared pool. */
export function playPreparation(g: Game, buildId: string) {
  const s = g.state;
  const r: Rival = {
    ...createRivals(s.seed)[0],
    id: "p",
    buildId,
    gold: s.gold,
    level: s.level,
    xp: s.xp,
    hp: s.hp,
    units: structuredClone(s.units),
    nextUid: s.nextUid,
    shop: [...s.shop],
    relics: [...s.relics],
    inventory: [...s.inventory],
    seed: s.seed,
  };
  // This driver uses only the player's chosen augments; don't invent a second choice.
  const existingRelics = [...r.relics];
  prepareRival(
    r,
    s.round,
    s.rivals.find((r) => r.id === s.opponentId)!.units,
    (id) => availableCopies({ ...s, units: r.units, shop: r.shop }, id),
  );
  if (r.relics.length !== existingRelics.length)
    throw new Error("Player policy must run after augment choice");
  Object.assign(s, {
    gold: r.gold,
    level: r.level,
    xp: r.xp,
    seed: r.seed,
    inventory: r.inventory,
    shop: r.shop,
  });
  s.nextUid = r.nextUid + r.units.length;
  s.units = r.units.map((u, i) => ({ ...u, uid: `u${r.nextUid + i}` }));
}
