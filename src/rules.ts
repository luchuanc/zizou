export const BOARD_COLS = 7;
export const BOARD_ROWS = 8;
export const BOARD_CELLS = 56;
export const PLAYER_START = 28;
export const BENCH_SIZE = 9;
export const MAX_LEVEL = 10;
export const PREP_SECONDS = 30;
export const MAX_ROUNDS = 52;
export const XP_NEEDED: Record<number, number> = {
  1: 2,
  2: 2,
  3: 6,
  4: 10,
  5: 20,
  6: 36,
  7: 48,
  8: 80,
  9: 84,
};
export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [10, 20, 25, 35, 10],
  10: [5, 10, 20, 40, 25],
};
export const POOL_COPIES = [0, 30, 25, 18, 12, 10];
export function roundInfo(round: number) {
  const stage = round <= 3 ? 1 : 2 + Math.floor((round - 4) / 7);
  const step = round <= 3 ? round : 1 + ((round - 4) % 7);
  const kind =
    stage === 1 || step === 7 ? "pve" : step === 4 ? "carousel" : "pvp";
  return {
    stage,
    step,
    kind,
    label: `${stage}-${step}`,
    name:
      kind === "pve"
        ? stage === 1
          ? "灵兽试炼"
          : stage === 2
            ? "山魈营地"
            : stage === 3
              ? "玄冰狼群"
              : stage === 4
                ? "赤羽巢穴"
                : "上古巨兽"
        : kind === "carousel"
          ? "共选仙缘"
          : "弈者对决",
    augment:
      (stage === 2 && step === 1) || ([3, 4].includes(stage) && step === 2),
  };
}
export function streakIncome(streak: number) {
  const n = Math.abs(streak);
  return n >= 6 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0;
}
export function baseIncome(round: number) {
  return Math.min(5, roundInfo(round).stage === 1 ? round + 1 : 5);
}
