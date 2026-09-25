import { hero, type HeroId } from "./data";
import { POOL_COPIES } from "./rules";
import type { GameState } from "./game";
export function availableCopies(s: GameState, id: HeroId) {
  let used = 0;
  for (const owner of [s, ...s.rivals]) {
    if (owner.hp <= 0) continue;
    for (const u of owner.units) if (u.heroId === id) used += 3 ** (u.star - 1);
    for (const offer of owner.shop) if (offer === id) used++;
  }
  for (const offer of s.carousel?.offers ?? [])
    if (!offer.claimedBy && offer.heroId === id) used++;
  return Math.max(0, POOL_COPIES[hero(id).cost] - used);
}
