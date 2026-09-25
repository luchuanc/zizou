import {
  BENCH_SIZE,
  MAX_LEVEL,
  SHOP_ODDS,
  PREP_SECONDS,
  PLAYER_START,
  roundInfo,
  streakIncome,
  baseIncome,
} from "./rules";
import { EQUIPMENT, COMPONENTS, item, combine, itemStats } from "./equipment";
import { availableCopies } from "./pool";
import {
  collectedLineup,
  lineupRecommendation,
  resolveLineup,
  type LineupPlan,
} from "./lineup";
import "./style.css";
import {
  HEROES,
  RELICS,
  TRAITS,
  REGIONS,
  XP_NEEDED,
  COST_COLORS,
  BONDS,
  BUILDS,
  PASSIVES,
  MAX_ROUNDS,
  EVENTS,
  hero,
  type HeroId,
} from "./data";
import {
  Game,
  opponentUnits,
  starScale,
  sellPrice,
  traits,
  type Unit,
  type SaveStore,
} from "./game";
import { rivalArmy } from "./ai";
import { Battle } from "./battle";
import { Scene } from "./scene";
import { Sound } from "./audio";

const paths: Record<string, string> = {
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2",
  sound: "M11 5 6 9H3v6h3l5 4z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14",
  mute: "M11 5 6 9H3v6h3l5 4z M16 9l5 6 M21 9l-5 6",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  refresh:
    "M20 8a8 8 0 0 0-14-3L3 8 M3 3v5h5 M4 16a8 8 0 0 0 14 3l3-3 M16 16h5v5",
  lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  unlock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0 M12 14v3",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  heart: "M12 21 3 12C-2 5 8 0 12 7 16 0 26 5 21 12z",
  coin: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M9 9h6v6H9z",
  up: "M5 14l7-7 7 7 M5 20l7-7 7 7",
  close: "M6 6l12 12 M6 18 12 6",
  sword: "M4 20 16 3l5-1-1 5L4 20 M4 12l8 8 M2 18l4 4",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  check: "M4 12l5 5L20 6",
  pause: "M8 5v14 M16 5v14",
  play: "M7 4l14 8-14 8z",
  leaf: "M4 20C0 6 12 3 21 3c0 12-5 18-15 14 M4 20 16 8",
};
const icon = (name: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.leaf}"/></svg>`;
const art = (id: HeroId, cls = "") => {
  const h = hero(id),
    index = h.art >= 20 ? h.art - 20 : h.art >= 12 ? h.art - 12 : h.art,
    cols = h.art >= 20 ? 2 : 4,
    rows = h.art >= 12 ? 2 : 3;
  return `<span class="hero-art ${h.art >= 20 ? "underworld" : h.art >= 12 ? "expansion" : ""} ${cls}" style="--art-x:${((index % cols) / (cols - 1)) * 100}%;--art-y:${(Math.floor(index / cols) / (rows - 1)) * 100}%" role="img" aria-label="${h.name}"></span>`;
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let storage: SaveStore | undefined;
try {
  storage = localStorage;
} catch {
  storage = undefined;
}
const game = new Game(storage),
  scene = new Scene(),
  sound = new Sound();
let selected: string | null = null,
  toastTimer: number | undefined,
  ready = false,
  modalKind = "";
let lastFocus: HTMLElement | null = null;
let modalPausedBattle = false;
let lastRenderedPhase: string | null = null;
let resultCountdown = 5;
let selectedItem: number | null = null;
let lineupDraft: HeroId[] = [];
const portraitQuery = matchMedia(
  "(orientation: portrait) and (max-width: 1000px)",
);
let portraitDialogPending = false;
let portraitPaused = false;

const root = $("#app");
root.innerHTML = `
  <div class="landscape" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="#" aria-label="山海弈首页"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/><h1>山海弈</h1><small>单机</small></a>
    <div class="journey"><div id="journey-progress"></div><span id="phase-label"></span><strong id="phase-timer">30</strong></div>
    <nav class="header-actions" aria-label="游戏菜单"><button data-action="builds" aria-label="预选阵容">${icon("leaf")}</button><button data-action="codex" aria-label="山海图鉴">${icon("book")}</button><button id="sound-button" data-action="sound" aria-label="开启音乐">${icon("mute")}</button><button data-action="fullscreen" aria-label="全屏横屏">⛶</button><button data-action="settings" aria-label="设置">${icon("settings")}</button></nav>
  </header>
  <main class="game-area">
    <aside class="left-panel"><div id="lineup-plan"></div><section class="synergy-section"><div class="section-heading"><h2>羁绊</h2><button data-action="builds">阵容 ↗</button></div><div id="traits"></div><div id="bonds"></div></section><section id="relics"></section><section class="inventory-wrap"><div class="section-heading"><h2>装备</h2><button data-action="equipment" aria-label="装备库与合成">合成 ↗</button></div><div id="inventory"></div></section></aside>
    <section class="battlefield" aria-label="战场"><div class="battle-top"><div id="round-label"></div><div class="formation-count" id="formation-count"></div><div id="opponent"></div></div>
      <div id="canvas-host"><div id="loading"><span class="loading-seal">弈</span><p>正在开启山海棋局…</p></div></div>
      <div id="battle-controls"></div><div id="round-report"></div>
      <div class="bench-wrap"><div class="bench-label"><span>备战</span><small id="bench-count">0/9</small></div><div id="bench" aria-label="备战英灵"></div><button class="formation-button" data-action="formation" aria-label="打开布阵面板">${icon("grid", 17)}</button></div>
    </section>
    <aside class="right-panel"><div class="section-heading"><h2>弈者</h2><button data-action="standings">排名 ↗</button></div><div id="standings"></div><div id="player"></div><div id="combat-damage"></div><button class="guide-link" data-action="help">${icon("book", 13)} 玩法手札</button></aside>
  </main>
  <footer class="recruitment"><div class="economy" id="economy"></div><section class="shop-wrap" aria-label="寻仙招募区"><div class="shop-heading"><div id="shop-meta"></div><button class="lock-button" id="lock-button" data-action="lock"></button></div><div id="shop"></div><div id="sell-zone" aria-hidden="true"></div></section><div class="round-actions" id="round-actions"></div></footer>
  <section id="inspector"></section>
  <div class="bottom-note"><span id="save-status">本地自动存档</span></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>
  <div class="orientation-guide"><div class="rotate-symbol">▯ ↻</div><h2>横屏，开启山海棋局</h2><p>请将手机旋转为横屏<br/>棋盘、备战席与商店将同时展开</p><button data-action="fullscreen" class="primary-button">进入全屏</button><small>旋转期间已暂停自动推进</small></div>
`;
const eqIcon = (id: string) =>
  `<span class="equipment-icon ${item(id).parts ? "complete" : ""}" title="${item(id).name}">${item(id).glyph}</span>`;
const canShop = () => ["prepare", "battle"].includes(game.state.phase);

function notify(message: string) {
  if (!message) return;
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("visible"), 2800);
}
function update() {
  const s = game.state,
    info = roundInfo(s.round),
    lineup = resolveLineup(s.lineupPlan);
  if (s.phase !== "prepare" && s.phase !== "battle") cancelUnitDrag();
  if (
    selected &&
    !s.units.some((u) => u.uid === selected) &&
    !opponentUnits(s).some((u) => u.uid === selected)
  )
    selected = null;
  const first = info.stage === 1 ? 1 : 4 + (info.stage - 2) * 7;
  $("#journey-progress").innerHTML =
    `<b class="stage-number">${info.label}</b>` +
    Array.from({ length: info.stage === 1 ? 3 : 7 }, (_, i) => {
      const r = roundInfo(first + i);
      return `<span class="stage-step ${first + i === s.round ? "current" : first + i < s.round ? "complete" : ""}" title="${r.label} ${r.name}${r.augment ? " · 天命强化" : ""}">${r.kind === "pve" ? "♜" : r.kind === "carousel" ? "◇" : r.augment ? "✦" : "⚔"}</span>`;
    }).join("");
  $("#phase-label").textContent =
    s.phase === "battle"
      ? "战斗"
      : s.phase === "prepare"
        ? "准备"
        : s.phase === "carousel"
          ? "选秀"
          : s.phase === "relic"
            ? "天命"
            : "结算";
  $("#phase-timer").textContent =
    s.phase === "prepare"
      ? String(s.preparation)
      : s.phase === "battle"
        ? String(Math.max(0, 60 - Math.floor(scene.battle?.time ?? 0)))
        : "—";
  $("#round-label").innerHTML =
    `<span>${info.name}</span><small>${REGIONS[Math.min(2, Math.floor((info.stage - 1) / 2))]}</small>`;
  $("#formation-count").innerHTML =
    `${icon("grid", 16)} <b>${game.deployed.length}</b><span>/${s.level}</span>`;
  $("#lineup-plan").innerHTML =
    `<button class="lineup-summary ${lineup ? "has-plan" : ""}" data-action="builds" aria-label="${lineup ? `更换预选阵容：${lineup.name}，已收集 ${collectedLineup(s.lineupPlan, s.units)}/${lineup.heroes.length}` : "预选阵容：当前自由搭配"}"><span>预选阵容 <i>↗</i></span><strong>${lineup?.name ?? "自由搭配"}</strong><small>${lineup ? `已收集 <b>${collectedLineup(s.lineupPlan, s.units)}/${lineup.heroes.length}</b>` : "点击选择 · 寻仙推荐"}</small></button>`;
  $("#traits").innerHTML =
    traits(s.units)
      .map(
        (t) =>
          `<button class="trait ${t.tier ? "active" : ""}" data-trait="${t.name}"><span class="trait-glyph">${TRAITS[t.name].icon}</span><b>${t.count}</b><span class="trait-name">${t.name}<small>${TRAITS[t.name].thresholds.map((n) => `<i class="${t.count >= n ? "reached" : ""}">${n}</i>`).join(" / ")}</small></span></button>`,
      )
      .join("") || '<p class="empty-copy">上阵英灵激活羁绊</p>';
  const ids = new Set(game.deployed.map((u) => u.heroId));
  $("#bonds").innerHTML = BONDS.filter((b) =>
    b.heroes.every((id) => ids.has(id)),
  )
    .map(
      (b) =>
        `<button class="bond-tag" data-bond="${b.id}">◇ ${b.name}</button>`,
    )
    .join("");
  const rival = s.rivals.find((r) => r.id === s.opponentId)!;
  $("#opponent").innerHTML =
    info.kind === "pve"
      ? `<span class="neutral-tag">野怪 · 击败获得装备</span>`
      : `<button class="opponent-name" data-scout="${rival.id}"><span>${rival.glyph}</span> ${rival.name} ${icon("arrow", 13)}</button>`;
  $("#standings").innerHTML = standingsRows(true);
  $("#player").innerHTML =
    `<div class="player-compact">${icon("heart", 13)}<b>${s.hp}</b><span>${s.streak === 0 ? "未连局" : s.streak > 0 ? "连胜 " + s.streak : "连败 " + Math.abs(s.streak)}</span></div>`;
  $("#relics").innerHTML = `<div class="relic-slots">${Array.from(
    { length: 3 },
    (_, i) => {
      const r = RELICS.find((r) => r.id === s.relics[i]);
      return r
        ? `<button data-relic="${r.id}" title="${r.name}">${r.glyph}</button>`
        : `<span title="2-1、3-2、4-2 获得天命强化">◇</span>`;
    },
  ).join("")}</div>`;
  $("#inventory").innerHTML =
    s.inventory
      .slice(0, 8)
      .map(
        (id, i) =>
          `<button data-item="${i}" aria-label="装备${item(id).name}" title="${item(id).name} · 拖到英灵穿戴">${eqIcon(id)}</button>`,
      )
      .join("") +
    (s.inventory.length > 8
      ? `<button data-action="equipment">+${s.inventory.length - 8}</button>`
      : "");
  $("#bench-count").textContent = `${game.bench.length}/${BENCH_SIZE}`;
  $("#bench").innerHTML = Array.from({ length: BENCH_SIZE }, (_, i) => {
    const u = game.bench[i];
    return u
      ? `<button class="bench-slot occupied ${u.uid === selected ? "selected" : ""}" data-unit="${u.uid}" aria-label="选择${hero(u.heroId).name} ${u.star}星">${art(u.heroId)}<span class="bench-stars">${"★".repeat(u.star)}</span>${u.items?.length ? `<i class="bench-item-dot">${u.items.length}</i>` : ""}</button>`
      : `<button class="bench-slot" data-action="bench" aria-label="空备战席 ${i + 1}"></button>`;
  }).join("");
  $("#economy").innerHTML =
    `<button class="train-button" data-action="xp" ${!canShop() || s.gold < 4 || s.level >= MAX_LEVEL ? "disabled" : ""}><span>购买经验</span><b>${icon("coin", 12)} 4 ${icon("up", 16)}</b></button><button class="refresh-button" data-action="refresh" ${!canShop() || s.gold < 2 ? "disabled" : ""}><span>刷新</span><b>${icon("coin", 12)} 2 ${icon("refresh", 16)}</b></button>`;
  $("#shop-meta").innerHTML =
    `<span class="shop-title">寻仙</span><span class="shop-level">Lv.${s.level} <small>${s.level >= MAX_LEVEL ? "满级" : s.xp + "/" + XP_NEEDED[s.level]}</small></span><div class="xp-track"><i style="width:${s.level >= MAX_LEVEL ? 100 : (s.xp / XP_NEEDED[s.level]) * 100}%"></i></div><button class="shop-odds" data-action="odds" aria-label="查看商店概率与共享卡池">${SHOP_ODDS[s.level].map((n, i) => `<span style="color:${COST_COLORS[i + 1]}">${n}%</span>`).join("")}</button>`;
  $("#lock-button").innerHTML = icon(s.locked ? "lock" : "unlock", 15);
  $("#lock-button").setAttribute(
    "aria-label",
    s.locked ? "解锁商店" : "锁定商店",
  );
  $("#lock-button").classList.toggle("locked", s.locked);
  ($("#lock-button") as HTMLButtonElement).disabled = !canShop();
  $("#shop").innerHTML = s.shop
    .map((id, i) => {
      if (!id) return '<div class="shop-card sold"><span>已招募</span></div>';
      const h = hero(id),
        owned = s.units.filter((u) => u.heroId === id && u.star === 1).length,
        anyOwned = s.units.some((u) => u.heroId === id),
        recommendation = lineupRecommendation(s.lineupPlan, id),
        status = owned >= 2 ? "可升星" : anyOwned ? "已拥有" : "";
      return `<div class="shop-card ${recommendation ? "recommended" : ""}" ${recommendation ? `data-recommendation="${recommendation.kind}"` : ""} style="--rarity:${COST_COLORS[h.cost]}"><button class="card-buy" data-buy="${i}" ${!canShop() || s.gold < h.cost ? "disabled" : ""} aria-label="招募${h.name}，${h.cost}灵石${recommendation ? `，${lineup!.name}，${recommendation.label}` : ""}${status ? `，${status}` : ""}"><div class="card-illustration">${art(id)}${status ? `<span class="${owned >= 2 ? "merge-tag" : "owned-tag"}">${status}</span>` : ""}</div><div class="card-traits"><span>${TRAITS[h.origin].icon} ${h.origin}</span><span>${TRAITS[h.role].icon} ${h.role}</span></div><div class="card-caption"><h3>${h.name}</h3><b>${icon("coin", 11)} ${h.cost}</b></div></button>${recommendation ? `<span class="recommendation-tag" aria-hidden="true">${recommendation.label}</span>` : ""}<button class="card-info" data-hero="${id}" aria-label="查看${h.name}技能">i</button></div>`;
    })
    .join("");
  $("#round-actions").innerHTML =
    `<button class="gold-total" data-action="income" aria-label="查看收入明细">${icon("coin", 18)}<strong>${s.gold}</strong></button><div class="interest-pips" title="利息 ${Math.min(s.relics.includes("savings") ? 7 : 5, Math.floor(s.gold / 10))}">${Array.from({ length: s.relics.includes("savings") ? 7 : 5 }, (_, i) => `<i class="${s.gold >= (i + 1) * 10 ? "lit" : ""}"></i>`).join("")}</div><button class="battle-button" data-action="${s.phase === "result" ? "continue" : "battle"}" ${!["prepare", "result"].includes(s.phase) || !ready ? "disabled" : ""}>${s.phase === "battle" ? "交战中" : s.phase === "result" ? "下一回合" : "立即开战"}</button><button class="auto-toggle" data-action="autoplay" aria-label="${s.autoAdvance ? "暂停自动推进" : "恢复自动推进"}">${icon(s.autoAdvance ? "pause" : "play", 12)} ${s.autoAdvance ? "自动" : "已暂停"}</button>`;
  $("#round-report").innerHTML =
    s.phase === "result" && s.result
      ? `<button data-action="result" class="round-result-banner ${s.result.won ? "won" : ""}"><b>${s.result.draw ? "平局" : s.result.won ? "胜利" : "惜败"}</b><span>灵石 +${s.result.income}${s.result.damage ? " · 气血 -" + s.result.damage : ""}</span><span>${s.result.loot?.map((id) => eqIcon(id)).join("") ?? ""}</span><small>战况 ↗</small></button>`
      : "";
  renderInspector();
  renderBattleControls();
  renderDamage();
  $("#save-status").textContent =
    game.storageWarning || !storage ? "存档不可用" : "单机 · 自动存档";
  if (ready) scene.sync(s, selected);
  const changed = lastRenderedPhase !== s.phase;
  lastRenderedPhase = s.phase;
  if (changed) resultCountdown = 5;
  if (changed || !$<HTMLDialogElement>("#modal").open) {
    if (s.phase === "ended") showResult();
    else if (s.phase === "relic") showRelics();
    else if (s.phase === "carousel") showCarousel();
    else if (s.phase === "event") showEvent();
  }
  if (
    ready &&
    s.phase === "prepare" &&
    !s.lineupPromptSeen &&
    !$<HTMLDialogElement>("#modal").open &&
    !portraitDialogPending
  )
    showBuilds();
}
function renderDamage() {
  const b = scene.battle;
  const entries = b
    ? b.fighters
        .filter((f) => f.team === 0 && !f.summonOf)
        .map((f) => ({ name: hero(f.heroId).name, value: f.damage }))
    : Object.entries(game.state.result?.damageByUnit ?? {}).map(
        ([id, value]) => ({
          name: hero(
            game.state.units.find((u) => u.uid === id)?.heroId ?? "nezha",
          ).name,
          value,
        }),
      );
  entries.sort((a, b) => b.value - a.value);
  const max = entries[0]?.value || 1;
  $("#combat-damage").innerHTML = entries.length
    ? "<h3>伤害统计</h3>" +
      entries
        .slice(0, 5)
        .map(
          (e) =>
            `<div><span>${e.name}</span><b>${Math.round(e.value)}</b><i style="width:${(e.value / max) * 100}%"></i></div>`,
        )
        .join("")
    : "";
}
function renderBattleControls() {
  const s = game.state;
  const u = s.units.find((unit) => unit.uid === selected);
  $("#battle-controls").innerHTML =
    s.phase === "battle"
      ? `<div class="combat-toolbar"><span id="combat-time">${Math.floor(scene.battle?.time ?? 0)} / 60 秒</span><button data-action="pause">${icon(scene.paused ? "play" : "pause", 15)} ${scene.paused ? "继续" : "暂停"}</button><button data-action="speed">${scene.speed}× 速度</button></div>`
      : s.phase === "prepare"
        ? u
          ? `<div class="unit-action-bar" aria-label="已选英灵操作"><div class="unit-action-info"><strong>${hero(u.heroId).name} <span>${"★".repeat(u.star)}</span></strong><small>${u.position === null ? "备战席 · 点棋格上阵" : "已上阵 · 点棋格移动"}</small></div><button class="unit-sell" data-action="sell" aria-label="出售${hero(u.heroId).name}，获得 ${sellPrice(u)} 灵石">出售 <span>${icon("coin", 14)} +${sellPrice(u)}</span></button><button class="unit-action-close" data-action="deselect" aria-label="取消选择">${icon("close", 17)}</button></div>`
          : `<div class="formation-hint">${s.round === 1 ? "招募 · 布阵 · 拖动装备到英灵" : "拖向寻仙区可出售 · 点击装备查看合成"}</div>`
        : "";
}
function selectedUnit() {
  return (
    game.state.units.find((u) => u.uid === selected) ??
    opponentUnits(game.state).find((u) => u.uid === selected)
  );
}
function renderInspector() {
  const u = selectedUnit();
  if (!u) {
    $("#inspector").innerHTML = "";
    return;
  }
  const h = hero(u.heroId),
    enemy = !game.state.units.some((v) => v.uid === u.uid);
  $("#inspector").innerHTML =
    `<div class="unit-detail"><button class="inspector-close" data-action="deselect" aria-label="取消选择">${icon("close", 14)}</button><div class="detail-art">${art(u.heroId)}</div><h3>${h.name}<span>${"★".repeat(u.star)}</span></h3><p class="unit-subtitle">${h.origin} · ${h.role}</p><div class="mini-stats"><span>基础生命 <b>${Math.round(h.hp * starScale(u.star))}</b></span><span>基础攻击 <b>${Math.round(h.atk * starScale(u.star))}</b></span></div><h4>${h.skill}</h4><p class="skill-copy">${h.description}</p>${!enemy ? `<div class="unit-equipment">${(u.items ?? []).map((id) => `<button data-gear="${id}" aria-label="查看${item(id).name}">${eqIcon(id)}</button>`).join("")}<button data-action="equipment">装备 +</button></div><div class="unit-commands"><button data-action="formation">布阵</button><button data-action="sell" ${!canShop() || (game.state.phase === "battle" && u.position !== null) ? "disabled" : ""}>出售 <span>+${sellPrice(u)}</span></button></div>` : ""}</div>`;
}
function select(uid: string) {
  selected = selected === uid ? null : uid;
  renderSelection();
}
function renderSelection() {
  scene.select(selected);
  renderInspector();
  renderBattleControls();
  document
    .querySelectorAll<HTMLElement>("[data-unit]")
    .forEach((b) =>
      b.classList.toggle("selected", b.dataset.unit === selected),
    );
}
function move(uid: string, p: number | null) {
  const message = game.move(uid, p);
  if (message) notify(message);
  else {
    sound.play("move");
    selected = null;
    renderSelection();
  }
}

