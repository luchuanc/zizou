import { BOARD_CELLS, BOARD_COLS, PLAYER_START } from "./rules";

export const BOARD_VIEW_WIDTH = 920;
export const BOARD_VIEW_HEIGHT = 520;
export const CELL_RX = 44;
export const CELL_RY = 31;

export interface BoardPoint {
  x: number;
  y: number;
}
export interface BoardView {
  scaleX: number;
  scaleY: number;
  unitScale: number;
  captionScale: number;
  offsetX: number;
  offsetY: number;
  top: number;
  bottom: number;
}

/** Display geometry only; battle distances still use the logical hex grid. */
export function boardPoint(position: number): BoardPoint {
  const col = position % BOARD_COLS;
  const row = Math.floor(position / BOARD_COLS);
  return {
    x: 148 + col * 96 + (row % 2) * 48,
    y: 94 + row * 48 + (position >= PLAYER_START ? 18 : 0),
  };
}

export const BATTLE_SEAM = (boardPoint(21).y + boardPoint(28).y) / 2;

export function hexPoints(x: number, y: number, rx = CELL_RX, ry = CELL_RY) {
  return [
    x,
    y - ry,
    x + rx,
    y - ry / 2,
    x + rx,
    y + ry / 2,
    x,
    y + ry,
    x - rx,
    y + ry / 2,
    x - rx,
    y - ry / 2,
  ];
}

/** Snap within a small gutter around each visible hex, never onto the stone rim. */
export function boardCellAt(x: number, y: number): number | null {
  let best: number | null = null;
  let distance = Infinity;
  for (let p = 0; p < BOARD_CELLS; p++) {
    const point = boardPoint(p),
      dx = Math.abs(x - point.x),
      dy = Math.abs(y - point.y);
    const d = (dx / 48) ** 2 + (dy / 32) ** 2;
    if (dx <= 48 && dy <= 33 * (1 - dx / 96) && d < distance) {
      best = p;
      distance = d;
    }
  }
  return best;
}

/** Fit all eight rows between the back-row bars and the front-row captions. */
export function fitBoard(
  width: number,
  height: number,
  compact: boolean,
): BoardView {
  const scaleX = Math.max(0.01, Math.min(width / (compact ? 840 : 940), 1.6));
  const unitScale = Math.min(
    scaleX * 0.94,
    Math.max(0.34, Math.min(1.12, (height - 12) / 420)),
  );
  const captionScale = Math.max(unitScale, 8 / 14);
  const header = compact ? 20 : 32;
  const first = boardPoint(0).y,
    last = boardPoint(55).y;
  const firstFoot = header + 128 * unitScale;
  const lastFoot = height - 26 * captionScale - 8;
  const scaleY = Math.max(
    0.01,
    Math.min(scaleX, (lastFoot - firstFoot) / (last - first)),
  );
  const unused = Math.max(0, lastFoot - firstFoot - (last - first) * scaleY);
  const offsetY = firstFoot + unused / 2 - first * scaleY;
  return {
    scaleX,
    scaleY,
    unitScale,
    captionScale,
    offsetX: (width - BOARD_VIEW_WIDTH * scaleX) / 2,
    offsetY,
    top: (header + 3 - offsetY) / scaleY,
    bottom: (height - 5 - offsetY) / scaleY,
  };
}

export function projectBoard(point: BoardPoint, view: BoardView): BoardPoint {
  return {
    x: point.x * view.scaleX + view.offsetX,
    y: point.y * view.scaleY + view.offsetY,
  };
}

export function unprojectBoard(point: BoardPoint, view: BoardView): BoardPoint {
  return {
    x: (point.x - view.offsetX) / view.scaleX,
    y: (point.y - view.offsetY) / view.scaleY,
  };
}
