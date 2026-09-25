import { BOARD_CELLS, PLAYER_START } from "./rules";
import { item } from "./equipment";
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
  type FederatedPointerEvent,
} from "pixi.js";
import { hero } from "./data";
import { opponentUnits, type GameState, type Unit } from "./game";
import { Battle, coords, type Fighter, type BattleEvent } from "./battle";
import { SpellEffects } from "./effects";

interface Visual {
  root: Container;
  sprite: Sprite;
  bars: Graphics;
  ring: Graphics;
  status: Graphics;
  statusText: Text;
  label: Text;
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
export const SCENE_WIDTH = 920,
  SCENE_HEIGHT = 480;
const W = SCENE_WIDTH,
  H = SCENE_HEIGHT;
const GOLD = 0xc3a269,
  JADE = 0x346960;
export function boardPoint(p: number) {
  const { col, row } = coords(p);
  return { x: 148 + col * 96 + (row % 2) * 48, y: 122 + row * 38 };
}
function hex(x: number, y: number, r = 49) {
  return [
    x,
    y - r * 0.65,
    x + r * 0.9,
    y - r * 0.325,
    x + r * 0.9,
    y + r * 0.325,
    x,
    y + r * 0.65,
    x - r * 0.9,
    y + r * 0.325,
    x - r * 0.9,
    y - r * 0.325,
  ];
}
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
  private actors = new Container();
  private fx = new Container();
  private motes = new Container();
  private textures: Texture[] = [];
  private visuals = new Map<string, Visual>();
  private effects: Effect[] = [];
  private tiles: Graphics[] = [];
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
    const atlas = await Assets.load<Texture>("/assets/heroes.png");
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
      const tex = await Assets.load<Texture>(path);
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
      const compact = privateHost.clientHeight < 310;
      const compression = compact ? 0.62 : 1;
      const headroom = compact ? 44 : 0;
      this.scale = Math.min(
        privateHost.clientWidth / W,
        privateHost.clientHeight / (H * compression + headroom),
      );
      this.scaleY = this.scale * compression;
      this.offsetX = (privateHost.clientWidth - W * this.scale) / 2;
      this.offsetY =
        headroom * this.scale +
        (privateHost.clientHeight - H * this.scaleY - headroom * this.scale) /
          2;
      this.world.scale.set(this.scale, this.scaleY);
      for (const v of this.visuals.values())
        v.root.scale.y = (v.root.scale.x * this.scale) / this.scaleY;
      this.world.position.set(this.offsetX, this.offsetY);
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
    const stone = [
      100, 34, 782, 34, 864, 76, 864, 421, 805, 451, 116, 451, 66, 422, 66, 76,
    ];
    this.board.addChild(
      new Graphics()
        .ellipse(462, 409, 422, 55)
        .fill({ color: 0x081c19, alpha: 0.55 }),
    );
    this.board.addChild(
      new Graphics()
        .poly(stone.map((n, i) => (i % 2 ? n + 12 : n)))
        .fill(0x122e29)
        .stroke({ color: 0x8a7348, width: 2 }),
    );
    this.board.addChild(
      new Graphics()
        .poly(stone)
        .fill({ color: 0x355449, alpha: 0.97 })
        .stroke({ color: 0xc1a56a, width: 2 }),
    );
    const engraving = new Graphics()
      .ellipse(465, 251, 148, 104)
      .stroke({ color: GOLD, alpha: 0.12, width: 2 })
      .ellipse(465, 251, 134, 95)
      .stroke({ color: GOLD, alpha: 0.12, width: 1 });
    engraving
      .poly([400, 290, 429, 211, 461, 255, 497, 196, 531, 290])
      .stroke({ color: GOLD, alpha: 0.13, width: 4 });
    this.board.addChild(engraving);
    for (let p = 0; p < BOARD_CELLS; p++) {
      const { x, y } = boardPoint(p),
        enemy = p < PLAYER_START;
      const tile = new Graphics()
        .poly(hex(x, y, 46))
        .fill({ color: enemy ? 0x475a4d : 0x516f5b, alpha: 0.5 })
        .stroke({ color: enemy ? 0x7a8061 : 0x94a779, alpha: 0.5, width: 1 });
      tile.eventMode = "static";
      tile.cursor = "pointer";
      tile.hitArea = new Polygon(hex(x, y, 46));
      tile.on("pointertap", () => {
        if (!this.drag) this.onCell(p);
      });
      this.tiles.push(tile);
      this.board.addChild(tile);
    }
    this.board.addChild(
      new Graphics()
        .moveTo(104, 255)
        .lineTo(812, 255)
        .stroke({ color: GOLD, width: 1, alpha: 0.45 }),
    );
    for (const [text, x, y] of [
      ["敌 方", 460, 48],
      ["己 方 · 四 行 布 阵", 460, 438],
    ] as const) {
      const t = label(text, 10, 0xc1c5a4);
      t.anchor.set(0.5);
      t.position.set(x, y);
      this.board.addChild(t);
    }
    for (const x of [81, 849])
      for (const y of [73, 418]) {
        this.board.addChild(
          new Graphics()
            .ellipse(x, y + 8, 17, 8)
            .fill(0x163d33)
            .rect(x - 3, y - 22, 6, 30)
            .fill(0x827455)
            .poly([
              x - 12,
              y - 23,
              x,
              y - 34,
              x + 12,
              y - 23,
              x + 7,
              y - 9,
              x - 7,
              y - 9,
            ])
            .fill(0xa39e72)
            .stroke({ color: 0xd1b376, width: 1 })
            .circle(x, y - 18, 4)
            .fill(0xffdf9a),
        );
      }
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
    if (!this.ready || this.battle) return;
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
        const point = boardPoint(unit.position!);
        const ring = new Graphics()
          .ellipse(0, 0, 40, 22)
          .stroke({ color: 0xffdf8b, width: 3 });
        ring.position.set(point.x, point.y);
        this.fx.addChild(ring);
        this.effects.push({
          node: ring,
          life: 0,
          duration: 0.8,
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
        t.scale.y = this.scale / this.scaleY;
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
    for (const [uid, v] of this.visuals) v.ring.visible = uid === this.selected;
    this.tiles.forEach((tile, i) => {
      tile.tint = this.selected && i >= PLAYER_START ? 0xfff3d0 : 0xffffff;
    });
  }
  private clearActors() {
    this.spells.clear();
    this.visuals.clear();
    this.actors.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.effects.forEach((e) => e.node.destroy({ children: true }));
    this.effects = [];
  }
  private makeVisual(u: Unit, enemy: boolean) {
    const p = boardPoint(u.position!),
      root = new Container();
    root.position.set(p.x, p.y);
    root.scale.y = this.scale / this.scaleY;
    root.zIndex = p.y;
    const shadow = new Graphics()
      .ellipse(0, 6, 28, 10)
      .fill({ color: 0x263e36, alpha: 0.18 });
    const base = new Graphics()
      .ellipse(0, 6, 29, 10)
      .stroke({ color: enemy ? 0xaf7260 : 0x679187, width: 1.5, alpha: 0.7 });
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
      `${u.neutral ? "灵兽" : hero(u.heroId).name} ${"★".repeat(u.star)}`,
      11,
      enemy ? 0xf0baaa : 0xe5e8cd,
    );
    name.anchor.set(0.5, 0);
    name.y = 17;
    const status = new Graphics(),
      statusText = label("", 10, 0x46797b);
    statusText.anchor.set(0.5);
    statusText.y = -117;
    root.addChild(shadow, base, ring, sprite, status, bars, name, statusText);
    (u.items ?? []).forEach((id, i) => {
      const x = (i - ((u.items?.length ?? 1) - 1) / 2) * 19;
      const plate = new Graphics()
        .roundRect(x - 8, 33, 16, 16, 2)
        .fill(0x172e2e)
        .stroke({ color: item(id).parts ? 0xc7a661 : 0x78949a, width: 1 });
      const glyph = label(item(id).glyph, 10, 0xf2dfab);
      glyph.anchor.set(0.5);
      glyph.position.set(x, 41);
      root.addChild(plate, glyph);
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
      x: p.x,
      y: p.y,
      hp: 1,
      mana: 0,
      hit: 0,
      seed: this.visuals.size * 1.7,
    };
    this.visuals.set(u.uid, v);
    this.actors.addChild(root);
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
      .roundRect(-25, -103, 50, 5, 2)
      .fill({ color: 0x243e35, alpha: 0.65 })
      .roundRect(-24, -102, 48 * Math.max(0, hp), 3, 1)
      .fill(enemy ? 0xbb7963 : 0x6ea993);
    if (mana > 0)
      v.bars.rect(-24, -97, 48 * Math.min(1, mana), 2).fill(0x7faaa9);
    if (shield > 0)
      v.bars.rect(-24, -106, 48 * Math.min(1, shield), 2).fill(0xf6d68c);
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
    let best = -1,
      d = Infinity;
    for (let p = 0; p < BOARD_CELLS; p++) {
      const point = boardPoint(p),
        dist = Math.hypot((point.x - x) * 0.7, point.y - y);
      if (dist < d) {
        d = dist;
        best = p;
      }
    }
    return d < 47 ? best : null;
  }
  clientCell(clientX: number, clientY: number) {
    if (!this.ready) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    return this.nearest(
      (clientX - rect.left - this.offsetX) / this.scale,
      (clientY - rect.top - this.offsetY) / this.scaleY,
    );
  }
  clientUnit(clientX: number, clientY: number) {
    if (!this.ready) return null;
    const r = this.app.canvas.getBoundingClientRect();
    const x = (clientX - r.left - this.offsetX) / this.scale,
      y = (clientY - r.top - this.offsetY) / this.scaleY;
    const candidates = [...this.visuals.entries()]
      .filter(([uid]) => this.state.units.some((u) => u.uid === uid))
      .sort((a, b) => b[1].root.y - a[1].root.y);
    return (
      candidates.find(
        ([, v]) =>
          Math.abs(x - v.root.x) <= 39 &&
          y >= v.root.y - (93 * this.scale) / this.scaleY &&
          y <= v.root.y + 27,
      )?.[0] ?? null
    );
  }
  begin(battle: Battle) {
    this.battle = battle;
    this.paused = false;
    this.lastTick = -1;
    this.clearActors();
    for (const f of battle.fighters) this.makeVisual(f, f.team === 1);
    this.tiles.forEach((t) => (t.tint = 0xffffff));
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
            v.root.scale.set(0.65, (0.65 * this.scale) / this.scaleY);
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
      const g = new Graphics().circle(0, 0, 3).fill(0xf3e5b5);
      this.fx.addChild(g);
      const x = from.root.x,
        y = from.root.y - 48,
        tx = to.root.x,
        ty = to.root.y - 48;
      this.effects.push({
        node: g,
        life: 0,
        duration: 0.18,
        update: (p) => {
          g.position.set(x + (tx - x) * p, y + (ty - y) * p);
        },
      });
      this.onSound("hit");
    } else if (e.type === "damage" || e.type === "heal") {
      if (e.type === "damage") to.hit = 0.12;
      if (!e.value) return;
      const t = label(
        `${e.type === "heal" ? "+" : ""}${e.value}`,
        e.type === "heal" ? 14 : 16,
        e.type === "heal" ? 0x367959 : 0x714435,
      );
      t.style.fontWeight = "bold";
      t.style.stroke = { color: 0xfff5d9, width: 2 };
      t.anchor.set(0.5);
      const x = to.root.x + ((this.effects.length % 3) - 1) * 13,
        y = to.root.y - 88;
      this.fx.addChild(t);
      this.effects.push({
        node: t,
        life: 0,
        duration: 0.8,
        update: (p) => {
          t.position.set(x, y - p * 28);
          t.alpha = 1 - p * p;
        },
      });
    } else if (e.type === "revive" || e.type === "summon") {
      this.spells.revive({ x: to.root.x, y: to.root.y });
    } else if (e.type === "skill") {
      const fighter = this.battle?.fighters.find((f) => f.uid === e.from);
      if (fighter) {
        const points = (e.targets ?? [e.to])
          .map((id) => this.visuals.get(id))
          .filter((v): v is Visual => !!v)
          .map((v) => ({ x: v.root.x, y: v.root.y }));
        this.spells.play(
          fighter.heroId,
          { x: from.root.x, y: from.root.y },
          points,
        );
      }
      const color = hero(
        this.battle?.fighters.find((f) => f.uid === e.from)?.heroId ?? "nezha",
      ).color;
      const g = new Graphics()
        .ellipse(0, 0, 52, 31)
        .stroke({ color, width: 3 })
        .ellipse(0, 0, 43, 26)
        .stroke({ color: 0xe6c782, width: 1 });
      g.position.set(from.root.x, from.root.y);
      this.fx.addChild(g);
      this.effects.push({
        node: g,
        life: 0,
        duration: 0.65,
        update: (p) => {
          g.scale.set(0.4 + p * 1.6);
          g.alpha = 1 - p;
        },
      });
      const t = label(e.skill ?? "", 15, 0x805d25);
      t.style.stroke = { color: 0xfff7dd, width: 3 };
      t.anchor.set(0.5);
      t.position.set(from.root.x, from.root.y - 132);
      this.fx.addChild(t);
      this.effects.push({
        node: t,
        life: 0,
        duration: 1.2,
        update: (p) => {
          t.alpha = 1 - p * p;
          t.y -= 0.15;
        },
      });
      this.onSound("skill");
    }
  }
}