function openModal(content: string, kind: string, closable = true) {
  cancelUnitDrag();
  modalKind = kind;
  const dialog = $<HTMLDialogElement>("#modal");
  if (scene.battle && !scene.paused && !dialog.open) {
    scene.paused = true;
    modalPausedBattle = true;
    renderBattleControls();
  }
  $("#modal-content").innerHTML =
    `${closable ? `<button class="modal-close icon-button" data-action="close" aria-label="关闭">${icon("close")}</button>` : ""}${content}`;
  if (!dialog.open) {
    lastFocus = document.activeElement as HTMLElement;
    if (portraitQuery.matches) portraitDialogPending = true;
    else dialog.showModal();
  }
  dialog.dataset.closable = String(closable);
}
function closeModal() {
  game.dismissLineupPrompt();
  const d = $<HTMLDialogElement>("#modal");
  d.close();
  portraitDialogPending = false;
  modalKind = "";
  if (modalPausedBattle) {
    scene.paused = portraitQuery.matches;
    portraitPaused = portraitQuery.matches;
    modalPausedBattle = false;
    renderBattleControls();
  }
  lastFocus?.focus();
}
function dismissModal() {
  if (game.state.phase === "ended") showResult();
  else if (game.state.phase === "carousel") showCarousel();
  else if (game.state.phase === "relic") showRelics();
  else if (game.state.phase === "event") showEvent();
  else closeModal();
}
function showHero(id: HeroId, backBuild?: string) {
  const h = hero(id);
  openModal(
    `<div class="hero-modal-art" style="--hero-color:${h.color}">${art(id)}</div><div class="hero-modal-copy"><span class="eyebrow">山 海 图 鉴 · ${h.title}</span><h2 id="modal-title">${h.name}</h2><p class="hero-tags">${h.origin} / ${h.role}<span>${h.cost} 灵石</span></p><div class="hero-stats"><div><small>生命</small><b>${h.hp}</b></div><div><small>攻击</small><b>${h.atk}</b></div><div><small>护甲</small><b>${h.armor}</b></div><div><small>射程</small><b>${h.range} 格</b></div></div><h3>${h.skill}</h3><p>${h.description}</p><p class="passive-copy">${PASSIVES[id]}</p><small class="muted">展示一星基础属性，实战叠加羁绊与法宝加成。</small><button class="outline-button" ${backBuild ? `data-build="${backBuild}"` : 'data-action="codex"'}>${backBuild ? "返回阵容详情" : "返回山海图鉴"} ${icon("arrow", 16)}</button></div>`,
    "hero",
  );
}
function showCodex() {
  openModal(
    `<span class="eyebrow">神 话 英 灵 · 贰 拾 肆 位</span><h2 id="modal-title">山海图鉴</h2><p class="modal-intro">一席神话，一子乾坤。点击英灵查看技能与羁绊。</p><div class="codex-grid">${HEROES.map((h) => `<button data-hero="${h.id}" style="--hero-color:${h.color}">${art(h.id)}<h3>${h.name}</h3><p>${h.origin} · ${h.role}</p><span>${h.cost} 灵石</span></button>`).join("")}</div>`,
    "codex",
  );
}
function showHelp() {
  openModal(
    `<span class="eyebrow">弈 者 手 札</span><h2 id="modal-title">落子之前</h2><p class="modal-intro">每局与七位本地 AI 同场竞技。气血归零即淘汰，最后的弈者登临天阙。</p><div class="help-grid"><section><b>壹</b><h3>寻仙 · 招募与升星</h3><p>花费灵石招募英灵，英灵先进入备战席。三位同名同星自动合成更高一星，最高三星。</p></section><section><b>贰</b><h3>布阵 · 前后有序</h3><p>点选英灵，再点下半场格子上阵。战将、守御放前排，术士、灵祝置后排。也可拖动棋子，或使用布阵面板。</p></section><section><b>叁</b><h3>共鸣 · 羁绊成阵</h3><p>上阵不同的同源或同职业英灵激活羁绊。重复上阵同名英灵不增加羁绊人数。点击羁绊可查效果。</p></section><section><b>肆</b><h3>修习 · 经营灵石</h3><p>试炼基础收入 2/3/4，其后每轮基础收入 5，对抗胜利 +1。每存 10 灵石多得 1 利息，最多 +5。连胜或连败每两轮多得 1，最多 +3。购买经验 4 灵石得 4 阅历，升级可增加上阵人数。</p></section><section><b>伍</b><h3>交战 · 诸神各显神通</h3><p>英灵自动寻敌，法力满 100 自动施法。35 秒进入天劫：攻速提高 40%，伤害逐步提升，治疗与护盾减半；45 秒后治疗与护盾仅保留 25%。60 秒双方仍有英灵存活则判平局，对抗双方均按敌方存活英灵承受伤害。</p></section><section><b>陆</b><h3>试炼 · 山海相赠</h3><p>2-1、3-2、4-2 选择天命强化。每阶段第 4 回合共选仙缘，第 7 回合击败野怪获取装备，低气血优先选秀。</p></section></div><div class="help-foot">进度自动保存在本机浏览器。战斗中关闭页面会回到本轮布阵；已结算奖励不会重复发放。手机可从浏览器菜单添加到主屏幕。</div><button class="primary-button" data-action="close">知晓了，入局 ${icon("arrow", 18)}</button>`,
    "help",
  );
}
function showFormation() {
  if (game.state.phase !== "prepare") {
    notify("战斗结束后才能布阵");
    return;
  }
  const u = selectedUnit();
  openModal(
    `<span class="eyebrow">排 兵 布 阵</span><h2 id="modal-title">${u && u.uid.startsWith("u") ? `为${hero(u.heroId).name}落子` : "选择一位英灵"}</h2><p class="modal-intro">前排接敌，后排护阵。点击英灵，再点棋格；已有棋子时会交换位置。</p><div class="formation-roster">${game.state.units.map((v) => `<button data-form-unit="${v.uid}" class="${v.uid === selected ? "selected" : ""}">${art(v.heroId)}<span>${hero(v.heroId).name} ${"★".repeat(v.star)}</span></button>`).join("")}</div><div class="formation-grid">${Array.from(
      { length: 28 },
      (_, i) => {
        const p = 28 + i,
          unit = game.state.units.find((v) => v.position === p);
        return `<button data-place="${p}" ${!u || !u.uid.startsWith("u") ? "disabled" : ""} aria-label="己方第 ${Math.floor(i / 7) + 1} 排第 ${(i % 7) + 1} 格${unit ? "，" + hero(unit.heroId).name : ""}">${unit ? art(unit.heroId) : "<span>+</span>"}</button>`;
      },
    ).join(
      "",
    )}</div><div class="formation-footer"><span>上阵 ${game.deployed.length} / ${game.state.level}</span><button class="outline-button danger" data-action="sell" ${!u || !u.uid.startsWith("u") ? "disabled" : ""}>出售</button><button class="outline-button" data-action="withdraw" ${!u || !u.uid.startsWith("u") ? "disabled" : ""}>移至备战席</button><button class="primary-button" data-action="close">完成布阵</button></div>`,
    "formation",
  );
}
function showResult() {
  const s = game.state,
    r = s.result;
  if (!r) return;
  const ended = s.phase === "ended",
    cleared = ended && s.rank === 1;
  if (ended) recordMatch();
  const title = ended
    ? cleared
      ? "一念封神"
      : `第 ${s.rank} 名 · 此局有得`
    : r.draw
      ? "此战未分胜负"
      : r.won
        ? "此战告捷"
        : "胜败，皆为修行";
  const entries = Object.entries(r.damageByUnit)
      .filter(([uid]) => s.units.some((u) => u.uid === uid))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
    max = entries[0]?.[1] || 1;
  openModal(
    `<div class="result-emblem ${r.won ? "victory" : ""}">${ended ? (cleared ? "神" : "弈") : r.won ? "胜" : "悟"}</div><span class="eyebrow">${ended ? "八 方 对 弈 · 终 局" : `第 ${s.round} 轮 · 对阵${r.opponentName}`}</span><h2 id="modal-title">${title}</h2><p class="modal-intro">${ended ? `历经 ${s.round} 轮，赢得 ${s.wins} 场胜局。${cleared ? (s.rivals.every((v) => v.hp === 0) ? "七位对手已悉数退场，诸神共贺。" : "终局论定，以气血与胜局登临榜首。") : s.hp <= 0 ? "气血已尽，山海长在，静候重逢。" : "最终回合已至，按气血与胜局完成排名。"}` : r.draw ? `战至天劫仍未分胜负，双方均失去气血。` : r.won && roundInfo(s.round).kind === "pve" ? `击败${r.opponentName}，获得 ${r.loot?.length ?? 0} 件装备。` : r.won ? `${r.opponentName}失去 ${r.opponentDamage} 气血。众神同心，再赴下一局。` : `本轮失去 ${r.damage} 气血。侦察对手，调整前后排与羁绊。`}</p><div class="result-stats"><div><small>本轮灵石</small><b>+${r.income}</b><span>含利息 +${r.interest}</span></div><div><small>剩余气血</small><b>${s.hp}</b><span>本轮 ${r.damage ? "-" + r.damage : "未受伤"}</span></div><div><small>交战用时</small><b>${Math.round(r.time)}<em>秒</em></b><span>阅历 +${s.relics.includes("study") ? 4 : 2}</span></div></div><div class="damage-summary"><h3>英灵战绩 <span>造成伤害</span></h3>${entries
      .map(([uid, damage]) => {
        const unit = s.units.find((u) => u.uid === uid);
        return `<div class="damage-row"><span>${unit ? hero(unit.heroId).name : "英灵"}</span><i><b style="width:${(damage / max) * 100}%"></b></i><strong>${Math.round(damage)}</strong></div>`;
      })
      .join(
        "",
      )}</div><details class="other-results"><summary>其他弈者的战况 · ${s.rivals.filter((v) => v.hp > 0).length} 位对手存活</summary>${r.reports.map((report) => `<p>${report}</p>`).join("")}</details><button class="primary-button" data-action="${ended ? "restart" : "continue"}">${ended ? "再弈一局" : "前往下一轮"} ${icon("arrow", 18)}</button>${ended ? '<button class="result-ranking" data-action="final-standings">查看最终排名与阵容</button>' : ""}`,
    "result",
    false,
  );
}
function showRelics() {
  openModal(
    `<span class="eyebrow">${roundInfo(game.state.round).label} · 天 命 强 化</span><h2 id="modal-title">选择你的天命</h2><p class="modal-intro">每份机缘，皆会改变此局。所选法宝将持续生效至试炼结束。</p><div class="relic-choices">${game.state.relicChoices
      .map((id, index) => {
        const r = RELICS.find((r) => r.id === id)!;
        return `<section class="augment-choice"><button data-choose-relic="${id}"><span class="relic-big-glyph">${r.glyph}</span><h3>${r.name}</h3><b>${r.short}</b><p>${r.description}</p><span class="relic-choose">选择强化 ${icon("arrow", 16)}</span></button><button class="augment-reroll" data-reroll-relic="${index}" ${game.state.relicRerolls[index] ? "disabled" : ""}>${icon("refresh", 14)} ${game.state.relicRerolls[index] ? "已刷新" : "刷新此项"}</button></section>`;
      })
      .join("")}</div>`,
    "relic",
    false,
  );
}
function showSettings() {
  const profile = readRecords();
  openModal(
    `<span class="eyebrow">此 间 山 海</span><h2 id="modal-title">设置</h2><div class="record-strip"><span>已完成 <b>${profile.length}</b> 局</span><span>夺冠 <b>${profile.filter((r) => r.rank === 1).length}</b> 次</span><span>最高 <b>${profile.length ? Math.min(...profile.map((r) => r.rank)) : "—"}</b> 名</span></div><div class="settings-rows"><div><span><b>琴音与战斗音效</b><small>原创五声音阶，伴你落子</small></span><button class="outline-button" data-action="sound">${sound.enabled ? "关闭" : "开启"}</button></div><div><span><b>战斗速度</b><small>不影响战斗判定</small></span><button class="outline-button" data-action="speed">${scene.speed}×</button></div><div><span><b>当前对局 · ${game.state.difficulty === "expert" ? "问道" : "初游"}</b><small>初游：AI 围绕自身流派经营。问道：AI 额外侦察你的阵容、针对后排与状态效果换阵。双方经济规则相同。</small></span></div><div><span><b>本地存档</b><small>${game.storageWarning ? "浏览器禁止存储，进度仅在当前页面保留" : "随每次操作自动保存，清除浏览器数据会丢失进度"}</small></span>${icon("check")}</div><div><span><b>开启新的对局</b><small>会替换本次对局的进度，可重新选择难度</small></span><button class="outline-button danger" data-action="confirm-restart">重新开始</button></div></div><button class="guide-link settings-help" data-action="help">${icon("book", 16)} 阅读弈者手札 ${icon("arrow", 14)}</button><p class="modal-intro">单机游戏，无需账号。首次完整加载后可离线游玩。手机浏览器可将游戏添加到主屏幕。</p>`,
    "settings",
  );
}

