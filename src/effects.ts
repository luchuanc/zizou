import { Container, Graphics } from "pixi.js";
import type { HeroId } from "./data";
interface Point {
  x: number;
  y: number;
}
interface Effect {
  node: Container;
  age: number;
  duration: number;
  animate: (p: number) => void;
}
export class SpellEffects {
  private effects: Effect[] = [];
  constructor(
    private layer: Container,
    private reduced = false,
  ) {}
  private add(node: Container, duration: number, animate: (p: number) => void) {
    if (this.effects.length > 320) {
      const old = this.effects.shift()!;
      old.node.destroy({ children: true });
    }
    this.layer.addChild(node);
    this.effects.push({ node, age: 0, duration, animate });
  }
  update(dt: number) {
    this.effects = this.effects.filter((e) => {
      e.age += dt;
      e.animate(Math.min(1, e.age / e.duration));
      if (e.age >= e.duration) {
        e.node.destroy({ children: true });
        return false;
      }
      return true;
    });
  }
  clear() {
    this.effects.forEach((e) => e.node.destroy({ children: true }));
    this.effects = [];
  }
  private ring(p: Point, color: number, radius = 48, duration = 0.7) {
    const g = new Graphics()
      .ellipse(0, 0, radius, radius * 0.55)
      .stroke({ color, width: 3, alpha: 0.85 })
      .ellipse(0, 0, radius * 0.84, radius * 0.46)
      .stroke({ color: 0xfff1b6, width: 1.5, alpha: 0.8 });
    g.position.set(p.x, p.y);
    this.add(g, duration, (t) => {
      g.scale.set(0.25 + t * 1.35);
      g.alpha = (1 - t) * 0.9;
    });
  }
  private sparks(p: Point, color: number, count = 12, lift = false) {
    if (this.reduced) count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2,
        dist = 22 + ((i * 17) % 53);
      const g = new Graphics().circle(0, 0, i % 3 === 0 ? 3 : 1.8).fill(color);
      g.blendMode = "add";
      const delay = (i % 4) * 0.03;
      this.add(g, 0.6 + delay, (t) => {
        g.position.set(
          p.x + Math.cos(angle) * dist * t,
          p.y -
            35 +
            (lift ? -75 * t : Math.sin(angle) * dist * t) -
            Math.sin(t * Math.PI) * 20,
        );
        g.alpha = (1 - t) * 0.95;
        g.scale.set(1 - t * 0.7);
      });
    }
  }
  private bolt(a: Point, b: Point, color: number, variant = 0) {
    const points: number[] = [a.x, a.y - 40];
    for (let i = 1; i < 9; i++) {
      const t = i / 9,
        jitter = Math.sin(i * 7.7 + variant * 3) * 16;
      points.push(a.x + (b.x - a.x) * t + jitter, a.y - 40 + (b.y - a.y) * t);
    }
    points.push(b.x, b.y - 40);
    const g = new Graphics()
      .poly(points, false)
      .stroke({ color, width: 9, alpha: 0.23 })
      .poly(points, false)
      .stroke({ color, width: 3.5, alpha: 0.95 })
      .poly(points, false)
      .stroke({ color: 0xffffff, width: 1.3 });
    g.blendMode = "add";
    this.add(g, 0.42, (t) => {
      g.alpha = (1 - t) * (Math.sin(t * 40) > 0 ? 0.95 : 0.55);
    });
  }
  private projectile(
    a: Point,
    b: Point,
    color: number,
    delay = 0,
    arrow = false,
  ) {
    const g = new Graphics();
    if (arrow)
      g.moveTo(-20, 0)
        .lineTo(13, 0)
        .stroke({ color, width: 2.5 })
        .poly([15, 0, 7, -4, 7, 4])
        .fill(0xfff2ad);
    else
      g.circle(0, 0, 8)
        .fill({ color, alpha: 0.25 })
        .circle(0, 0, 4)
        .fill(color)
        .circle(0, 0, 2)
        .fill(0xffffff);
    g.blendMode = "add";
    this.add(g, 0.4 + delay, (t) => {
      const u = Math.max(0, (t * (0.4 + delay) - delay) / 0.4);
      g.alpha = u > 0 ? 1 : 0;
      g.position.set(
        a.x + (b.x - a.x) * u,
        a.y - 48 + (b.y - a.y) * u - Math.sin(u * Math.PI) * 30,
      );
      g.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    });
  }
  private fire(p: Point, big = false) {
    this.ring(p, 0xfda94d, big ? 64 : 42);
    const g = new Graphics();
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 12,
        h = 30 + ((i * 13) % 38);
      g.moveTo(x - 10, 0)
        .quadraticCurveTo(x - 25, -h * 0.45, x + 4, -h)
        .quadraticCurveTo(x - 4, -h * 0.35, x + 11, 0)
        .closePath()
        .fill({ color: i % 2 ? 0xffb34d : 0xf2773c, alpha: 0.75 });
    }
    g.position.set(p.x, p.y);
    g.blendMode = "add";
    this.add(g, 0.9, (t) => {
      g.scale.set(
        0.6 + Math.sin(t * Math.PI) * 0.5,
        Math.sin(t * Math.PI) * 1.2 + 0.15,
      );
      g.alpha = 1 - t;
    });
    this.sparks(p, 0xffc569, 16, true);
  }
  private ice(p: Point) {
    this.ring(p, 0x89eced, 51);
    const g = new Graphics();
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 15,
        h = 35 + ((i * 19) % 49);
      g.poly([x - 11, 0, x - 4, -h, x + 8, -h * 0.7, x + 14, 0])
        .fill({ color: 0x84ddea, alpha: 0.6 })
        .stroke({ color: 0xe8ffff, width: 1.2, alpha: 0.9 });
    }
    g.position.set(p.x, p.y + 5);
    this.add(g, 1.15, (t) => {
      g.scale.y = Math.min(1, t * 6);
      g.alpha = t < 0.6 ? 0.9 : (1 - t) * 2.2;
    });
    this.sparks(p, 0xc9ffff, 10);
  }
  private lotus(p: Point, color = 0x97e0b9) {
    const g = new Graphics();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x = Math.cos(angle) * 26,
        y = Math.sin(angle) * 13;
      g.ellipse(x, y, 16, 8)
        .fill({ color, alpha: 0.25 })
        .stroke({ color, width: 1.3, alpha: 0.8 });
    }
    g.ellipse(0, 0, 43, 25).stroke({ color, width: 2 });
    g.position.set(p.x, p.y + 5);
    g.blendMode = "add";
    this.add(g, 1, (t) => {
      g.scale.set(0.6 + t * 0.6);
      g.alpha = Math.sin(t * Math.PI);
    });
    this.sparks(p, color, 9, true);
  }
  private shield(p: Point, color = 0xd9cb8c) {
    const g = new Graphics()
      .ellipse(0, -42, 38, 58)
      .fill({ color, alpha: 0.1 })
      .stroke({ color, width: 2.5, alpha: 0.9 })
      .ellipse(0, -42, 33, 52)
      .stroke({ color: 0xfff8d9, width: 1, alpha: 0.6 });
    g.position.set(p.x, p.y);
    this.add(g, 1.1, (t) => {
      g.scale.set(0.85 + Math.sin(t * Math.PI) * 0.18);
      g.alpha = Math.sin(t * Math.PI);
    });
  }
  private slash(p: Point, color = 0xffd47c, radius = 67) {
    const g = new Graphics()
      .arc(0, 0, radius, -2.7, 0.7)
      .stroke({ color, width: 12, alpha: 0.18 })
      .arc(0, 0, radius, -2.7, 0.7)
      .stroke({ color, width: 4, alpha: 0.9 })
      .arc(0, 0, radius - 9, -2.8, 0.5)
      .stroke({ color: 0xfff6cc, width: 1.8 });
    g.position.set(p.x, p.y - 30);
    g.scale.y = 0.5;
    g.blendMode = "add";
    this.add(g, 0.55, (t) => {
      g.rotation = t * 1.6 - 0.6;
      g.alpha = 1 - t;
      g.scale.x = 0.6 + t * 0.6;
    });
    this.sparks(p, color, 9);
  }
  private soul(a: Point, b: Point, color = 0xc69fed) {
    const g = new Graphics();
    const dx = b.x - a.x,
      dy = b.y - a.y,
      steps = Math.ceil(Math.hypot(dx, dy) / 13);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      g.ellipse(
        a.x + dx * t,
        a.y - 45 + dy * t + Math.sin(t * Math.PI) * 15,
        6,
        3,
      ).stroke({ color, width: 1.7, alpha: 0.9 });
    }
    g.blendMode = "add";
    this.add(g, 0.9, (t) => {
      g.alpha = Math.sin(t * Math.PI);
    });
    this.ring(b, color, 33);
    this.sparks(b, color, 7, true);
  }
  private bagua(p: Point) {
    const g = new Graphics()
      .ellipse(0, 0, 76, 43)
      .stroke({ color: 0xf3d78f, width: 2 })
      .ellipse(0, 0, 65, 36)
      .stroke({ color: 0xf3d78f, width: 1 })
      .circle(0, 0, 17)
      .stroke({ color: 0xf3d78f, width: 2 });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        x = Math.cos(a) * 52,
        y = Math.sin(a) * 28;
      for (let j = 0; j < 3; j++)
        g.moveTo(x - 7, y + j * 3)
          .lineTo(x + 7, y + j * 3)
          .stroke({ color: 0xffecc1, width: 1.5 });
    }
    g.position.set(p.x, p.y);
    g.blendMode = "add";
    this.add(g, 1.5, (t) => {
      g.scale.set(0.7 + t * 0.5);
      g.alpha = Math.sin(t * Math.PI);
    });
  }
  play(id: HeroId, from: Point, targets: Point[]) {
    const to = targets[0] ?? from;
    switch (id) {
      case "nezha":
        this.projectile(from, to, 0xffd36b);
        targets.forEach((p) => this.fire(p));
        this.slash(from, 0xffcf7d, 43);
        break;
      case "erlang":
        this.bolt({ x: from.x, y: from.y - 35 }, to, 0xffe5a0);
        this.slash(to, 0xfff1b4, 57);
        break;
      case "wukong":
        this.slash(from, 0xffd46d, 110);
        this.ring(from, 0xf8c777, 112);
        targets.forEach((p) => this.sparks(p, 0xffd683, 7));
        break;
      case "aobing":
      case "gonggong":
        targets.forEach((p) => this.ice(p));
        this.projectile(from, to, 0xb1f5ff);
        break;
      case "phoenix":
      case "zhurong":
        targets.forEach((p) => this.fire(p, true));
        this.slash(from, 0xff9b50, 76);
        break;
      case "lei": {
        let previous = from;
        targets.forEach((p, i) => {
          this.bolt(previous, p, 0x91bbff, i);
          this.sparks(p, 0xcbdeff, 8);
          previous = p;
        });
        break;
      }
      case "change":
        targets.forEach((p) => this.lotus(p, 0xd5e5ff));
        this.ring(from, 0xe9f1fc, 58);
        break;
      case "jiang":
      case "nuwa":
      case "shennong":
        targets.forEach((p) => this.lotus(p));
        if (id === "nuwa") this.bagua(from);
        break;
      case "fuxi":
        this.bagua(from);
        targets.forEach((p) => {
          this.shield(p);
          this.lotus(p, 0xd7e9a4);
        });
        break;
      case "xuanwu":
      case "chiyou":
        this.shield(from, id === "chiyou" ? 0xeeb479 : 0xa4dcbc);
        this.ring(from, 0xc7d991, 65);
        break;
      case "tiger":
        this.slash(to, 0xf5f2d9, 85);
        this.shield(from);
        break;
      case "houyi":
        for (let i = 0; i < 3; i++)
          this.projectile(
            { x: from.x + (i - 1) * 11, y: from.y - 8 * i },
            to,
            0xffd786,
            i * 0.08,
            true,
          );
        this.sparks(to, 0xffe8b6, 10);
        break;
      case "jingwei":
        this.projectile(from, to, 0xf8c29a);
        this.lotus(from, 0xf4d7b0);
        break;
      case "fox":
      case "daji":
        targets.forEach((p) => {
          this.soul(from, p, 0xe7a6eb);
          this.lotus(p, 0xe4abe9);
        });
        break;
      case "zhongkui":
      case "bai":
        targets.forEach((p) => this.soul(from, p, 0xb4e4d1));
        break;
      case "mengpo":
        targets.forEach((p) => {
          this.ring(p, 0xb4cece, 55, 1.1);
          this.sparks(p, 0xb0d8d1, 8, true);
        });
        break;
      case "yanluo":
        this.bolt({ x: to.x, y: to.y - 180 }, to, 0xc3a3e0);
        this.ring(to, 0xb099db, 68);
        this.slash(to, 0xdac2f1, 80);
        break;
    }
  }
  revive(p: Point) {
    this.bagua(p);
    this.sparks(p, 0xcfe8cc, 18, true);
  }
}
