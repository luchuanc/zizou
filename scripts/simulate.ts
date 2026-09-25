import { playPreparation } from "./autoplay";
import { Game, validateSave } from "../src/game";
import { Battle } from "../src/battle";
import { createRivals, prepareRival, type Rival } from "../src/ai";
import { BUILDS } from "../src/data";
const results: {
  build: string;
  rank: number | null;
  rounds: number;
  wins: number;
}[] = [];
let battles = 0,
  timeouts = 0,
  duration = 0;
for (let run = 0; run < 16; run++) {
  const g = new Game(undefined, 2026 + run);
  const buildId = BUILDS[run % BUILDS.length].id;
  while (g.state.phase !== "ended") {
    if (g.state.phase === "prepare") {
      playPreparation(g, buildId);
      const battle = new Battle(g.state);
      for (let i = 0; i < 610 && !battle.done; i++) {
        battle.update(0.1);
        battle.events = [];
      }
      battles++;
      duration += battle.time;
      if (battle.time >= 60) timeouts++;
      g.start();
      g.settle(
        battle.winner === 0,
        battle.alive(1).filter((f) => !f.summonOf).length,
        battle.time,
        {},
        battle.alive(0).filter((f) => !f.summonOf).length,
        battle.draw,
      );
    } else if (g.state.phase === "result") g.continue();
    else if (g.state.phase === "relic") g.chooseRelic(g.state.relicChoices[0]);
    else if (g.state.phase === "carousel")
      g.chooseCarousel(g.state.carousel!.offers.find((o) => !o.claimedBy)!.id);
    else if (g.state.phase === "event")
      g.chooseEvent(g.state.eventId === "merchant" ? "gold" : "heal");
    if (!validateSave(g.state))
      throw new Error(`Invalid save: ${run}/${g.state.round}/${g.state.phase}`);
  }
  results.push({
    build: buildId,
    rank: g.state.rank,
    rounds: g.state.round,
    wins: g.state.wins,
  });
}
console.log(
  JSON.stringify(
    {
      matches: results.length,
      battles,
      timeouts,
      averageBattleSeconds: Math.round(duration / battles),
      results,
    },
    null,
    2,
  ),
);