interface MatchRecord {
  id: string;
  rank: number;
  round: number;
  wins: number;
  date: string;
}
function readRecords(): MatchRecord[] {
  try {
    const raw = JSON.parse(storage?.getItem("shanhai-yi.records") ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (r: MatchRecord) =>
            typeof r?.id === "string" &&
            Number.isInteger(r.rank) &&
            r.rank >= 1 &&
            r.rank <= 8,
        )
      : [];
  } catch {
    return [];
  }
}
function recordMatch() {
  const s = game.state;
  if (s.phase !== "ended" || !s.rank) return;
  const records = readRecords();
  if (records.some((r) => r.id === s.matchId)) return;
  records.push({
    id: s.matchId,
    rank: s.rank,
    round: s.round,
    wins: s.wins,
    date: new Date().toISOString(),
  });
  try {
    storage?.setItem("shanhai-yi.records", JSON.stringify(records.slice(-100)));
  } catch {
    /* Match save warning is handled by Game. */
  }
}
function standingsRows(compact = false) {
  const s = game.state,
    all = [
      {
        id: "player",
        name: "云游弈者",
        glyph: "弈",
        hp: s.hp,
        level: s.level,
        wins: s.wins,
        eliminatedRound: s.hp <= 0 ? s.round : null,
      },
      ...s.rivals,
    ];
  all.sort(
    (a, b) =>
      b.hp - a.hp ||
      (b.eliminatedRound ?? MAX_ROUNDS) - (a.eliminatedRound ?? MAX_ROUNDS) ||
      b.wins - a.wins,
  );
  return all
    .map(
      (r, i) =>
        `<button class="standing-row ${r.id === "player" ? "is-player" : ""} ${r.id === s.opponentId ? "is-opponent" : ""} ${r.hp === 0 ? "eliminated" : ""}" ${r.id === "player" ? 'data-action="my-lineup"' : `data-scout="${r.id}"`}><small>${i + 1}</small><span class="standing-glyph">${r.glyph}</span><span class="standing-name">${r.name}${r.id === "player" ? "<i>你</i>" : ""}${!compact ? `<em>境界 ${r.level} · ${r.wins} 胜${r.hp === 0 ? " · 已淘汰" : ""}</em>` : ""}</span><b>${r.hp > 0 ? r.hp : "出局"}</b></button>`,
    )
    .join("");
}
function showStandings(final = false) {
  openModal(
    `<span class="eyebrow">单 机 八 方 对 弈</span><h2 id="modal-title">${final ? "此局山海榜" : "八方弈者"}</h2><p class="modal-intro">${final ? "本局排名。点击弈者可查看最终阵容。" : "点击对手侦察阵容、羁绊与经营状态。金色标记为此轮对手。"}</p><div class="standings-list">${standingsRows()}</div><button class="primary-button" data-action="${final ? "back-result" : "close"}">${final ? "返回结算" : "回到棋局"}</button>`,
    "standings",
    !final,
  );
}
function showScout(id: string) {
  const r = game.state.rivals.find((r) => r.id === id)!;
  const army = rivalArmy(r),
    build = BUILDS.find((b) => b.id === r.buildId)!;
  openModal(
    `<span class="eyebrow">知 己 知 彼 · 本 地 AI</span><h2 id="modal-title">${r.name}</h2><p class="modal-intro">${build.name} · ${r.style === "greedy" ? "稳健经营" : r.style === "aggressive" ? "积极进攻" : "均衡发展"} · ${r.lastAction}</p><div class="scout-stats"><span>气血 <b>${r.hp}</b></span><span>灵石 <b>${r.gold}</b></span><span>境界 <b>${r.level}</b></span><span>胜局 <b>${r.wins}</b></span></div><div class="scout-traits">${traits(
      r.units,
    )
      .filter((t) => t.tier)
      .map((t) => `<span>${t.count} ${t.name}</span>`)
      .join("")}</div><div class="scout-grid">${Array.from(
      { length: 28 },
      (_, i) => {
        const u = army.find((v) => v.position === i);
        return `<div>${u ? `<button data-hero="${u.heroId}" title="${hero(u.heroId).name}">${art(u.heroId)}<small>${"★".repeat(u.star)}</small></button>` : ""}</div>`;
      },
    ).join(
      "",
    )}</div><p class="scout-tip">上方为敌方后排，下方为与你接敌的前排。</p><div class="scout-relics">${
      r.relics
        .map((id) => {
          const relic = RELICS.find((v) => v.id === id)!;
          return `<span>${relic.glyph} · ${relic.name}</span>`;
        })
        .join("") || "<span>尚未取得法宝</span>"
    }</div><div class="confirm-actions"><button class="outline-button" data-action="standings">八方弈者</button><button class="primary-button" data-action="${game.state.phase === "ended" ? "back-result" : "close"}">${game.state.phase === "ended" ? "返回结算" : "回到棋局"}</button></div>`,
    "scout",
  );
}
function showBuilds() {
  const plan = game.state.lineupPlan,
    current = resolveLineup(plan);
  openModal(
    `<div class="lineup-picker"><header class="lineup-heading"><span class="eyebrow">落 子 有 方 · 寻 仙 有 引</span><h2 id="modal-title">预选阵容</h2><p>${current ? `当前：${current.name} · 已收集 ${collectedLineup(plan, game.state.units)}/${current.heroes.length}` : "先定一个方向，寻仙时为你标出心仪的英灵。"}</p></header><nav class="lineup-tabs" aria-label="阵容类型"><button class="active" data-action="builds" aria-current="page">八大流派</button><button data-action="custom-lineup">自选阵容</button><button class="lineup-guide" data-action="lineup-bonds">共鸣图谱 ↗</button></nav><div class="lineup-content"><div class="lineup-presets">${BUILDS.map(
      (b) => {
        const active = plan?.kind === "preset" && plan.buildId === b.id;
        return `<button class="lineup-preset ${active ? "active" : ""}" data-build="${b.id}" aria-label="查看${b.name}${active ? "，当前预选" : ""}"><span class="preset-title"><span class="preset-glyph">${b.glyph}</span><strong>${b.name}</strong>${active ? '<small class="preset-selected">已预选</small>' : ""}</span><p>${b.subtitle}</p><div class="preset-portraits">${b.heroes
          .slice(0, 3)
          .map((id) => `<span>${art(id)}<small>${hero(id).name}</small></span>`)
          .join(
            "",
          )}</div><span class="preset-traits">${b.traits.join(" · ")}</span></button>`;
      },
    ).join(
      "",
    )}</div></div><footer class="lineup-footer"><p>选阵时暂停计时 · 局中可随时更换</p><button class="outline-button" data-action="clear-lineup" ${game.state.phase === "ended" ? "disabled" : ""}>${current ? "取消预选 · 自由搭配" : "自由搭配，先入局"}</button></footer></div>`,
    "builds",
  );
}
function showBuild(id: string) {
  const b = BUILDS.find((b) => b.id === id)!;
  const active =
    game.state.lineupPlan?.kind === "preset" &&
    game.state.lineupPlan.buildId === id;
  openModal(
    `<div class="lineup-picker lineup-detail"><header class="lineup-heading"><span class="eyebrow">${b.subtitle}</span><h2 id="modal-title">${b.name}</h2><p>已收集 ${collectedLineup({ kind: "preset", buildId: id }, game.state.units)}/${b.heroes.length} · 包含棋盘与备战席</p></header><div class="lineup-content"><p class="modal-intro">${b.tip}</p><div class="build-heroes">${b.heroes.map((id, i) => `<button data-hero="${id}" data-back-build="${b.id}" style="--rarity:${COST_COLORS[hero(id).cost]}"><span class="lineup-role ${i < 3 ? "core" : ""}">${i < 3 ? "核心" : "补强"}</span>${art(id)}<h3>${hero(id).name}</h3><small>${hero(id).cost} 费${game.state.units.some((u) => u.heroId === id) ? " · 已收集" : " · 待寻仙"}</small></button>`).join("")}</div><div class="scout-traits">${b.traits.map((t) => `<button data-trait="${t}">${TRAITS[t].icon} ${t} · ${TRAITS[t].thresholds.join("/")}</button>`).join("")}</div><p class="lineup-explainer">预选后，商店会标出「核心推荐」与「补强推荐」。先用已获得的英灵过渡，逐步补齐阵容。</p></div><footer class="lineup-footer"><button class="outline-button" data-action="builds">返回流派</button><button class="lineup-text-button" data-custom-build="${id}">在此基础上自选</button><button class="primary-button" data-select-build="${id}" ${game.state.phase === "ended" ? "disabled" : ""}>${active ? "继续使用此阵容" : "预选此阵容"} ${icon("check", 16)}</button></footer></div>`,
    "build-detail",
  );
}
function showCustomLineup(base?: string) {
  lineupDraft = [
    ...(base
      ? BUILDS.find((b) => b.id === base)!.heroes
      : (resolveLineup(game.state.lineupPlan)?.heroes ?? [])),
  ];
  openModal(
    `<div class="lineup-picker"><header class="lineup-heading"><span class="eyebrow">万 般 搭 配 · 由 你 落 子</span><h2 id="modal-title">自选阵容</h2><p>从 24 位英灵中选择，最多 ${MAX_LEVEL} 位；入选英灵会获得「自选推荐」标识。</p></header><nav class="lineup-tabs" aria-label="阵容类型"><button data-action="builds">八大流派</button><button class="active" data-action="custom-lineup" aria-current="page">自选阵容</button><span id="lineup-draft-count" role="status" aria-live="polite"></span><button class="lineup-guide" data-action="clear-lineup-draft">清空选择</button></nav><div class="lineup-content"><div class="lineup-hero-grid">${[
      ...HEROES,
    ]
      .sort((a, b) => a.cost - b.cost)
      .map(
        (h) =>
          `<button class="custom-hero" data-plan-hero="${h.id}" aria-pressed="false" aria-label="${h.name}，${h.cost}费，${h.origin} ${h.role}" style="--rarity:${COST_COLORS[h.cost]}">${art(h.id)}<span class="custom-pick-mark" aria-hidden="true">✓</span><strong>${h.name}<i>${h.cost}</i></strong><small>${h.origin} · ${h.role}</small></button>`,
      )
      .join(
        "",
      )}</div></div><footer class="lineup-footer"><p>点击英灵选择 / 取消</p><button class="primary-button" id="apply-custom-lineup" data-action="apply-custom-lineup">启用自选阵容 ${icon("check", 16)}</button></footer></div>`,
    "custom-lineup",
  );
  renderLineupDraft();
}
function renderLineupDraft() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-plan-hero]")
    .forEach((button) => {
      const chosen = lineupDraft.includes(button.dataset.planHero as HeroId);
      button.classList.toggle("selected", chosen);
      button.setAttribute("aria-pressed", String(chosen));
    });
  $("#lineup-draft-count").textContent =
    `已选 ${lineupDraft.length}/${MAX_LEVEL}`;
  $<HTMLButtonElement>("#apply-custom-lineup").disabled =
    lineupDraft.length === 0 || game.state.phase === "ended";
}
function applyLineup(plan: LineupPlan | null) {
  if (!game.selectLineup(plan)) return;
  closeModal();
  notify(
    plan
      ? `已预选${resolveLineup(plan)!.name}，寻仙推荐已更新`
      : "已切换自由搭配，可随时预选阵容",
  );
}
function showEvent() {
  const e = EVENTS.find((e) => e.id === game.state.eventId)!;
  openModal(
    `<span class="eyebrow">山 海 奇 遇</span><h2 id="modal-title">${e.name}</h2><p class="modal-intro">${e.description}</p><div class="event-choices">${e.choices.map((c) => `<button data-event-choice="${c.id}" ${(c.id === "trade" && game.state.hp <= 10) || (c.id === "gift" && game.bench.length >= BENCH_SIZE) ? "disabled" : ""}><span>${c.glyph}</span><h3>${c.name}</h3><p>${c.description}</p>${icon("arrow", 20)}</button>`).join("")}</div>`,
    "event",
    false,
  );
}

