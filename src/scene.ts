import { BOARD_CELLS, PLAYER_START } from "./rules";
import { item, EQUIPMENT } from "./equipment";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Rectangle,
  Polygon,
  FillGradient,
  type FederatedPointerEvent,
} from "pixi.js";
import { hero } from "./data";
import { opponentUnits, type GameState, type Unit } from "./game";
import { Battle, type Fighter, type BattleEvent } from "./battle";
import { SpellEffects } from "./effects";
import {
  boardPoint,
  boardCellAt,
  fitBoard,
  hexPoints,
  BATTLE_SEAM,
  BOARD_VIEW_WIDTH,
  BOARD_VIEW_HEIGHT,
  type BoardPoint,
} from "./board-layout";
export { boardPoint } from "./board-layout";

interface Visual {
  root: Container;
  sprite: Sprite;
  bars: Graphics;
  ring: Graphics;
  status: Graphics;
  statusText: Text;
  label: Text;
  caption: Container;
  enemy: boolean;
  star: number;
  factor: number;
  x: number;
  y: number;
  hp: number;
  mana: number;
  hit: number;
  seed: number;
}
interface Effect {
  node: Container;
  life: number;
  duration: number;
  update: (p: number) => void;
}
export const SCENE_WIDTH = BOARD_VIEW_WIDTH,
  SCENE_HEIGHT = BOARD_VIEW_HEIGHT;
const W = SCENE_WIDTH,
  H = SCENE_HEIGHT;
