/** Fixed chrome and explicit pages keep every dialog usable on a landscape phone. */
const element = (tag: string, cls: string) => {
  const node = document.createElement(tag);
  node.className = cls;
  return node;
};
function paginate(grid: HTMLElement, size: number, shortSize = size) {
  const pages = element("div", "dialog-pages");
  pages.dataset.pageSize = String(size);
  pages.dataset.shortSize = String(shortSize);
  grid.replaceWith(pages);
  pages.append(grid);
  repaginate(pages);
}
function repaginate(group: HTMLElement) {
  const size = Number(
    window.innerHeight <= 350
      ? group.dataset.shortSize
      : group.dataset.pageSize,
  );
  const oldPages = [...group.children] as HTMLElement[];
  const children = oldPages.flatMap((p) => [...p.children]);
  const current = oldPages.find((p) => !p.hidden)?.firstElementChild;
  const index = Math.max(0, children.indexOf(current!));
  const template = oldPages[0];
  if (!template) return;
  const pages: HTMLElement[] = [];
  for (let i = 0; i < Math.max(children.length, 1); i += size) {
    const page = template.cloneNode(false) as HTMLElement;
    page.classList.add("dialog-page");
    page.hidden = Math.floor(i / size) !== Math.floor(index / size);
    children.slice(i, i + size).forEach((child) => page.append(child));
    pages.push(page);
  }
  group.replaceChildren(...pages);
}
function panel(title: string) {
  const node = element("section", "dialog-panel");
  node.dataset.panelTitle = title;
  return node;
}
function refreshPagination() {
  const content = document.querySelector<HTMLElement>("#modal-content")!;
  const groups = [...content.querySelectorAll<HTMLElement>(".dialog-pages")];
  const group = groups.find((g) => !g.closest(".dialog-panel[hidden]"));
  const pagination = content.querySelector<HTMLElement>(".dialog-pagination")!;
  pagination.hidden = !group || group.children.length < 2;
  if (!group) return;
  const pages = [...group.children] as HTMLElement[];
  const index = pages.findIndex((p) => !p.hidden);
  pagination.innerHTML = `<button data-dialog-step="-1" aria-label="上一页" ${index === 0 ? "disabled" : ""}>‹</button><span role="status" aria-live="polite">${index + 1} / ${pages.length}</span><button data-dialog-step="1" aria-label="下一页" ${index === pages.length - 1 ? "disabled" : ""}>›</button>`;
}
export function handleDialogNavigation(target: HTMLElement) {
  if (target.dataset.dialogStep) {
    const group = [
      ...document.querySelectorAll<HTMLElement>("#modal .dialog-pages"),
    ].find((g) => !g.closest(".dialog-panel[hidden]"));
    if (group) {
      const pages = [...group.children] as HTMLElement[];
      const next =
        pages.findIndex((p) => !p.hidden) + Number(target.dataset.dialogStep);
      if (next >= 0 && next < pages.length)
        pages.forEach((p, i) => (p.hidden = i !== next));
      refreshPagination();
    }
    return true;
  }
  if (target.dataset.dialogTab !== undefined) {
    document
      .querySelectorAll<HTMLElement>("#modal .dialog-panel")
      .forEach((p, i) => (p.hidden = i !== Number(target.dataset.dialogTab)));
    document
      .querySelectorAll<HTMLElement>("#modal [data-dialog-tab]")
      .forEach((b) => {
        const selected = b === target;
        b.classList.toggle("active", selected);
        b.setAttribute("aria-selected", String(selected));
      });
    refreshPagination();
    return true;
  }
  return false;
}
export function mountDialog(content: string, kind: string, closeIcon: string) {
  const host = document.querySelector<HTMLElement>("#modal-content")!;
  host.dataset.kind = kind;
  const source = element("div", "");
  source.innerHTML = content;
  const title = source.querySelector("#modal-title")!;
  const header = element("header", "dialog-header");
  header.append(title);
  header.insertAdjacentHTML(
    "beforeend",
    `<button class="modal-close icon-button" data-action="close" aria-label="关闭">${closeIcon}</button>`,
  );
  const toolbar = element("nav", "dialog-toolbar");
  const body = element("div", "dialog-body");
  const footer = element("footer", "dialog-footer");
  const pager = element("div", "dialog-pagination");
  pager.hidden = true;
  const actions = element("div", "dialog-actions");
  footer.append(pager, actions);
  source
    .querySelectorAll(".eyebrow, .result-emblem, .trait-modal-glyph")
    .forEach((n) => n.remove());
  const lineup = source.querySelector(".lineup-picker");
  if (lineup) {
    const tabs = lineup.querySelector(".lineup-tabs");
    if (tabs) toolbar.append(tabs);
    const intro = lineup.querySelector(".lineup-heading p");
    if (intro) {
      intro.classList.add("dialog-caption");
      if (kind === "build-detail")
        header.insertBefore(intro, header.lastElementChild);
      else toolbar.append(intro);
    }
    const inner = lineup.querySelector(".lineup-content")!;
    body.append(...inner.childNodes);
    const controls = lineup.querySelector(".lineup-footer");
    if (controls) actions.append(...controls.childNodes);
  } else {
    source
      .querySelectorAll(
        ":scope > button, :scope > .confirm-actions, :scope > .formation-footer, .hero-modal-copy > button",
      )
      .forEach((n) => actions.append(n));
    body.append(...source.childNodes);
  }
  if (kind === "build-detail") {
    const sections = element("div", "build-sections");
    const members = element("section", "build-members");
    const strategy = element("section", "build-strategy");
    members.append(
      body.querySelector(".build-heroes")!,
      body.querySelector(".scout-traits")!,
    );
    strategy.append(
      body.querySelector(".modal-intro")!,
      body.querySelector(".lineup-explainer")!,
    );
    sections.append(members, strategy);
    body.append(sections);
  }
  if (kind === "help") {
    const note = body.querySelector(".help-foot");
    if (note) {
      note.classList.add("help-save-note");
      body.querySelector(".help-grid section:last-child")?.append(note);
    }
  }
  if (kind === "result") {
    const overview = panel("本轮战绩"),
      others = panel("其他战况"),
      damage = panel("伤害统计");
    const reports = body.querySelector(".other-results")!;
    reports.querySelector("summary")?.remove();
    others.append(...reports.childNodes);
    reports.remove();
    damage.append(body.querySelector(".damage-summary")!);
    overview.append(...body.childNodes);
    body.append(overview, damage, others);
  }
  if (kind === "odds") {
    const odds = panel("招募概率"),
      pool = panel("卡池余量");
    const grid = body.querySelector(".pool-grid")!;
    const intro = body.querySelector(".modal-intro")!;
    pool.append(intro, grid);
    odds.append(...body.childNodes);
    body.append(odds, pool);
  }
  if (kind === "formation") {
    const split = element("div", "formation-layout");
    split.append(
      body.querySelector(".formation-roster")!,
      body.querySelector(".formation-grid")!,
    );
    body.append(split);
  }
  if (kind === "scout") {
    const split = element("div", "scout-layout"),
      facts = element("div", "scout-facts");
    [".scout-stats", ".scout-traits", ".scout-relics", ".scout-tip"].forEach(
      (s) => {
        const n = body.querySelector(s);
        if (n) facts.append(n);
      },
    );
    split.append(body.querySelector(".scout-grid")!, facts);
    body.append(split);
  }
  const groups: [string, number, number?][] = [
    [".codex-grid", 12, 6],
    [".all-bonds", 8, 4],
    [".standings-list", 8, 4],
    [".build-sections", 2, 1],
    [".lineup-presets", 8, 4],
    [".traits-overview", 8, 4],
    [".lineup-hero-grid", 12, 6],
    [".help-grid", 2, 1],
    [".settings-rows", 3, 2],
    [".equipment-codex", 12, 6],
    [".equipment-inventory", 12, 6],
    [".equipment-roster", 6, 3],
    [".formation-roster", 6],
    [".recipe-grid", 8, 4],
  ];
  for (const [selector, size, shortSize] of groups)
    body
      .querySelectorAll<HTMLElement>(selector)
      .forEach((g) => paginate(g, size, shortSize));
  const panels = [...body.querySelectorAll<HTMLElement>(".dialog-panel")];
  if (panels.length) {
    toolbar.setAttribute("role", "tablist");
    toolbar.setAttribute("aria-label", title.textContent!);
    panels.forEach((p, i) => {
      p.hidden = i > 0;
      toolbar.insertAdjacentHTML(
        "beforeend",
        `<button role="tab" data-dialog-tab="${i}" aria-selected="${i === 0}" class="${i === 0 ? "active" : ""}">${p.dataset.panelTitle}</button>`,
      );
    });
  }
  toolbar.hidden = !toolbar.childNodes.length;
  host.replaceChildren(header, toolbar, body, footer);
  refreshPagination();
  // Keep the close control available without selecting a purchase/choice by default.
  requestAnimationFrame(() =>
    host
      .querySelector<HTMLButtonElement>(".modal-close")
      ?.focus({ preventScroll: true }),
  );
}

window.addEventListener("resize", () => {
  const host = document.querySelector<HTMLElement>("#modal-content");
  if (!host?.querySelector(".dialog-body")) return;
  host.querySelectorAll<HTMLElement>(".dialog-pages").forEach(repaginate);
  refreshPagination();
});