function beginCombat() {
  if (!ready || game.state.phase !== "prepare") return;
  const b = new Battle(game.state);
  selected = null;
  if (game.start()) {
    scene.begin(b);
    sound.play("skill");
    renderBattleControls();
  }
}
async function enterFullscreen() {
  try {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen();
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    notify("请将手机横向放置；此浏览器暂不支持自动锁定方向");
  }
}
function showIncome() {
  const s = game.state;
  openModal(
    `<span class="eyebrow">运营 · 灵石收入</span><h2 id="modal-title">本轮收入明细</h2><div class="income-list"><p>基础收入 <b>+${baseIncome(s.round)}</b></p><p>当前利息 <b>+${Math.min(s.relics.includes("savings") ? 7 : 5, Math.floor(s.gold / 10))}</b></p><p>连胜 / 连败 <b>+${streakIncome(s.streak)}</b></p><p>强化收益 <b>+${s.relics.includes("coin") ? 2 : 0}</b></p><p>对抗胜利时额外 <b>+1</b></p></div><p class="modal-intro">每存 10 灵石获得 1 点利息。连局 2 / 4 / 6 场，分别增加 1 / 2 / 3 灵石；野怪与选秀不打断连局。</p>`,
    "income",
  );
}
function showOdds() {
  openModal(
    `<span class="eyebrow">等级 · 概率 · 共享卡池</span><h2 id="modal-title">寻仙规则</h2><table class="odds-table"><thead><tr><th>等级</th>${[1, 2, 3, 4, 5].map((c) => `<th style="color:${COST_COLORS[c]}">${c} 费</th>`).join("")}</tr></thead><tbody>${Array.from({ length: 10 }, (_, i) => `<tr class="${game.state.level === i + 1 ? "current" : ""}"><th>${i + 1}</th>${SHOP_ODDS[i + 1].map((n) => `<td>${n}%</td>`).join("")}</tr>`).join("")}</tbody></table><p class="modal-intro">所有弈者共用有限卡池。商店展示与已持有英雄占用库存；刷新、出售、淘汰后释放。某费用耗尽时按剩余可用费用重新分配概率。</p><div class="pool-grid">${HEROES.map((h) => `<span>${h.name}<b>${availableCopies(game.state, h.id)}</b></span>`).join("")}</div>`,
    "odds",
  );
}
function showEquipment(index?: number) {
  selectedItem = index ?? null;
  const id = index === undefined ? null : game.state.inventory[index];
  openModal(
    `<span class="eyebrow">八类散件 · 三十六种成装</span><h2 id="modal-title">${id ? item(id).name : "装备库"}</h2><p class="modal-intro">${id ? item(id).description : "装备可拖到英灵身上。两件散件自动合成；每位英灵最多携带三件，出售时返还装备。"}</p><div class="equipment-inventory">${game.state.inventory.map((id, i) => `<button data-item="${i}" class="${index === i ? "selected" : ""}">${eqIcon(id)}<span>${item(id).name}</span></button>`).join("") || "<p>击败野怪或参与选秀获得装备。</p>"}</div>${
      id
        ? `<h3 class="modal-section-title">穿戴给英灵</h3><div class="equipment-roster">${game.state.units.map((u) => `<button data-equip-uid="${u.uid}">${art(u.heroId)}<strong>${hero(u.heroId).name} ${"★".repeat(u.star)}</strong><small>${u.position === null ? "备战席" : "已上阵"} · ${(u.items ?? []).length}/3</small><span>${(u.items ?? []).map(eqIcon).join("")}</span></button>`).join("")}</div>${
            !item(id).parts
              ? `<h3 class="modal-section-title">与库存散件合成</h3><div class="recipe-grid">${
                  game.state.inventory
                    .map((other, i) => {
                      const result = combine(id, other);
                      return i !== index && result
                        ? `<button data-combine="${i}">${eqIcon(other)}<span>＋ →</span>${eqIcon(result)}<b>${item(result).name}</b></button>`
                        : "";
                    })
                    .join("") ||
                  '<p class="muted">暂时没有可合成的另一件散件</p>'
                }</div>`
              : ""
          }`
        : ""
    }<h3 class="modal-section-title">装备图鉴 · 点选查看</h3><div class="equipment-codex">${EQUIPMENT.map((e) => `<button data-gear="${e.id}">${eqIcon(e.id)}<span>${e.name}</span></button>`).join("")}</div>`,
    "equipment",
  );
}
function showEquipmentDetail(id: string) {
  const e = item(id);
  openModal(
    `<span class="eyebrow">${e.parts ? "成装" : "基础装备"}</span><h2 id="modal-title">${eqIcon(id)} ${e.name}</h2><p class="modal-intro">${e.description}</p>${
      e.parts
        ? `<div class="recipe-hero">${e.parts.map((p) => `${eqIcon(p)} ${item(p).name}`).join(" ＋ ")} → ${eqIcon(id)}</div>`
        : `<div class="recipe-grid">${COMPONENTS.map((part) => {
            const out = combine(id, part.id)!;
            return `<button data-gear="${out}">${eqIcon(part.id)}<span>→</span>${eqIcon(out)}<b>${item(out).name}</b></button>`;
          }).join("")}</div>`
    }<button class="outline-button" data-action="equipment">返回装备库</button>`,
    "equipment-detail",
  );
}
function showCarousel() {
  const c = game.state.carousel!;
  openModal(
    `<span class="eyebrow">${roundInfo(game.state.round).label} · 共 选 仙 缘</span><h2 id="modal-title">此刻，轮到你选择</h2><p class="modal-intro">低气血弈者优先，选择一位携带装备的英灵加入阵容。${game.bench.length >= BENCH_SIZE ? "备战席已满：没有空位时英雄兑为灵石，装备保留。" : "英灵与装备将一起加入备战席。"}</p><div class="draft-order">${c.order.map((id, i) => `<span class="${id === "player" ? "you" : i < c.turn ? "picked" : ""}">${i + 1}. ${id === "player" ? "你" : game.state.rivals.find((r) => r.id === id)!.name}</span>`).join("")}</div><div class="carousel-grid">${c.offers.map((o) => `<button data-carousel="${o.id}" ${o.claimedBy ? "disabled" : ""} style="--rarity:${COST_COLORS[hero(o.heroId).cost]}">${art(o.heroId)}<h3>${hero(o.heroId).name}<small>${hero(o.heroId).cost} 费</small></h3><span>${eqIcon(o.itemId)} ${item(o.itemId).name}</span><small>${o.claimedBy ? (game.state.rivals.find((r) => r.id === o.claimedBy)?.name ?? "已选择") : "选择此英灵"}</small></button>`).join("")}</div>`,
    "carousel",
    false,
  );
}

