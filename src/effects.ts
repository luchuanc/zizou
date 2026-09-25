import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { hero, type HeroId } from "./data";

interface Point {
  x: number;
  y: number;
}
interface Effect {
  node: Container;
  age: number;
  duration: number;
  animate: (p: number) => void;
  complete?: () => void;
}
type Missile = "arrow" | "flame" | "wisp" | "ice" | "orb";

/** Cosmetic effects only. Damage and targeting stay in the deterministic battle. */
export class SpellEffects {
  private effects: Effect[] = [];
  private glowTexture?: Texture;
  constructor(
    private layer: Container,
    private reduced = false,
  ) {}

  private glow(color: number, size: number) {
    if (!this.glowTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "#ffffffff");
      gradient.addColorStop(0.2, "#ffffffa0");
      gradient.addColorStop(0.55, "#ffffff30");
      gradient.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      this.glowTexture = Texture.from(canvas);
    }
    const sprite = new Sprite(this.glowTexture);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = size;
    sprite.tint = color;
    sprite.blendMode = "add";
    return sprite;
  }
  private add(
    node: Container,
    duration: number,
    animate: (p: number) => void,
    complete?: () => void,
  ) {
    // Budget effect groups, not individual particles. Old cosmetic effects can expire early.
    while (this.effects.length >= (this.reduced ? 24 : 48)) {
      this.effects.shift()!.node.destroy({ children: true });
    }
    this.layer.addChild(node);
    animate(0);
    this.effects.push({ node, age: 0, duration, animate, complete });
  }
  update(dt: number) {
    const finished: (() => void)[] = [];
    this.effects = this.effects.filter((e) => {
      e.age += dt;
      e.animate(Math.min(1, e.age / e.duration));
      if (e.age < e.duration) return true;
      e.node.destroy({ children: true });
      if (e.complete) finished.push(e.complete);
      return false;
    });
    // Impacts may add effects, so run callbacks after filtering the active list.
    finished.forEach((done) => done());
  }
  clear() {
    this.effects.forEach((e) => e.node.destroy({ children: true }));
    this.effects = [];
  }
  private burst(p: Point, color: number, size = 1, lift = false) {
    const node = new Container();
    node.position.set(p.x, p.y - 36);
    const flash = this.glow(color, 42 * size);
    const flecks = new Graphics();
    node.addChild(flash, flecks);
    this.add(node, this.reduced ? 0.22 : 0.4, (t) => {
      flash.alpha = (1 - t) ** 2 * 0.9;
      flash.scale.set((0.35 + t * 0.65) * size);
      flecks.clear();
      const count = this.reduced ? 3 : 6;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.4,
          distance = (10 + i * 3) * t * size;
        flecks
          .ellipse(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance * 0.65 - (lift ? t * 22 : 0),
            1.4 * (1 - t),
            (lift ? 3.5 : 1.4) * (1 - t),
          )
          .fill({ color, alpha: 1 - t });
      }
    });
  }
  private missile(
    a: Point,
    b: Point,
    color: number,
    kind: Missile,
    impact?: () => void,
    delay = 0,
    small = false,
  ) {
    const node = new Container(),
      shape = new Graphics();
    const aura = this.glow(color, small ? 19 : 32);
    node.addChild(aura, shape);
    if (kind === "arrow") {
      shape
        .poly([-16, -1.3, 9, -1.3, 9, -4, 17, 0, 9, 4, 9, 1.3, -16, 1.3])
        .fill(0xffedb1)
        .poly([-15, 0, -22, -5, -20, 0, -22, 5])
        .fill(color);
    } else if (kind === "ice") {
      shape
        .poly([-16, 0, 0, -6, 13, 0, 0, 6])
        .fill(color)
        .poly([-6, 0, 2, -3, 13, 0, 2, 3])
        .fill(0xe9ffff);
    } else {
      shape
        .moveTo(-21, 0)
        .quadraticCurveTo(-5, -3, 0, -7)
        .quadraticCurveTo(16, -7, 12, 3)
        .quadraticCurveTo(5, 12, -21, 0)
        .fill({ color, alpha: 0.85 })
        .ellipse(5, 0, 5, 3.5)
        .fill(0xfffbe1);
    }
    if (small) shape.scale.set(0.6);
    const travel = this.reduced
      ? 0.12
      : Math.min(0.34, 0.14 + Math.hypot(b.x - a.x, b.y - a.y) / 1600);
    this.add(
      node,
      travel + delay,
      (t) => {
        const u = Math.max(0, (t * (travel + delay) - delay) / travel);
        node.visible = u > 0;
        const arc = kind === "wisp" ? 22 : kind === "arrow" ? 8 : 3;
        node.position.set(
          a.x + (b.x - a.x) * u,
          a.y - 44 + (b.y - a.y) * u - Math.sin(u * Math.PI) * arc,
        );
        node.rotation = Math.atan2(
          b.y - a.y - Math.cos(u * Math.PI) * Math.PI * arc,
          b.x - a.x,
        );
        node.alpha = u > 0.94 ? (1 - u) / 0.06 : 0.95;
      },
      impact,
    );
  }
  private slash(p: Point, color: number, big = false) {
    const g = new Graphics();
    const r = big ? 46 : 23;
    // A filled crescent stays local to the impact; no line connects the fighters.
    g.moveTo(-r, 8)
      .quadraticCurveTo(5, -r, r, 3)
      .quadraticCurveTo(3, -r * 0.5, -r, 8)
      .fill({ color, alpha: 0.85 });
    g.position.set(p.x, p.y - 36);
    this.add(g, 0.23, (t) => {
      g.rotation = -0.4 + t * 0.9;
      g.scale.set(0.7 + t * 0.5);
      g.alpha = (1 - t) ** 0.7;
    });
  }
  private ground(p: Point, color: number, radius = 38) {
    const g = new Graphics()
      .ellipse(0, 0, radius, radius * 0.42)
      .fill({ color, alpha: 0.13 })
      .stroke({ color, alpha: 0.35, width: 1 });
    g.position.set(p.x, p.y + 3);
    this.add(g, 0.55, (t) => {
      g.scale.set(0.7 + t * 0.3);
      g.alpha = 1 - t;
    });
  }
  private fire(p: Point) {
    const node = new Container(),
      g = new Graphics();
    node.position.set(p.x, p.y - 9);
    const glow = this.glow(0xff933b, 55);
    glow.y = -20;
    node.addChild(glow, g);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 12,
        h = 24 + (i % 2) * 18;
      g.moveTo(x - 10, 0)
        .quadraticCurveTo(x - 13, -h * 0.5, x + 4, -h)
        .quadraticCurveTo(x + 2, -h * 0.35, x + 9, 0)
        .closePath()
        .fill({ color: i === 1 ? 0xffda81 : 0xef8439, alpha: 0.8 });
    }
    this.add(node, 0.46, (t) => {
      node.scale.set(0.7 + t * 0.3, 0.5 + Math.sin(t * Math.PI) * 0.5);
      node.alpha = (1 - t) ** 0.7;
    });
    this.burst(p, 0xffbc67, 0.8, true);
  }
  private ice(p: Point) {
    const g = new Graphics();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 14,
        h = i === 1 ? 45 : 28;
      g.poly([x - 8, 0, x - 3, -h, x + 8, -h * 0.6, x + 9, 0])
        .fill({ color: 0x8be7ed, alpha: 0.8 })
        .poly([x - 3, -h, x + 1, 0, x + 9, 0, x + 8, -h * 0.6])
        .fill({ color: 0xd6ffff, alpha: 0.6 });
    }
    g.position.set(p.x, p.y);
    this.add(g, 0.55, (t) => {
      g.scale.y = Math.min(1, t * 8);
      g.alpha = t < 0.4 ? 0.85 : (1 - t) * 1.4;
    });
    this.burst(p, 0xb4faff, 0.6);
  }
  private bloom(p: Point, color: number) {
    const node = new Container(),
      petals = new Graphics();
    node.position.set(p.x, p.y + 3);
    const aura = this.glow(color, 58);
    aura.scale.y *= 0.45;
    node.addChild(aura, petals);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      petals
        .ellipse(Math.cos(a) * 14, Math.sin(a) * 7, 10, 4)
        .fill({ color, alpha: 0.55 });
    }
    this.add(node, 0.62, (t) => {
      node.scale.set(0.65 + t * 0.3);
      node.alpha = Math.sin(Math.PI * t) * 0.7;
    });
    this.burst(p, color, 0.7, true);
  }
  private shield(p: Point, color: number) {
    const g = new Graphics()
      .moveTo(0, -80)
      .lineTo(26, -69)
      .lineTo(21, -32)
      .quadraticCurveTo(12, -18, 0, -12)
      .quadraticCurveTo(-12, -18, -21, -32)
      .lineTo(-26, -69)
      .closePath()
      .fill({ color, alpha: 0.16 })
      .stroke({ color, width: 1.5, alpha: 0.65 });
    g.position.set(p.x, p.y);
    this.add(g, 0.65, (t) => {
      g.scale.set(0.92 + Math.sin(t * Math.PI) * 0.08);
      g.alpha = Math.sin(t * Math.PI);
    });
  }
  private lightning(a: Point, b: Point) {
    const points = [a.x, a.y - 44];
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      points.push(
        a.x + (b.x - a.x) * t + (i % 2 ? 7 : -7),
        a.y - 44 + (b.y - a.y) * t,
      );
    }
    points.push(b.x, b.y - 44);
    const g = new Graphics()
      .poly(points, false)
      .stroke({ color: 0x9cceff, width: 4, alpha: 0.18 })
      .poly(points, false)
      .stroke({ color: 0xe4f7ff, width: 1.5, alpha: 0.8 });
    this.add(g, 0.14, (t) => {
      g.alpha = 1 - t;
    });
    this.burst(b, 0xb9dbff, 0.8);
  }
  attack(id: HeroId, from: Point, to: Point) {
    const h = hero(id);
    if (h.range <= 1) {
      this.slash(to, 0xe8d6a0);
      return;
    }
    const kind: Missile =
      h.role === "游侠" ? (id === "bai" ? "wisp" : "arrow") : "orb";
    this.missile(
      from,
      to,
      Number.parseInt(h.color.replace("#", ""), 16),
      kind,
      undefined,
      0,
      true,
    );
  }
  play(id: HeroId, from: Point, targets: Point[]) {
    const to = targets[0] ?? from;
    // Large area skills keep one field and up to three impacts, never one overlay per unit.
    const visible = targets.slice(0, this.reduced ? 2 : 3);
    switch (id) {
      case "nezha":
        this.missile(from, to, 0xffb64d, "flame", () => this.fire(to));
        break;
      case "erlang":
        this.missile(from, to, 0xffe7ac, "ice", () =>
          this.slash(to, 0xffe3a0, true),
        );
        break;
      case "wukong":
        this.slash(from, 0xffdc7d, true);
        this.ground(from, 0xf3c878, 65);
        visible.forEach((p) => this.burst(p, 0xffd897, 0.65));
        break;
      case "aobing":
      case "gonggong":
        visible.forEach((p, i) =>
          this.missile(from, p, 0x9ceaf0, "ice", () => this.ice(p), i * 0.045),
        );
        break;
      case "phoenix":
      case "zhurong":
        this.ground(to, 0xffa455, 60);
        visible.forEach((p, i) =>
          this.missile(
            from,
            p,
            0xffb24e,
            "flame",
            () => this.fire(p),
            i * 0.05,
          ),
        );
        break;
      case "lei":
        this.lightning(from, to);
        if (visible[1]) this.lightning(to, visible[1]);
        break;
      case "change":
        visible.forEach((p) => this.bloom(p, 0xd6e9ff));
        break;
      case "jiang":
        visible.forEach((p) => this.shield(p, 0xe6ce92));
        break;
      case "nuwa":
      case "shennong":
        visible.forEach((p) =>
          this.bloom(p, id === "nuwa" ? 0xbcdfaf : 0x8dddd0),
        );
        break;
      case "fuxi":
        this.ground(from, 0xe4d197, 55);
        visible.forEach((p) => this.shield(p, 0xd9d697));
        break;
      case "xuanwu":
      case "chiyou":
        this.shield(from, id === "chiyou" ? 0xe5aa6e : 0x9cdbc4);
        break;
      case "tiger":
        this.slash(to, 0xfff2cf, true);
        this.burst(to, 0xe7e7c1);
        break;
      case "houyi":
        for (let i = 0; i < 3; i++)
          this.missile(
            from,
            to,
            0xffce6e,
            "arrow",
            () => this.burst(to, 0xffe3a5, 0.55),
            i * 0.075,
          );
        break;
      case "jingwei":
        this.missile(from, to, 0xdab081, "orb", () => this.burst(to, 0xf4c594));
        break;
      case "fox":
      case "daji":
        visible.forEach((p, i) =>
          this.missile(
            from,
            p,
            0xe2a1d9,
            "wisp",
            () => this.burst(p, 0xebbbeb, 0.9),
            i * 0.05,
          ),
        );
        break;
      case "zhongkui":
      case "bai":
        this.missile(from, to, 0xa6d6c9, "wisp", () =>
          this.burst(to, 0xc2e9d7),
        );
        break;
      case "mengpo":
        this.ground(to, 0xa2c8cc, 52);
        visible.forEach((p) => this.bloom(p, 0x91bfb9));
        break;
      case "yanluo":
        this.missile(
          { x: to.x + 28, y: to.y - 100 },
          to,
          0xc5a0ea,
          "wisp",
          () => {
            this.ground(to, 0xb39ddb, 48);
            this.burst(to, 0xd4b7ef, 1.3);
          },
        );
        break;
    }
  }
  revive(p: Point) {
    this.bloom(p, 0xc8e9af);
    this.shield(p, 0xc3e3b2);
  }
}
