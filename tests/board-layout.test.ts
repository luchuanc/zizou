import test from "node:test";
import assert from "node:assert/strict";
import {
  boardPoint,
  boardCellAt,
  fitBoard,
  projectBoard,
  unprojectBoard,
  BATTLE_SEAM,
} from "../src/board-layout";

test("all displayed hex centers and small drop offsets resolve to the original logical cell", () => {
  for (let p = 0; p < 56; p++) {
    const point = boardPoint(p);
    for (const [dx, dy] of [
      [0, 0],
      [-12, -7],
      [12, 7],
    ]) {
      assert.equal(boardCellAt(point.x + dx, point.y + dy), p);
    }
  }
  assert.equal(
    boardCellAt(60, 200),
    null,
    "decorative stone rim is not a cell",
  );
  assert.equal(boardCellAt(460, -40), null, "header is not a cell");
  assert.equal(
    boardCellAt(460, 550),
    null,
    "bench/footer cannot snap onto the board",
  );
  assert.ok(boardPoint(21).y < BATTLE_SEAM && boardPoint(28).y > BATTLE_SEAM);
});

test("eight-row layouts preserve input mapping and keep back-row status and front-row equipment inside the view", () => {
  for (const [width, height, compact] of [
    [448, 186, true],
    [547, 241, true],
    [724, 256, true],
    [812, 326, true],
    [904, 466, true],
    [1086, 536, false],
    [1086, 680, false],
  ] as const) {
    const v = fitBoard(width, height, compact);
    for (let p = 0; p < 56; p++) {
      const point = boardPoint(p),
        screen = projectBoard(point, v),
        inverse = unprojectBoard(screen, v);
      assert.equal(boardCellAt(inverse.x, inverse.y), p);
      assert.ok(
        screen.x - 47 * v.unitScale > 0 && screen.x + 60 * v.unitScale < width,
      );
      assert.ok(screen.y - 127 * v.unitScale >= (compact ? 20 : 32) - 0.1);
      assert.ok(screen.y + 26 * v.captionScale <= height - 7.9);
    }
    assert.ok(
      v.captionScale * 14 >= 8,
      "name captions stay legible on the smallest view",
    );
    assert.ok(projectBoard({ x: 460, y: v.top }, v).y >= 20);
    assert.ok(projectBoard({ x: 460, y: v.bottom }, v).y <= height - 4);
  }
});

test("growing a phone viewport uses the extra height for row spacing without shrinking the board", () => {
  const a = fitBoard(812, 296, true),
    b = fitBoard(812, 326, true);
  assert.equal(a.scaleX, b.scaleX);
  assert.ok(b.scaleY > a.scaleY);
  assert.ok(b.unitScale >= a.unitScale);
  assert.ok(
    (boardPoint(55).y - boardPoint(0).y) * fitBoard(724, 256, true).scaleY >
      135,
    "rows occupy the expanded board height",
  );
});