root.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    "button,[data-action]",
  );
  if (!target || target.hasAttribute("disabled")) return;
  if (target.dataset.item !== undefined) {
    showEquipment(Number(target.dataset.item));
    return;
  }
  if (target.dataset.gear) {
    showEquipmentDetail(target.dataset.gear);
    return;
  }
  if (target.dataset.equipUid && selectedItem !== null) {
    notify(game.equipItem(selectedItem, target.dataset.equipUid));
    selectedItem = null;
    showEquipment();
    return;
  }
  if (target.dataset.combine !== undefined && selectedItem !== null) {
    notify(game.combineItems(selectedItem, Number(target.dataset.combine)));
    selectedItem = null;
    showEquipment();
    return;
  }
  if (target.dataset.carousel) {
    closeModal();
    game.chooseCarousel(target.dataset.carousel);
    return;
  }
  if (target.dataset.rerollRelic !== undefined) {
    game.rerollRelic(Number(target.dataset.rerollRelic));
    showRelics();
    return;
  }
  if (target.dataset.buy !== undefined) {
    notify(game.buy(Number(target.dataset.buy)));
    sound.play("buy");
    return;
  }
  if (target.dataset.unit) {
    select(target.dataset.unit);
    return;
  }
  if (target.dataset.selectBuild) {
    applyLineup({ kind: "preset", buildId: target.dataset.selectBuild });
    return;
  }
  if (target.dataset.customBuild) {
    showCustomLineup(target.dataset.customBuild);
    return;
  }
  if (target.dataset.planHero) {
    const id = target.dataset.planHero as HeroId;
    if (lineupDraft.includes(id))
      lineupDraft = lineupDraft.filter((h) => h !== id);
    else if (lineupDraft.length >= MAX_LEVEL) {
      $("#lineup-draft-count").textContent = `已满 ${MAX_LEVEL} 位，先取消一位`;
      return;
    } else lineupDraft.push(id);
    renderLineupDraft();
    return;
  }
  if (target.dataset.hero) {
    showHero(target.dataset.hero as HeroId, target.dataset.backBuild);
    return;
  }
  if (target.dataset.build) {
    showBuild(target.dataset.build);
    return;
  }
  if (target.dataset.scout) {
    showScout(target.dataset.scout);
    return;
  }
  if (target.dataset.bond) {
    const b = BONDS.find((b) => b.id === target.dataset.bond)!;
    openModal(
      `<span class="eyebrow">神 话 共 鸣</span><h2 id="modal-title">${b.name}</h2><p class="modal-intro">${b.description}</p><div class="trait-heroes">${b.heroes.map((id) => `<button data-hero="${id}">${art(id)}<span>${hero(id).name}</span></button>`).join("")}</div><p class="muted">两位英灵同时上阵即可激活，不占法宝位置。</p>`,
      "bond",
    );
    return;
  }
  if (target.dataset.eventChoice) {
    const message = game.chooseEvent(target.dataset.eventChoice);
    if (message) notify(message);
    else {
      closeModal();
      sound.play("win");
    }
    return;
  }
  if (target.dataset.trait) {
    const name = target.dataset.trait,
      t = TRAITS[name];
    openModal(
      `<span class="trait-modal-glyph">${t.icon}</span><span class="eyebrow">羁 绊 共 鸣</span><h2 id="modal-title">${name}</h2><p class="modal-intro">${t.description}</p><div class="trait-heroes">${HEROES.filter(
        (h) => h.origin === name || h.role === name,
      )
        .map(
          (h) =>
            `<button data-hero="${h.id}">${art(h.id)}<span>${h.name}</span></button>`,
        )
        .join(
          "",
        )}</div><p class="muted">上阵 ${t.thresholds.join(" / ")} 位不同英灵激活。相同英灵只计一次。</p>`,
      "trait",
    );
    return;
  }
  if (target.dataset.relic) {
    const r = RELICS.find((r) => r.id === target.dataset.relic)!;
    openModal(
      `<span class="relic-big-glyph">${r.glyph}</span><span class="eyebrow">随 身 法 宝</span><h2 id="modal-title">${r.name}</h2><p class="modal-intro">${r.description}</p>`,
      "relic-detail",
    );
    return;
  }
  if (target.dataset.chooseRelic) {
    closeModal();
    game.chooseRelic(target.dataset.chooseRelic);
    sound.play("win");
    return;
  }
  if (target.dataset.formUnit) {
    selected = target.dataset.formUnit;
    renderSelection();
    showFormation();
    return;
  }
  if (target.dataset.place) {
    if (selected) {
      move(selected, Number(target.dataset.place));
      showFormation();
    }
    return;
  }
  switch (target.dataset.action) {
    case "equipment":
      showEquipment();
      break;
    case "odds":
      showOdds();
      break;
    case "income":
      showIncome();
      break;
    case "result":
      showResult();
      break;
    case "fullscreen":
      void enterFullscreen();
      break;
    case "autoplay":
      game.setAuto(!game.state.autoAdvance);
      if (scene.battle) scene.paused = !game.state.autoAdvance;
      break;
    case "codex":
      showCodex();
      break;
    case "builds":
      showBuilds();
      break;
    case "custom-lineup":
      if (modalKind !== "custom-lineup") showCustomLineup();
      break;
    case "clear-lineup-draft":
      lineupDraft = [];
      renderLineupDraft();
      break;
    case "apply-custom-lineup":
      if (lineupDraft.length)
        applyLineup({ kind: "custom", heroes: lineupDraft });
      break;
    case "clear-lineup":
      applyLineup(null);
      break;
    case "lineup-bonds":
      openModal(
        `<span class="eyebrow">并 肩 成 阵 · 神 话 共 鸣</span><h2 id="modal-title">共鸣图谱</h2><div class="all-bonds">${BONDS.map((b) => `<button data-bond="${b.id}"><span>${b.name}</span><small>${b.heroes.map((id) => hero(id).name).join(" × ")}</small>${icon("arrow", 14)}</button>`).join("")}</div><button class="outline-button" data-action="builds">返回预选阵容</button>`,
        "lineup-bonds",
      );
      break;
    case "standings":
      showStandings(game.state.phase === "ended");
      break;
    case "final-standings":
      showStandings(true);
      break;
    case "back-result":
      showResult();
      break;
    case "my-lineup":
      if (game.state.phase === "prepare") showFormation();
      else if (game.state.phase === "ended") showResult();
      else notify("你的阵容已显示在己方棋盘");
      break;
    case "help":
      showHelp();
      break;
    case "settings":
      showSettings();
      break;
    case "close":
      dismissModal();
      break;
    case "sound": {
      sound.toggle();
      $("#sound-button").innerHTML = icon(sound.enabled ? "sound" : "mute");
      $("#sound-button").setAttribute(
        "aria-label",
        sound.enabled ? "关闭音乐" : "开启音乐",
      );
      $("#sound-button").title = sound.enabled ? "关闭音乐" : "开启音乐";
      if (modalKind === "settings") showSettings();
      break;
    }
    case "xp":
      notify(game.buyXP());
      sound.play("buy");
      break;
    case "refresh":
      notify(game.roll());
      sound.play("buy");
      break;
    case "lock":
      game.toggleLock();
      break;
    case "deselect":
      selected = null;
      renderSelection();
      break;
    case "sell":
      if (selected) sellUnit(selected);
      break;
    case "bench":
      if (selected) move(selected, null);
      else notify("先在寻仙中招募英灵，再点击英灵上阵");
      break;
    case "formation":
      showFormation();
      break;
    case "withdraw":
      if (selected) {
        move(selected, null);
        showFormation();
      }
      break;
    case "battle":
      beginCombat();
      break;
    case "pause":
      scene.paused = !scene.paused;
      renderBattleControls();
      break;
    case "speed":
      scene.speed = scene.speed === 1 ? 2 : scene.speed === 2 ? 3 : 1;
      renderBattleControls();
      if (modalKind === "settings") showSettings();
      break;
    case "continue":
      closeModal();
      scene.end();
      game.continue();
      break;
    case "confirm-restart":
      openModal(
        `<span class="eyebrow">重 入 山 海</span><h2 id="modal-title">开启新的对局？</h2><p class="modal-intro">当前第 ${game.state.round} 轮的阵容、灵石和法宝将被替换。每局独立经营，对阵七位本地 AI。</p><div class="difficulty-choices"><button data-action="restart-normal"><h3>初游</h3><p>AI 以自己的流派为核心，合理经营与升星。适合熟悉山海棋局。</p></button><button data-action="restart-expert"><h3>问道</h3><p>AI 侦察你的阵容，主动反制后排、治疗和灼烧，考验临场变阵。</p></button></div><button class="outline-button" data-action="close">继续此局</button>`,
        "confirm",
      );
      break;
    case "restart-normal":
    case "restart-expert":
      closeModal();
      scene.battle = null;
      selected = null;
      game.restart(
        target.dataset.action === "restart-expert" ? "expert" : "normal",
      );
      sound.play("skill");
      break;
    case "restart":
      closeModal();
      scene.battle = null;
      selected = null;
      game.restart();
      sound.play("skill");
      break;
  }
});
const modal = $<HTMLDialogElement>("#modal");
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (modal.dataset.closable !== "false") dismissModal();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal && modal.dataset.closable === "true") {
    const rect = modal.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      dismissModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.open) {
    cancelUnitDrag();
    selected = null;
    renderSelection();
  }
  if (e.key === " " && !modal.open && game.state.phase === "battle") {
    e.preventDefault();
    scene.paused = !scene.paused;
    renderBattleControls();
  }
});
// DOM and Pixi drags share one preview and drop target, priced by the game rules.
let benchDrag: {
  uid: string;
  pointerId: number;
  startX: number;
  startY: number;
  moving: boolean;
} | null = null;
let dragFeedback: { uid: string; ghost: HTMLElement } | null = null;
let suppressDragClick = false;
const shopArea = $(".shop-wrap");
const sellZone = $("#sell-zone");
function containsPoint(element: HTMLElement, x: number, y: number) {
  const r = element.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function sellUnit(uid: string) {
  notify(game.sell(uid));
  selected = null;
  update();
  if (modalKind === "formation") showFormation();
}
function previewUnitDrag(uid: string, x: number, y: number) {
  const u = game.state.units.find((v) => v.uid === uid);
  if (
    !u ||
    !canShop() ||
    (game.state.phase === "battle" && u.position !== null) ||
    modal.open
  ) {
    cancelUnitDrag();
    return;
  }
  if (dragFeedback?.uid !== uid) {
    clearDragFeedback();
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.innerHTML = art(u.heroId);
    document.body.appendChild(ghost);
    dragFeedback = { uid, ghost };
    sellZone.innerHTML = `<span class="sell-zone-symbol">${icon("coin", 34)}</span><div class="sell-zone-copy"><strong id="sell-zone-label">拖到此处出售</strong><p>${hero(u.heroId).name} <span>${"★".repeat(u.star)}</span></p></div><div class="sell-zone-price"><b>+${sellPrice(u)}</b><span>灵石</span></div><small>移出此区域取消出售</small>`;
    sellZone.setAttribute("aria-hidden", "false");
    shopArea.classList.add("sell-ready");
    document.body.classList.add("unit-dragging");
  }
  dragFeedback!.ghost.style.left = `${x}px`;
  dragFeedback!.ghost.style.top = `${y}px`;
  const over = containsPoint(shopArea, x, y);
  shopArea.classList.toggle("sell-hover", over);
  $("#sell-zone-label").textContent = over ? "松手出售" : "拖到此处出售";
}
function clearDragFeedback() {
  dragFeedback?.ghost.remove();
  dragFeedback = null;
  shopArea.classList.remove("sell-ready", "sell-hover");
  sellZone.setAttribute("aria-hidden", "true");
  document.body.classList.remove("unit-dragging");
}
function cancelUnitDrag() {
  cancelGearDrag();
  if (benchDrag?.moving || dragFeedback) suppressDragClick = true;
  benchDrag = null;
  scene.cancelDrag();
  clearDragFeedback();
}
function dropUnit(uid: string, x: number, y: number) {
  // A drag's synthetic click must not recruit a card underneath the drop.
  suppressDragClick = true;
  const canDrop =
    canShop() && !modal.open && game.state.units.some((u) => u.uid === uid);
  const selling = canDrop && containsPoint(shopArea, x, y);
  const withdrawing =
    canDrop &&
    game.state.phase === "prepare" &&
    containsPoint($("#bench"), x, y);
  clearDragFeedback();
  if (selling) sellUnit(uid);
  else if (withdrawing) move(uid, null);
  return selling || withdrawing || !canDrop;
}
window.addEventListener(
  "pointerdown",
  () => {
    suppressDragClick = false;
  },
  true,
);
root.addEventListener(
  "click",
  (e) => {
    if (suppressDragClick && e.detail > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressDragClick = false;
    }
  },
  true,
);
$("#bench").addEventListener("pointerdown", (e) => {
  const event = e as PointerEvent;
  const button = (event.target as Element).closest<HTMLElement>("[data-unit]");
  if (
    !button ||
    !canShop() ||
    !event.isPrimary ||
    event.button !== 0 ||
    benchDrag
  )
    return;
  benchDrag = {
    uid: button.dataset.unit!,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moving: false,
  };
  button.setPointerCapture(event.pointerId);
});
window.addEventListener("pointermove", (e) => {
  if (!benchDrag || e.pointerId !== benchDrag.pointerId) return;
  if (
    Math.hypot(e.clientX - benchDrag.startX, e.clientY - benchDrag.startY) > 8
  )
    benchDrag.moving = true;
  if (benchDrag.moving) previewUnitDrag(benchDrag.uid, e.clientX, e.clientY);
});
window.addEventListener("pointerup", (e) => {
  if (!benchDrag || e.pointerId !== benchDrag.pointerId) return;
  const d = benchDrag;
  benchDrag = null;
  if (d.moving && !dropUnit(d.uid, e.clientX, e.clientY)) {
    const p = scene.clientCell(e.clientX, e.clientY);
    if (p !== null && game.state.phase === "prepare") move(d.uid, p);
  }
});
window.addEventListener("pointercancel", cancelUnitDrag);
window.addEventListener("lostpointercapture", (e) => {
  if (benchDrag?.pointerId === e.pointerId) cancelUnitDrag();
});
window.addEventListener("blur", cancelUnitDrag);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelUnitDrag();
});
scene.onDragMove = previewUnitDrag;
scene.onDrop = dropUnit;
scene.onDragCancel = clearDragFeedback;
let gearDrag: {
  index: number;
  pointerId: number;
  x: number;
  y: number;
  ghost: HTMLElement | null;
} | null = null;
function cancelGearDrag() {
  gearDrag?.ghost?.remove();
  gearDrag = null;
  scene.select(selected);
  document
    .querySelectorAll(".equip-hover")
    .forEach((e) => e.classList.remove("equip-hover"));
}
function equipmentTarget(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  return (
    element?.closest<HTMLElement>("[data-unit]")?.dataset.unit ??
    scene.clientUnit(x, y)
  );
}
$("#inventory").addEventListener("pointerdown", (e) => {
  const button = (e.target as Element).closest<HTMLElement>("[data-item]");
  if (!button || !e.isPrimary || !canShop()) return;
  gearDrag = {
    index: Number(button.dataset.item),
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    ghost: null,
  };
  button.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
  if (!gearDrag || e.pointerId !== gearDrag.pointerId) return;
  const d = gearDrag,
    id = game.state.inventory[d.index];
  if (!id) {
    cancelGearDrag();
    return;
  }
  if (!d.ghost && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
    d.ghost = document.createElement("div");
    d.ghost.className = "gear-ghost";
    d.ghost.innerHTML = eqIcon(id) + "<small>拖到英灵穿戴</small>";
    document.body.appendChild(d.ghost);
  }
  if (d.ghost) {
    d.ghost.style.left = e.clientX + "px";
    d.ghost.style.top = e.clientY + "px";
    const uid = equipmentTarget(e.clientX, e.clientY);
    scene.select(uid ?? selected);
    d.ghost.querySelector("small")!.textContent = uid
      ? "松手穿戴"
      : "拖到英灵穿戴";
    document
      .querySelectorAll<HTMLElement>("[data-unit]")
      .forEach((el) =>
        el.classList.toggle("equip-hover", el.dataset.unit === uid),
      );
  }
});
window.addEventListener("pointerup", (e) => {
  if (!gearDrag || e.pointerId !== gearDrag.pointerId) return;
  const d = gearDrag,
    uid = equipmentTarget(e.clientX, e.clientY);
  const target = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest<HTMLElement>("[data-item]");
  if (d.ghost) {
    suppressDragClick = true;
    cancelGearDrag();
    if (uid) notify(game.equipItem(d.index, uid));
    else if (target)
      notify(game.combineItems(d.index, Number(target.dataset.item)));
  } else cancelGearDrag();
});
window.addEventListener("pointercancel", cancelGearDrag);
window.addEventListener("blur", cancelGearDrag);
scene.onSelect = (uid) => {
  if (!uid.startsWith("u")) {
    const u = opponentUnits(game.state).find((u) => u.uid === uid);
    if (u) showHero(u.heroId);
  } else select(uid);
};
scene.onCell = (p) => {
  if (game.state.phase !== "prepare") return;
  if (selected && selected.startsWith("u")) move(selected, p);
  else if (p >= 28) notify("先点选备战席或棋盘上的英灵");
};
scene.onMove = move;
scene.onTick = (b) => {
  $("#phase-timer").textContent = String(Math.max(0, 60 - Math.floor(b.time)));
  renderDamage();
  const t = $("#combat-time");
  if (t) {
    t.textContent = `${b.time >= 35 ? "天劫 · " : ""}${Math.floor(b.time)} / 60 秒`;
    t.classList.toggle("overtime", b.time >= 35);
  }
};
scene.onFinish = (b) => {
  game.settle(
    b.winner === 0,
    b.alive(1).filter((f) => !f.summonOf).length,
    b.time,
    Object.fromEntries(
      b.fighters
        .filter((f) => f.team === 0 && !f.summonOf)
        .map((f) => [f.uid, f.damage]),
    ),
    b.alive(0).filter((f) => !f.summonOf).length,
    b.draw,
  );
  if (b.winner === 0) sound.play("win");
};
scene.onSound = (t) => sound.play(t);
game.onChange = update;
update();
async function boot() {
  try {
    await scene.init($("#canvas-host"));
    ready = true;
    $("#loading")?.remove();
    update();
  } catch (error) {
    console.error("战场初始化失败", error);
    $("#loading").innerHTML =
      '<p>战场加载未完成，请检查浏览器是否支持 WebGL。</p><button class="primary-button" id="retry">重新加载</button>';
    $("#retry").addEventListener("click", () => location.reload());
  }
}
void boot();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(async () => {
        await navigator.serviceWorker.ready;
        if (!game.storageWarning)
          $("#save-status").textContent = "已就绪 · 可离线游玩";
      })
      .catch(() => {
        notify("离线缓存未启用，当前仍可正常游玩");
      });
  });
}

