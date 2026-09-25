import { BUILDS, HEROES, type HeroId } from "./data";
import { MAX_LEVEL } from "./rules";

export type LineupPlan =
  { kind: "preset"; buildId: string } | { kind: "custom"; heroes: HeroId[] };

export function validLineupPlan(value: unknown): value is LineupPlan | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const plan = value as LineupPlan;
  if (plan.kind === "preset")
    return BUILDS.some((build) => build.id === plan.buildId);
  return (
    plan.kind === "custom" &&
    Array.isArray(plan.heroes) &&
    plan.heroes.length > 0 &&
    plan.heroes.length <= MAX_LEVEL &&
    new Set(plan.heroes).size === plan.heroes.length &&
    plan.heroes.every((id) => HEROES.some((h) => h.id === id))
  );
}

export function resolveLineup(plan: LineupPlan | null) {
  if (!plan) return null;
  if (plan.kind === "custom")
    return { name: "自选阵容", heroes: plan.heroes, core: [] as HeroId[] };
  const build = BUILDS.find((b) => b.id === plan.buildId);
  return build
    ? { name: build.name, heroes: build.heroes, core: build.heroes.slice(0, 3) }
    : null;
}

export function lineupRecommendation(plan: LineupPlan | null, id: HeroId) {
  const lineup = resolveLineup(plan);
  if (!lineup?.heroes.includes(id)) return null;
  if (plan?.kind === "custom") return { kind: "custom", label: "自选推荐" };
  return lineup.core.includes(id)
    ? { kind: "core", label: "核心推荐" }
    : { kind: "support", label: "补强推荐" };
}

export function collectedLineup(
  plan: LineupPlan | null,
  units: { heroId: HeroId }[],
) {
  const owned = new Set(units.map((u) => u.heroId));
  return resolveLineup(plan)?.heroes.filter((id) => owned.has(id)).length ?? 0;
}