const GOLD = 0xc3a269;
function label(text: string, size: number, color: number) {
  return new Text({
    text,
    style: {
      fontFamily: "Songti SC, STSong, serif",
      fontSize: size,
      fill: color,
    },
  });
}
export class Scene {
  app = new Application();
  world = new Container();
  private board = new Container();
  private stone = new Graphics();
  private ornament = new Graphics();
  private grid = new Container();
  private placement = new Graphics();
  private selectedCell = new Graphics();
  private actors = new Container();
  private fx = new Container();
  private motes = new Container();
  private textures: Texture[] = [];
  private itemTextures = new Map<string, Texture>();
  private lastNumber = new Map<string, number>();
  private visuals = new Map<string, Visual>();
  private effects: Effect[] = [];
  private state!: GameState;
  private selected: string | null = null;
  private clock = 0;
  private drag: {
    uid: string;
    pointerId: number;
    startX: number;
    startY: number;
    moving: boolean;
  } | null = null;
  private appearance = new Map<string, { star: number; items: string }>();
  private scale = 1;
  private scaleY = 1;
  private offsetX = 0;
  private offsetY = 0;
  private unitScale = 1;
  private captionScale = 1;
  private compact = false;
  private stoneFill = new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 0x233a3e },
      { offset: 0.48, color: 0x1d3436 },
      { offset: 1, color: 0x2b4840 },
    ],
  });
  private ready = false;
  private lastTick = 0;
  battle: Battle | null = null;
  speed = 1;
  paused = false;
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private spells = new SpellEffects(this.fx, this.reducedMotion);
  onSelect: (uid: string) => void = () => {};
  onMove: (uid: string, p: number | null) => void = () => {};
  onCell: (p: number) => void = () => {};
  onDragMove: (uid: string, x: number, y: number) => void = () => {};
  onDrop: (uid: string, x: number, y: number) => boolean = () => false;
  onDragCancel: () => void = () => {};
  onFinish: (battle: Battle) => void = () => {};
  onTick: (battle: Battle) => void = () => {};
  onSound: (type: string) => void = () => {};
  async init(privateHost: HTMLElement) {
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(devicePixelRatio, 2),
      preference: "webgl",
      resizeTo: privateHost,
    });
    privateHost.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      "aria-label",
      "山海棋盘。可点选英灵，再点击己方格子布阵。也可使用布阵按钮操作。",
    );
    const atlas = await Assets.load<Texture>(
      `${import.meta.env.BASE_URL}assets/heroes.png`,
    );
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(((i % 4) * atlas.width) / 4),
        y = Math.floor((Math.floor(i / 4) * atlas.height) / 3);
      const right = Math.floor((((i % 4) + 1) * atlas.width) / 4),
        bottom = Math.floor(((Math.floor(i / 4) + 1) * atlas.height) / 3);
      this.textures.push(
        new Texture({
          source: atlas.source,
          frame: new Rectangle(
            x + 9,
            y + 5,
            right - x - (i === 6 ? 36 : 18),
            bottom - y - 10,
          ),
        }),
      );
    }
    for (const [path, cols, rows] of [
      ["/assets/heroes-expansion.png", 4, 2],
      ["/assets/heroes-underworld.png", 2, 2],
    ] as const) {
      const tex = await Assets.load<Texture>(
        import.meta.env.BASE_URL + path.replace(/^\//, ""),
      );
      for (let i = 0; i < cols * rows; i++) {
        const x = Math.floor(((i % cols) * tex.width) / cols),
          y = Math.floor((Math.floor(i / cols) * tex.height) / rows),
          r = Math.floor((((i % cols) + 1) * tex.width) / cols),
          b = Math.floor(((Math.floor(i / cols) + 1) * tex.height) / rows);
        this.textures.push(
          new Texture({
            source: tex.source,
            frame: new Rectangle(x, y, r - x, b - y),
          }),
        );
      }
    }
    const equipmentAtlas = await Assets.load<Texture>(
      `${import.meta.env.BASE_URL}assets/equipment-atlas.png`,
    );
    EQUIPMENT.forEach((e, i) =>
      this.itemTextures.set(
        e.id,
        new Texture({
          source: equipmentAtlas.source,
          frame: new Rectangle((i % 8) * 64, Math.floor(i / 8) * 64, 64, 64),
        }),
      ),
    );
    this.app.stage.addChild(this.world);
    this.world.addChild(this.board, this.motes, this.actors, this.fx);
    this.actors.sortableChildren = true;
    this.drawBoard();
    this.addMotes();
    const resize = () => {
      this.app.renderer.resize(
        privateHost.clientWidth,
        privateHost.clientHeight,
      );
      this.compact = matchMedia(
        "(max-height: 650px) and (orientation: landscape), (max-width: 1000px) and (orientation: landscape)",
      ).matches;
      const view = fitBoard(
        privateHost.clientWidth,
        privateHost.clientHeight,
        this.compact,
      );
      this.scale = view.scaleX;
      this.scaleY = view.scaleY;
      this.unitScale = view.unitScale;
      this.captionScale = view.captionScale;
      this.offsetX = view.offsetX;
      this.offsetY = view.offsetY;
      this.world.scale.set(this.scale, this.scaleY);
      for (const v of this.visuals.values()) this.sizeVisual(v);
      this.fx.scale.set(
        this.unitScale / this.scale,
        this.unitScale / this.scaleY,
      );
      this.world.position.set(this.offsetX, this.offsetY);
      this.drawStone(view.top, view.bottom);
      this.clearEffects();
      this.clearPlacement();
      this.highlight();
    };
    new ResizeObserver(resize).observe(privateHost);
    resize();
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = new Rectangle(-10000, -10000, 20000, 20000);
    this.app.stage.on("globalpointermove", (e: FederatedPointerEvent) =>
      this.dragMove(e),
    );
    this.app.stage.on("pointerup", (e: FederatedPointerEvent) =>
      this.dragEnd(e),
    );
    this.app.stage.on("pointerupoutside", (e: FederatedPointerEvent) =>
      this.dragEnd(e),
    );
    this.app.stage.on("pointercancel", () => this.cancelDrag());
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add((t) => this.tick(Math.min(t.deltaMS / 1000, 0.05)));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.app.stop();
      else this.app.start();
    });
    this.ready = true;
  }
  private drawBoard() {
    this.board.addChild(
      this.stone,
      this.ornament,
      this.grid,
      this.selectedCell,
      this.placement,
    );
    this.placement.eventMode = this.selectedCell.eventMode = "none";
    for (let p = 0; p < BOARD_CELLS; p++) {
      const { x, y } = boardPoint(p),
        enemy = p < PLAYER_START;
      const tile = new Graphics()
        .poly(hexPoints(x, y))
        .fill({ color: enemy ? 0x668082 : 0x749c83, alpha: enemy ? 0.1 : 0.17 })
        .stroke({
          color: enemy ? 0x8c9c97 : 0xa0bca0,
          alpha: enemy ? 0.24 : 0.36,
          width: 1,
        });
      tile.eventMode = "static";
      tile.cursor = "pointer";
      tile.hitArea = new Polygon(hexPoints(x, y, 48, 33));
      tile.on("pointertap", () => {
        if (!this.drag) this.onCell(p);
      });
      this.grid.addChild(tile);
    }
  }
  private drawStone(top: number, bottom: number) {
    const edge = [
      110,
      top,
      810,
      top,
      860,
      top + 38,
      860,
      bottom - 28,
      814,
      bottom,
      106,
      bottom,
      60,
      bottom - 28,
      60,
      top + 38,
    ];
    const inset = [
      116,
      top + 11,
      804,
      top + 11,
      847,
      top + 43,
      847,
      bottom - 33,
      809,
      bottom - 11,
      111,
      bottom - 11,
      73,
      bottom - 33,
      73,
      top + 43,
    ];
    this.stone
      .clear()
      .poly(edge.map((n, i) => (i % 2 ? n + 9 : n)))
      .fill(0x0d2427)
      .stroke({ color: 0x7a694b, alpha: 0.75, width: 1.5 })
      .poly(edge)
      .fill(this.stoneFill)
      .stroke({ color: 0xc4a875, alpha: 0.85, width: 1.6 })
      .poly(inset)
      .stroke({ color: 0x9fb596, alpha: 0.25, width: 1 });
    // A quiet warm/cool split and inlaid seam replace the flat green slab.
    this.stone
      .poly([
        116,
        top + 12,
        804,
        top + 12,
        846,
        top + 43,
        846,
        BATTLE_SEAM,
        74,
        BATTLE_SEAM,
        74,
        top + 43,
      ])
      .fill({ color: 0xa4866c, alpha: 0.035 })
      .poly([
        74,
        BATTLE_SEAM,
        846,
        BATTLE_SEAM,
        846,
        bottom - 33,
        809,
        bottom - 12,
        111,
        bottom - 12,
        74,
        bottom - 33,
      ])
      .fill({ color: 0x8bbca0, alpha: 0.045 });
    const g = this.ornament.clear();
    g.ellipse(460, BATTLE_SEAM, 114, 78)
      .stroke({ color: GOLD, alpha: 0.07, width: 1 })
      .ellipse(460, BATTLE_SEAM, 104, 71)
      .stroke({ color: GOLD, alpha: 0.045, width: 1 });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a),
        py = Math.sin(a);
      g.moveTo(460, BATTLE_SEAM)
        .quadraticCurveTo(
          460 + px * 36 - py * 22,
          BATTLE_SEAM + py * 26 + px * 16,
          460 + px * 73,
          BATTLE_SEAM + py * 50,
        )
        .quadraticCurveTo(
          460 + px * 36 + py * 22,
          BATTLE_SEAM + py * 26 - px * 16,
          460,
          BATTLE_SEAM,
        )
        .stroke({ color: GOLD, alpha: 0.065, width: 1 });
    }
    g.moveTo(106, BATTLE_SEAM)
      .lineTo(441, BATTLE_SEAM)
      .moveTo(479, BATTLE_SEAM)
      .lineTo(814, BATTLE_SEAM)
      .stroke({ color: 0xc4b08a, alpha: 0.26, width: 1 })
      .poly([
        460,
        BATTLE_SEAM - 6,
        470,
        BATTLE_SEAM,
        460,
        BATTLE_SEAM + 6,
        450,
        BATTLE_SEAM,
      ])
      .fill({ color: 0xd1b578, alpha: 0.45 });
    for (const x of [85, 835])
      for (const y of [top + 43, bottom - 36]) {
        const dir = x < 460 ? 1 : -1;
        g.moveTo(x, y + 15)
          .lineTo(x, y - 8)
          .quadraticCurveTo(x, y - 19, x + dir * 13, y - 19)
          .lineTo(x + dir * 28, y - 19)
          .stroke({ color: 0xd4ba83, alpha: 0.65, width: 2 })
          .moveTo(x + dir * 7, y + 8)
          .lineTo(x + dir * 7, y - 6)
          .lineTo(x + dir * 21, y - 6)
          .stroke({ color: 0x819987, alpha: 0.55, width: 1 })
          .poly([x, y - 6, x + 6, y, x, y + 6, x - 6, y])
          .fill(0xbca170);
      }
  }
  private sizeVisual(v: Visual) {
    const size = this.unitScale * v.factor;
    v.root.scale.set(size / this.scale, size / this.scaleY);
    v.caption.scale.set(this.captionScale / size);
    v.root.hitArea = new Rectangle(
      -Math.max(39, 22 / size),
      -106,
      Math.max(78, 44 / size),
      132,
    );
  }
  private effectPoint(point: BoardPoint): BoardPoint {
    return {
      x: (point.x * this.scale) / this.unitScale,
      y: (point.y * this.scaleY) / this.unitScale,
    };
  }
  private clearEffects() {
    this.spells.clear();
    this.effects.forEach((e) => e.node.destroy({ children: true }));
    this.effects = [];
  }
  previewPlacement(uid: string, x: number, y: number) {
    this.placement.clear();
    if (this.state?.phase !== "prepare") return;
    const p = this.clientCell(x, y);
    if (p === null) return;
    const valid = p >= PLAYER_START;
    const point = boardPoint(p);
    this.placement
      .poly(hexPoints(point.x, point.y))
      .fill({ color: valid ? 0xd3bb75 : 0xbf7464, alpha: valid ? 0.25 : 0.17 })
      .stroke({ color: valid ? 0xffdf96 : 0xde8b7d, alpha: 0.95, width: 2 });
    const current = this.state.units.find((u) => u.uid === uid)?.position;
    if (current != null && current !== p) {
      const a = boardPoint(current);
      this.placement
        .poly(hexPoints(a.x, a.y, 39, 27))
        .stroke({ color: 0x95c1aa, alpha: 0.7, width: 1.5 });
    }
  }
  clearPlacement() {
    this.placement.clear();
  }
  private addMotes() {
    for (let i = 0; i < 24; i++) {
      const g = new Graphics()
        .circle(0, 0, i % 3 === 0 ? 1.7 : 0.9)
        .fill({ color: i % 2 ? 0xfff4c9 : 0xe7eddd, alpha: 0.75 });
      g.position.set((i * 137) % W, (i * 79) % H);
      this.motes.addChild(g);
    }
  }
  sync(s: GameState, selected: string | null) {
    this.state = s;
    this.selected = selected;
    if (!this.ready) return;
    if (this.battle) {
      this.highlight();
      return;
    }
    this.clearActors();
    const units = [
      ...opponentUnits(s),
      ...s.units.filter((u) => u.position !== null),
    ];
    for (const unit of units) {
      this.makeVisual(unit, !s.units.some((u) => u.uid === unit.uid));
      const before = this.appearance.get(unit.uid),
        items = (unit.items ?? []).join(",");
      if (
        before &&
        (unit.star > before.star || items !== before.items) &&
        !this.reducedMotion
      ) {
        const point = this.effectPoint(boardPoint(unit.position!));
        const ring = new Graphics()
          .ellipse(0, 0, 40, 22)
          .stroke({ color: 0xffdf8b, width: 3 });
        ring.position.set(point.x, point.y);
        this.fx.addChild(ring);
        this.effects.push({
          node: ring,
          life: 0,
          duration: 0.6,
          update: (p) => {
            ring.scale.set(0.4 + p * 1.8);
            ring.alpha = 1 - p;
          },
        });
        const t = label(
          unit.star > before.star ? "升星" : "装备",
          16,
          0xffe4a6,
        );
        t.anchor.set(0.5);
        t.position.set(point.x, point.y - 110);
        this.fx.addChild(t);
        this.effects.push({
          node: t,
          life: 0,
          duration: 1,
          update: (p) => {
            t.y = point.y - 110 - p * 20;
            t.alpha = 1 - p * p;
          },
        });
      }
    }
    this.appearance = new Map(
      units.map((u) => [
        u.uid,
        { star: u.star, items: (u.items ?? []).join(",") },
      ]),
    );
    this.highlight();
  }
  select(uid: string | null) {
    this.selected = uid;
    this.highlight();
  }
  private highlight() {
    this.selectedCell.clear();
    for (const [uid, v] of this.visuals) {
      const chosen = uid === this.selected;
      v.ring.visible = chosen;
      v.caption.visible =
        chosen || (!this.battle && (!v.enemy || !this.compact));
      if (chosen && !this.battle)
        this.selectedCell
          .poly(hexPoints(v.x, v.y))
          .fill({ color: 0xc8b06e, alpha: 0.17 })
          .stroke({ color: 0xe2c88b, alpha: 0.7, width: 1.5 });
    }
    this.grid.alpha = this.battle ? 0.26 : 1;
  }
  private clearActors() {
    this.clearEffects();
    this.visuals.clear();
    this.actors.removeChildren().forEach((c) => c.destroy({ children: true }));
  }
  private makeVisual(u: Unit, enemy: boolean) {
    const p = boardPoint(u.position!),
      root = new Container();
    root.position.set(p.x, p.y);
    root.zIndex = p.y;
    const shadow = new Graphics()
      .ellipse(0, 6, 28, 10)
      .fill({ color: 0x071d1b, alpha: 0.32 });
    const base = new Graphics()
      .ellipse(0, 6, 30, 10)
      .fill({ color: enemy ? 0x8e6756 : 0x5a927c, alpha: 0.13 })
      .stroke({ color: enemy ? 0xbc826a : 0x93b994, width: 1, alpha: 0.5 });
    const ring = new Graphics()
      .ellipse(0, 6, 35, 13)
      .fill({ color: GOLD, alpha: 0.14 })
      .stroke({ color: 0xd6ac58, width: 2 });
    ring.visible = u.uid === this.selected;
    const sprite = new Sprite(this.textures[hero(u.heroId).art]);
    sprite.anchor.set(0.5, 1);
    sprite.height = 102;
    sprite.width = hero(u.heroId).art >= 20 ? 94 : 76.5;
    sprite.y = 5;
    const bars = new Graphics();
    const name = label(
      u.neutral ? "灵兽" : hero(u.heroId).name,
      14,
      enemy ? 0xf0baaa : 0xe5e8cd,
    );
    const hasItems = !!u.items?.length;
    name.anchor.set(hasItems ? 1 : 0.5, 0.5);
    name.position.set(hasItems ? -4 : 0, 16);
    name.style.stroke = { color: 0x102929, width: 2 };
    const caption = new Container();
    caption.eventMode = "none";
    caption.addChild(name);
    const status = new Graphics(),
      statusText = label("", 13, 0xf2dfad);
    statusText.anchor.set(0.5);
    statusText.y = -120;
    statusText.style.stroke = { color: 0x183635, width: 3 };
    root.addChild(
      shadow,
      base,
      ring,
      sprite,
      status,
      bars,
      caption,
      statusText,
    );
    (u.items ?? []).forEach((id, i) => {
      const x = 8 + i * 18;
      const plate = new Graphics()
        .roundRect(x - 8, 8, 16, 16, 2)
        .fill(0x172e2e)
        .stroke({ color: item(id).parts ? 0xc7a661 : 0x78949a, width: 1 });
      const glyph = new Sprite(this.itemTextures.get(id));
      glyph.width = glyph.height = 16;
      glyph.anchor.set(0.5);
      glyph.position.set(x, 16);
      caption.addChild(plate, glyph);
    });
    root.eventMode = "static";
    root.cursor = "pointer";
    root.hitArea = new Rectangle(-39, -93, 78, 125);
    root.on("pointerdown", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (
        !enemy &&
        !this.battle &&
        this.state.phase === "prepare" &&
        e.isPrimary &&
        e.button === 0 &&
        !this.drag
      ) {
        this.drag = {
          uid: u.uid,
          pointerId: e.pointerId,
          startX: e.global.x,
          startY: e.global.y,
          moving: false,
        };
      }
    });
    root.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (enemy) this.onSelect(u.uid);
    });
    const v: Visual = {
      root,
      sprite,
      bars,
      ring,
      status,
      statusText,
      label: name,
      caption,
      enemy,
      star: u.star,
      factor: 1,
      x: p.x,
      y: p.y,
      hp: 1,
      mana: 0,
      hit: 0,
      seed: this.visuals.size * 1.7,
    };
    this.visuals.set(u.uid, v);
    this.actors.addChild(root);
    this.sizeVisual(v);
    v.caption.visible = !this.battle && (!enemy || !this.compact);
    this.drawBars(v, 1, 0, enemy, 0);
  }
  private drawBars(
    v: Visual,
    hp: number,
    mana: number,
    enemy: boolean,
    shield: number,
  ) {
    v.bars
      .clear()
      .roundRect(-31, -108, 62, 13, 2)
      .fill({ color: 0x091d22, alpha: 0.94 })
      .stroke({ color: enemy ? 0xad7666 : 0x83ad99, alpha: 0.65, width: 1 })
      .rect(-28, -105, 56 * Math.max(0, Math.min(1, hp)), 5)
      .fill(enemy ? 0xcc8a74 : 0x98c5a0)
      .rect(-28, -98, 56 * Math.min(1, mana), 2)
      .fill(0x8ebcd5);
    // Star pips live beside the health strip, freeing the name/equipment line.
    for (let i = 0; i < v.star; i++)
      v.bars
        .poly([
          35 + i * 8,
          -106,
          38 + i * 8,
          -102,
          35 + i * 8,
          -98,
          32 + i * 8,
          -102,
        ])
        .fill(v.star === 3 ? 0xffd271 : v.star === 2 ? 0xdfc08b : 0xafc6b5);
    if (shield > 0)
      v.bars.rect(-28, -110, 56 * Math.min(1, shield), 2).fill(0xf6d68c);
  }
  private dragMove(e: FederatedPointerEvent) {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (Math.hypot(e.global.x - drag.startX, e.global.y - drag.startY) > 8)
      drag.moving = true;
    if (drag.moving) {
      const v = this.visuals.get(drag.uid);
      if (v) v.root.alpha = 0.3;
      this.onDragMove(drag.uid, e.client.x, e.client.y);
    }
  }
  private dragEnd(e: FederatedPointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    if (d.moving) {
      if (!this.onDrop(d.uid, e.client.x, e.client.y)) {
        const p = this.clientCell(e.client.x, e.client.y);
        if (p !== null) this.onMove(d.uid, p);
      }
      this.sync(this.state, this.selected);
    } else this.onSelect(d.uid);
  }
  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const v = this.visuals.get(d.uid);
    if (v) v.root.alpha = 1;
    this.onDragCancel();
  }
  nearest(x: number, y: number) {
    return boardCellAt(x, y);
  }
  clientCell(clientX: number, clientY: number) {
    if (!this.ready) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )
      return null;
    return this.nearest(
      (clientX - rect.left - this.offsetX) / this.scale,
      (clientY - rect.top - this.offsetY) / this.scaleY,
    );
  }
  clientUnit(clientX: number, clientY: number) {
    if (!this.ready) return null;
    const r = this.app.canvas.getBoundingClientRect();
    const point = { x: clientX - r.left, y: clientY - r.top };
    const candidates = [...this.visuals.entries()]
      .filter(([uid]) => this.state.units.some((u) => u.uid === uid))
      .sort((a, b) => b[1].root.y - a[1].root.y);
    return (
      candidates.find(([, v]) => {
        const local = v.root.toLocal(point);
        return v.root.alpha > 0.1 && v.root.hitArea?.contains(local.x, local.y);
      })?.[0] ?? null
    );
  }
  begin(battle: Battle) {
    this.battle = battle;
    this.paused = false;
    this.lastTick = -1;
    this.clearActors();
    for (const f of battle.fighters) this.makeVisual(f, f.team === 1);
    this.clearPlacement();
    this.highlight();
  }
  end() {
    this.battle = null;
    this.paused = false;
    this.sync(this.state, null);
  }
  private tick(dt: number) {
    this.clock += dt;
    if (!this.reducedMotion)
      this.motes.children.forEach((p, i) => {
        p.y -= dt * (3 + (i % 3));
        p.x += Math.sin(this.clock * 0.3 + i) * dt * 2;
        if (p.y < 0) p.y = H;
      });
    if (this.battle && !this.paused) {
      for (let i = 0; i < this.speed; i++) this.battle.update(dt);
      for (const f of this.battle.fighters)
        if (!this.visuals.has(f.uid)) {
          this.makeVisual(f, f.team === 1);
          if (f.summonOf) {
            const v = this.visuals.get(f.uid)!;
            v.factor = 0.65;
            this.sizeVisual(v);
            v.label.text = "幻羽";
          }
        }
      for (const e of this.battle.events.splice(0)) this.effect(e);
      for (const f of this.battle.fighters) {
        const v = this.visuals.get(f.uid);
        if (!v) continue;
        const point = boardPoint(f.position!);
        v.x = point.x;
        v.y = point.y;
        v.root.alpha = f.hp <= 0 ? Math.max(0, v.root.alpha - dt * 3) : 1;
        this.drawBars(
          v,
          f.hp / f.maxHp,
          f.mana / 100,
          f.team === 1,
          f.shield / f.maxHp,
        );
        this.drawStatus(v, f);
      }
      const second = Math.floor(this.battle.time);
      if (second !== this.lastTick) {
        this.lastTick = second;
        this.onTick(this.battle);
      }
      if (this.battle.done) {
        const finished = this.battle;
        this.battle = null;
        this.onFinish(finished);
      }
    }
    for (const v of this.visuals.values()) {
      if (
        this.drag?.uid !== v.root.label &&
        this.drag?.uid &&
        this.visuals.get(this.drag.uid) === v
      )
        continue;
      v.root.x += (v.x - v.root.x) * Math.min(1, dt * 12);
      v.root.y += (v.y - v.root.y) * Math.min(1, dt * 12);
      v.root.zIndex = v.root.y;
      v.sprite.y =
        5 + (this.reducedMotion ? 0 : Math.sin(this.clock * 2 + v.seed) * 1.7);
      v.hit = Math.max(0, v.hit - dt);
      v.sprite.tint = v.hit > 0 ? 0xffc5a2 : 0xffffff;
    }
    this.effects = this.effects.filter((e) => {
      e.life += dt;
      e.update(Math.min(1, e.life / e.duration));
      if (e.life >= e.duration) {
        e.node.destroy({ children: true });
        return false;
      }
      return true;
    });
    this.spells.update(this.paused ? 0 : dt);
  }
  private drawStatus(v: Visual, f: Fighter) {
    const g = v.status;
    g.clear();
    const statuses: string[] = [];
    if (f.shield > 0)
      g.ellipse(0, -40, 34, 52)
        .fill({ color: 0xdbe6a3, alpha: 0.035 })
        .stroke({ color: 0xebdfa8, width: 1.1, alpha: 0.55 });
    if (f.stun > 0) {
      statuses.push(f.control || "眩晕");
      if (f.control === "冰冻")
        g.poly([-30, 5, -33, -55, -15, -75, 0, -62, 19, -78, 36, -45, 28, 5])
          .fill({ color: 0x9dd9ee, alpha: 0.25 })
          .stroke({ color: 0xcdf5ff, width: 1, alpha: 0.85 });
      else
        for (let i = 0; i < 3; i++) {
          const a = this.clock * 2 + i * 2.09;
          g.star(Math.cos(a) * 24, -85 + Math.sin(a) * 7, 4, 4, 2).fill(
            f.control === "魅惑" ? 0xe2abd8 : 0xe2c17b,
          );
        }
    }
    if (f.burn) {
      statuses.push("灼烧");
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 17,
          y = Math.sin(this.clock * 5 + i) * 6;
        g.poly([x - 7, 0, x - 3, -21 + y, x + 3, -10, x + 6, 0]).fill({
          color: 0xe9a04f,
          alpha: 0.6,
        });
      }
    }
    if (f.taunt > 0) statuses.push("嘲讽");
    if (f.haste > 0) statuses.push("急速");
    if (f.regenBuff > 0) statuses.push("回春");
    if (f.slow > 0) statuses.push("缓速");
    if (f.armorBreak > 0) statuses.push("破甲");
    const text = statuses.slice(0, 2).join(" · ");
    if (v.statusText.text !== text) v.statusText.text = text;
  }
  private effect(e: BattleEvent) {
    const from = this.visuals.get(e.from),
      to = this.visuals.get(e.to);
    if (!from || !to) return;
    if (e.type === "attack") {
      const fighter = this.battle?.fighters.find((f) => f.uid === e.from);
      if (fighter)
        this.spells.attack(
          fighter.heroId,
          this.effectPoint(from.root),
          this.effectPoint(to.root),
        );
      this.onSound("hit");
    } else if (e.type === "damage" || e.type === "heal") {
      if (e.type === "damage") to.hit = 0.12;
      if (!e.value || this.effects.length >= 12) return;
      const numberKey = `${e.to}:${e.type}`;
      if (this.clock - (this.lastNumber.get(numberKey) ?? -10) < 0.32) return;
      this.lastNumber.set(numberKey, this.clock);
      const t = label(
        `${e.type === "heal" ? "+" : ""}${e.value}`,
        e.type === "heal" ? 12 : 14,
        e.type === "heal" ? 0x367959 : 0x714435,
      );
      t.style.fontWeight = "bold";
      t.style.stroke = { color: 0xfff5d9, width: 2 };
      t.anchor.set(0.5);
      const point = this.effectPoint(to.root);
      const x = point.x + (e.type === "heal" ? 32 : -32),
        y = point.y - 60;
      this.fx.addChild(t);
      this.effects.push({
        node: t,
        life: 0,
        duration: 0.6,
        update: (p) => {
          t.position.set(x, y - p * 22);
          t.alpha = 1 - p * p;
        },
      });
    } else if (e.type === "revive" || e.type === "summon") {
      this.spells.revive(this.effectPoint(to.root));
    } else if (e.type === "skill") {
      const fighter = this.battle?.fighters.find((f) => f.uid === e.from);
      if (fighter) {
        const points = (e.targets ?? [e.to])
          .map((id) => this.visuals.get(id))
          .filter((v): v is Visual => !!v)
          .map((v) => this.effectPoint(v.root));
        this.spells.play(fighter.heroId, this.effectPoint(from.root), points);
      }
      this.onSound("skill");
      if (fighter?.team !== 0 || this.effects.length >= 8) return;
      const t = label(e.skill ?? "", 12, 0x805d25);
      t.style.stroke = { color: 0xfff7dd, width: 3 };
      t.anchor.set(0.5);
      const point = this.effectPoint(from.root);
      t.position.set(point.x, point.y + 18);
      this.fx.addChild(t);
      this.effects.push({
        node: t,
        life: 0,
        duration: 0.7,
        update: (p) => {
          t.alpha = 1 - p * p;
          t.y = point.y + 18 - p * 5;
        },
      });
    }
  }
}