window.setInterval(() => {
  const s = game.state;
  if (
    !ready ||
    document.hidden ||
    modal.open ||
    benchDrag?.moving ||
    gearDrag?.ghost ||
    dragFeedback ||
    !s.autoAdvance ||
    matchMedia("(orientation: portrait) and (max-width: 1000px)").matches
  )
    return;
  if (s.phase === "prepare") {
    s.preparation = Math.max(0, s.preparation - 1);
    $("#phase-timer").textContent = String(s.preparation);
    game.save();
    if (s.preparation === 0) beginCombat();
  } else if (s.phase === "result") {
    resultCountdown--;
    $("#phase-timer").textContent = String(Math.max(0, resultCountdown));
    if (resultCountdown <= 0) {
      scene.end();
      game.continue();
    }
  }
}, 1000);
portraitQuery.addEventListener("change", () => {
  cancelUnitDrag();
  if (portraitQuery.matches) {
    if (modal.open) {
      portraitDialogPending = true;
      modal.close();
    }
    if (scene.battle && !scene.paused) {
      scene.paused = true;
      portraitPaused = true;
    }
  } else {
    if (portraitDialogPending) {
      portraitDialogPending = false;
      modal.showModal();
    }
    if (portraitPaused) {
      if (!modal.open) scene.paused = false;
      portraitPaused = false;
    }
  }
  renderBattleControls();
});
