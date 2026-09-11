import { MODULES, BAY_COLUMNS, SLOT_COUNT, moduleAt, moduleCells, installedModule, occupiedSlots, adjacentReactors, modulePlacementStatus, moduleUpgradeCost, installModule, removeModule, moveModule, upgradeModule } from "./modules.js";

export function createCompactModuleUi(root, state, { icon, notify, refresh }) {
  const controller = new AbortController();
  const directions = ["北", "东北", "东南", "南", "西南", "西北"];
  let slot = 0;
  let held = null;
  let signature = "";
  let hover = null;

  const button = (label, handler, disabled = false, className = "") => {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.className = className;
    node.addEventListener("click", handler);
    return node;
  };
  const redraw = () => { signature = ""; update(); };
  const cancel = () => { held = null; hover = null; redraw(); };
  const pick = (id, from = null) => {
    if (from !== null) slot = from;
    held = { id, from, rotation: from === null ? 0 : moduleAt(state, from)?.rotation ?? 0 };
    hover = slot;
    redraw();
  };
  const rotate = () => {
    if (held && MODULES[held.id].size > 1) {
      held.rotation = 1 - held.rotation;
      paintPreview();
      redraw();
    }
  };
  const statusAt = (cell) => modulePlacementStatus(state, held.id, cell, held.from !== null, held.rotation);
  function place(cell) {
    if (!held) return;
    const status = statusAt(cell);
    if (!status.ok) { notify(status.reason); return; }
    const same = held.from === cell && (moduleAt(state, cell)?.rotation ?? 0) === held.rotation;
    const ok = same || (held.from === null ? installModule(state, held.id, cell, held.rotation) : moveModule(state, held.from, cell, held.rotation));
    if (ok) {
      slot = cell;
      held = null;
      hover = null;
      notify("模块已放置");
      redraw();
      refresh();
    }
  }
  function paintPreview() {
    root.querySelectorAll(".module-cell").forEach((node) => node.classList.remove("preview-good", "preview-bad"));
    const hint = root.querySelector(".module-hint");
    if (!hint) return;
    if (!held) {
      hint.textContent = "点击仓库拿起 · 点格放置 · Esc 关闭";
      return;
    }
    const cell = hover ?? slot;
    const status = statusAt(cell);
    for (let i = 0; i < MODULES[held.id].size; i++) {
      const x = cell % BAY_COLUMNS + (held.rotation === 0 ? i : 0);
      const y = Math.floor(cell / BAY_COLUMNS) + (held.rotation === 1 ? i : 0);
      if (x < 3 && y < 2) root.querySelector(`[data-cell="${y * 3 + x}"]`)?.classList.add(status.ok ? "preview-good" : "preview-bad");
    }
    hint.textContent = `${MODULES[held.id].name} · ${status.reason}${MODULES[held.id].size > 1 ? " · R 旋转" : ""}`;
  }
  function cellAt(event) {
    const board = root.querySelector(".module-board");
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return x >= 0 && x < 1 && y >= 0 && y < 1 ? Math.floor(y * 2) * 3 + Math.floor(x * 3) : null;
  }
  root.addEventListener("pointermove", (event) => {
    if (held) {
      hover = cellAt(event);
      paintPreview();
    }
  }, { signal: controller.signal });
  function handleKey(event) {
    if (!held) return false;
    if (event.key === "Escape") cancel();
    else if (event.key.toLowerCase() === "r") rotate();
    else return false;
    event.preventDefault();
    return true;
  }
  function update() {
    const bay = state.tower.moduleBay;
    const next = [bay.revision, Math.floor(state.coins), Math.ceil(bay.refitCooldown), state.over, slot, JSON.stringify(held)].join(":");
    if (signature === next) return;
    signature = next;
    root.innerHTML = `
      <header class="module-float-header">
        <div><span>拼装板</span><strong>${occupiedSlots(state)}<small>/6</small></strong></div>
        <button type="button" class="module-float-close" aria-label="关闭模块悬浮框">Esc</button>
      </header>
      <div class="module-board" aria-label="六格模块拼装板"></div>
      <div class="module-placement-tools"></div>
      <div class="module-selection"></div>
      <p class="module-hint" role="status"></p>
      <div class="module-cards" aria-label="模块仓库"></div>
      <footer class="module-float-footer"><span class="module-float-coins">◆ ${Math.floor(state.coins)}</span><span class="module-float-refit"></span></footer>`;
    root.querySelector(".module-float-close").addEventListener("click", () => root.dispatchEvent(new CustomEvent("module-float-close", { bubbles: true })));
    const board = root.querySelector(".module-board");
    for (let cell = 0; cell < SLOT_COUNT; cell++) {
      const node = button("", () => { if (held) place(cell); else { slot = cell; redraw(); } }, false, "module-cell");
      node.dataset.cell = cell;
      const occupant = moduleAt(state, cell);
      node.innerHTML = `<b>${cell + 1}</b><small>${["↑", "↗", "↘", "↓", "↙", "↖"][cell]}</small>`;
      node.setAttribute("aria-label", `第 ${cell + 1} 格，${directions[cell]}扇区，${occupant ? MODULES[occupant.id].name : "空格"}`);
      node.addEventListener("pointerenter", () => { if (held) { hover = cell; paintPreview(); } });
      board.append(node);
    }
    for (const module of bay.installed) {
      const meta = MODULES[module.id];
      const vertical = module.rotation === 1;
      const node = button("", () => {
        if (held) place(module.slot);
        else { slot = module.slot; pick(module.id, module.slot); }
      }, bay.refitCooldown > 0 || state.over, `module-piece${held?.id === module.id ? " lifted" : ""}`);
      node.dataset.pick = module.id;
      node.dataset.from = String(module.slot);
      node.style.gridColumn = `${module.slot % 3 + 1} / span ${vertical ? 1 : meta.size}`;
      node.style.gridRow = `${Math.floor(module.slot / 3) + 1} / span ${vertical ? meta.size : 1}`;
      node.style.setProperty("--module-color", meta.color);
      node.innerHTML = `<span class="module-art" aria-hidden="true"></span><strong>${meta.name}</strong><small>Lv.${module.level}</small>`;
      icon(node.querySelector(".module-art"), meta.icon);
      board.append(node);
    }
    if (held) {
      const tools = root.querySelector(".module-placement-tools");
      tools.append(
        button(`旋转 ${held.rotation ? "竖" : "横"}`, rotate, MODULES[held.id].size === 1),
        button("取消", cancel)
      );
    }
    const selected = held && held.from !== null ? installedModule(state, held.id) : moduleAt(state, slot);
    const info = root.querySelector(".module-selection");
    if (selected) {
      const meta = MODULES[selected.id];
      const neighbors = meta.weapon ? adjacentReactors(state, selected.id) : bay.installed.filter((item) => MODULES[item.id].weapon && adjacentReactors(state, item.id).includes(selected));
      info.innerHTML = `<strong>${meta.name} · Lv.${selected.level}</strong><p>${selected.id === "shield" ? `保护${directions[selected.slot]}方` : `${meta.weapon ? "供能" : "强化"}：${neighbors.map((item) => MODULES[item.id].name).join("、") || "无"}`}</p><div class="module-actions"></div>`;
      const actions = info.querySelector(".module-actions");
      const locked = bay.refitCooldown > 0 || state.over;
      const act = (fn, message) => { if (fn()) { held = null; notify(message); } redraw(); refresh(); };
      actions.append(button("移动", () => pick(selected.id, selected.slot), locked));
      actions.append(button(selected.level >= 3 ? "已满级" : `强化 ${moduleUpgradeCost(selected)}`, () => act(() => upgradeModule(state, selected.slot), "模块强化完成"), locked || selected.level >= 3 || state.coins < moduleUpgradeCost(selected)));
      actions.append(button(`拆卸 +${Math.floor(selected.invested * 0.8)}`, () => act(() => removeModule(state, selected.slot), "模块已拆卸"), locked));
    } else {
      info.innerHTML = "<strong>自由拼装</strong><p>点击仓库模块拿起，再点格子放置。</p>";
    }
    for (const [id, meta] of Object.entries(MODULES)) {
      const installed = installedModule(state, id);
      const disabled = Boolean(installed) || bay.refitCooldown > 0 || state.over || state.coins < meta.cost;
      const card = button("", () => {
        if (!disabled) pick(id);
      }, false, `module-card${held?.id === id ? " picked" : ""}${disabled ? " unavailable" : ""}`);
      card.dataset.pick = id;
      card.dataset.module = id;
      card.dataset.available = String(!disabled);
      card.title = `${meta.name} · ${meta.size} 格 · ${installed ? `Lv.${installed.level}` : `${meta.cost} 金`}`;
      card.setAttribute("aria-label", `${meta.name}，${meta.size} 格，${installed ? `已安装 Lv.${installed.level}` : `${meta.cost} 金币`}`);
      card.style.setProperty("--module-color", meta.color);
      card.innerHTML = `<span class="module-art" aria-hidden="true"></span><span class="module-card-name">${meta.name}</span><span class="module-card-price">${installed ? `Lv.${installed.level}` : meta.cost}</span>`;
      icon(card.querySelector(".module-art"), meta.icon);
      root.querySelector(".module-cards").append(card);
    }
    root.querySelector(".module-float-refit").textContent = bay.refitCooldown > 0 ? `重整 ${Math.ceil(bay.refitCooldown)}s` : "关闭后重整 8s";
    paintPreview();
  }
  update();
  return { update, handleKey, cancel, destroy: () => controller.abort() };
}

export function createModuleUi(root, state, { icon, notify, refresh, coreStatus, buyCore }) {
  const controller = new AbortController();
  const listen = (type, handler) => root.addEventListener(type, handler, { signal: controller.signal });
  let inspected = "pulse";
  let slot = 0, held = null, signature = "", hover = null, gesture = null, suppressClick = false;
  const directions = ["北", "东北", "东南", "南", "西南", "西北"];
  const button = (label, handler, disabled = false, className = "") => {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = label; node.disabled = disabled; node.className = className;
    node.addEventListener("click", handler);
    return node;
  };
  const redraw = () => { signature = ""; update(); };
  const cancel = () => { held = null; hover = null; redraw(); };
  const pick = (id, from = null) => {
    inspected = id;
    if (from !== null) slot = from;
    held = { id, from, rotation: from === null ? 0 : moduleAt(state, from)?.rotation ?? 0 };
    hover = slot; redraw();
  };
  const rotate = () => { if (held && MODULES[held.id].size > 1) { held.rotation = 1 - held.rotation; paintPreview(); redraw(); } };
  const statusAt = (cell) => modulePlacementStatus(state, held.id, cell, held.from !== null, held.rotation);
  function place(cell) {
    if (!held) return;
    const status = statusAt(cell);
    if (!status.ok) { notify(status.reason); return; }
    const same = held.from === cell && (moduleAt(state, cell)?.rotation ?? 0) === held.rotation;
    const ok = same || (held.from === null ? installModule(state, held.id, cell, held.rotation) : moveModule(state, held.from, cell, held.rotation));
    if (ok) { slot = cell; held = null; hover = null; notify("模块已放置"); redraw(); refresh(); }
  }
  function paintPreview() {
    root.querySelectorAll(".module-cell").forEach((node) => node.classList.remove("preview-good", "preview-bad"));
    const hint = root.querySelector(".module-hint");
    if (!hint) return;
    if (!held) { hint.textContent = "拖动仓库模块到拼装板，或点击拿起后点击格子放置。已装模块也可拖动。"; return; }
    const cell = hover ?? slot;
    const status = statusAt(cell);
    // Clip the ghost at the boundary without wrapping into another row.
    for (let i = 0; i < MODULES[held.id].size; i++) {
      const x = cell % BAY_COLUMNS + (held.rotation === 0 ? i : 0);
      const y = Math.floor(cell / BAY_COLUMNS) + (held.rotation === 1 ? i : 0);
      if (x < 3 && y < 2) root.querySelector(`[data-cell="${y * 3 + x}"]`)?.classList.add(status.ok ? "preview-good" : "preview-bad");
    }
    hint.textContent = `${MODULES[held.id].name} · ${status.reason} · R 旋转，Esc 取消；以指向格为左上角。`;
  }
  function cellAt(event) {
    const board = root.querySelector(".module-board");
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    return x >= 0 && x < 1 && y >= 0 && y < 1 ? Math.floor(y * 2) * 3 + Math.floor(x * 3) : null;
  }
  listen("pointerdown", (event) => {
    const source = event.target.closest("[data-pick]");
    if (!source || source.disabled || source.dataset.available === "false" || event.button !== 0) return;
    gesture = { id: source.dataset.pick, from: source.dataset.from === undefined ? null : Number(source.dataset.from), x: event.clientX, y: event.clientY, dragging: false };
    root.setPointerCapture(event.pointerId);
  });
  listen("pointermove", (event) => {
    if (gesture && !gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) {
      gesture.dragging = true; pick(gesture.id, gesture.from);
    }
    if (held) { hover = cellAt(event); paintPreview(); }
  });
  listen("pointerup", (event) => {
    if (!gesture) return;
    const current = gesture; gesture = null;
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    if (current.dragging) { const cell = cellAt(event); if (cell !== null) place(cell); else cancel(); }
    else if (held) { const cell = cellAt(event); if (cell !== null) place(cell); else pick(current.id, current.from); }
    else pick(current.id, current.from);
  });
  listen("pointercancel", () => { gesture = null; cancel(); });
  function handleKey(event) {
    if (!held) return false;
    if (event.key === "Escape") cancel();
    else if (event.key.toLowerCase() === "r") rotate();
    else return false;
    event.preventDefault(); return true;
  }
  function update() {
    const bay = state.tower.moduleBay;
    const next = [bay.revision, Math.floor(state.coins), Math.ceil(bay.refitCooldown), state.over, state.threat, ...["damage", "rate", "ascend"].map((key) => state.tower.upgrades[key]), slot, JSON.stringify(held)].join(":");
    if (signature === next || gesture?.dragging && signature && signature.split(":")[0] === String(bay.revision)) return;
    signature = next;
    const focusKey = root.contains(document.activeElement) ? document.activeElement?.dataset.focus : null;
    root.classList.add("module-workspace");
    root.innerHTML = `<section class="module-layout"><div class="module-heading"><span>晶核拼装板 · 3 × 2</span><strong>${occupiedSlots(state)} <small>/ 6 格</small></strong></div><div class="module-board" aria-label="六格模块拼装板"></div><p class="module-hint" role="status"></p><div class="module-placement-tools"></div><div class="module-selection"></div><div class="module-core-upgrades"><strong>晶核调校 · 不占拼装格</strong></div></section><section class="module-catalog"><div class="module-heading"><span>模块仓库</span><small>拿起 → 旋转 → 放置</small></div><div class="module-cards" aria-label="模块图标仓库"></div><div class="module-catalog-detail"></div><p class="module-refit-note">${bay.refitCooldown > 0 ? `防线重整中，还需战斗 ${Math.ceil(bay.refitCooldown)} 秒。` : "放置成功才扣金币。面板内暂停，可连续调整；关闭后重整 8 秒。拆卸返还总投入的 80%。"}</p></section><section class="module-build-guide"><b>拼装规则</b><span><strong>有限空间</strong>两格武器可横放或竖放，不能重叠或越界。</span><span><strong>接触供能</strong>反应器只强化上下左右接触的武器，斜角不连接。</span><span><strong>扇区护盾</strong>格号对应战场扇区，格内箭头标明保护方向。</span></section>`;
    const board = root.querySelector(".module-board");
    for (let cell = 0; cell < SLOT_COUNT; cell++) {
      const node = button("", () => { if (suppressClick) return; if (held) place(cell); else { slot = cell; redraw(); } }, false, "module-cell");
      node.dataset.cell = cell; node.dataset.focus = `cell-${cell}`;
      const occupant = moduleAt(state, cell);
      node.innerHTML = `<b>${cell + 1}</b><small>${["↑", "↗", "↘", "↓", "↙", "↖"][cell]} ${directions[cell]}</small><span>${occupant ? "" : "空格"}</span>`;
      node.setAttribute("aria-label", `第 ${cell + 1} 格，${directions[cell]}扇区，${occupant ? MODULES[occupant.id].name : "空格"}`);
      node.addEventListener("focus", () => { if (held) { hover = cell; paintPreview(); } });
      board.append(node);
    }
    for (const module of bay.installed) {
      const meta = MODULES[module.id], vertical = module.rotation === 1;
      const node = button("", () => { if (!suppressClick) { if (held) place(module.slot); else { slot = module.slot; pick(module.id, module.slot); } } }, bay.refitCooldown > 0 || state.over, `module-piece${held?.id === module.id ? " lifted" : ""}`);
      node.dataset.pick = module.id; node.dataset.from = module.slot; node.dataset.focus = `piece-${module.id}`;
      node.style.gridColumn = `${module.slot % 3 + 1} / span ${vertical ? 1 : meta.size}`;
      node.style.gridRow = `${Math.floor(module.slot / 3) + 1} / span ${vertical ? meta.size : 1}`;
      node.style.setProperty("--module-color", meta.color);
      node.innerHTML = `<span class="module-art"></span><strong>${meta.name}</strong><small>Lv.${module.level} · ${moduleCells(module).map((cell) => cell + 1).join(" + ")} 格${module.id === "shield" ? ` · ${directions[module.slot]}` : ""}</small>`;
      icon(node.querySelector(".module-art"), meta.icon); board.append(node);
    }
    if (held) {
      const tools = root.querySelector(".module-placement-tools");
      tools.append(button(`旋转 R · ${held.rotation ? "竖放" : "横放"}`, rotate, MODULES[held.id].size === 1), button("取消 Esc", cancel));
    }
    const selected = held && held.from !== null ? installedModule(state, held.id) : moduleAt(state, slot);
    const info = root.querySelector(".module-selection");
    if (selected) {
      const meta = MODULES[selected.id];
      const neighbors = meta.weapon ? adjacentReactors(state, selected.id) : bay.installed.filter((item) => MODULES[item.id].weapon && adjacentReactors(state, item.id).includes(selected));
      info.innerHTML = `<strong>${meta.name} · Lv.${selected.level}</strong><p>${selected.id === "shield" ? `保护${directions[selected.slot]}方第 ${selected.slot + 1} 扇区 · 减伤 ${35 + selected.level * 10}%` : `${meta.weapon ? "接触供能" : "强化武器"}：${neighbors.map((item) => MODULES[item.id].name).join("、") || "无连接"}`}</p><div class="module-actions"></div>`;
      const actions = info.querySelector(".module-actions"), locked = bay.refitCooldown > 0 || state.over;
      const act = (fn, message) => { if (fn()) { held = null; notify(message); } redraw(); refresh(); };
      actions.append(button("拿起移动", () => pick(selected.id, selected.slot), locked));
      actions.append(button(selected.level >= 3 ? "已满级" : `强化 · ${moduleUpgradeCost(selected)} 金`, () => act(() => upgradeModule(state, selected.slot), "模块强化完成"), locked || selected.level >= 3 || state.coins < moduleUpgradeCost(selected)));
      actions.append(button(`拆卸 · 返 ${Math.floor(selected.invested * 0.8)} 金`, () => act(() => removeModule(state, selected.slot), "模块已拆卸"), locked));
    } else info.innerHTML = "<strong>自由拼装防线</strong><p>选中仓库模块后预览占地。放不下时，先移动已有模块整理空间。</p>";
    function showDetails(id) {
      inspected = id;
      const meta = MODULES[id], installed = installedModule(state, id);
      const status = installed ? `已安装 · Lv.${installed.level}` : bay.refitCooldown > 0 ? `重整中 · ${Math.ceil(bay.refitCooldown)} 秒` : state.coins < meta.cost ? `还差 ${Math.ceil(meta.cost-state.coins)} 金币` : '拖动或点击图标拿起';
      const detail = root.querySelector('.module-catalog-detail');
      detail.style.setProperty('--module-color', meta.color);
      detail.innerHTML = `<div class="module-detail-heading"><span class="module-art" aria-hidden="true"></span><div><strong>${meta.name}</strong><small>${meta.size} 格 · ${meta.cost} 金币 · ${status}</small></div></div><p>${meta.description}</p>`;
      icon(detail.querySelector('.module-art'), meta.icon);
      root.querySelectorAll('.module-card').forEach(card=>card.classList.toggle('inspected',card.dataset.module===id));
    }
    for (const [id, meta] of Object.entries(MODULES)) {
      const installed = installedModule(state, id);
      const disabled = Boolean(installed) || bay.refitCooldown > 0 || state.over || state.coins < meta.cost;
      const card = button("", () => { showDetails(id); if (!suppressClick && !disabled) pick(id); }, false, `module-card${held?.id === id ? " picked" : ""}${disabled ? " unavailable" : ""}`);
      card.dataset.pick = id; card.dataset.module = id; card.dataset.focus = `install-${id}`; card.dataset.available=String(!disabled);
      card.setAttribute('aria-disabled',String(disabled));
      card.setAttribute('aria-label',`${meta.name}，${meta.size} 格，${meta.cost} 金币${installed?'，已安装':disabled?'，暂不可安装':''}，查看说明${disabled?'':'或拿起放置'}`);
      card.style.setProperty("--module-color", meta.color);
      card.innerHTML = `<span class="module-footprint" aria-hidden="true">${'<i></i>'.repeat(meta.size)}</span>${installed ? '<span class="module-installed" aria-hidden="true">✓</span>' : ''}<span class="module-art" aria-hidden="true"></span><span class="module-card-name">${meta.name}</span><span class="module-card-price">${installed ? `Lv.${installed.level}` : `◆ ${meta.cost}`}</span>`;
      card.addEventListener('pointerenter',()=>showDetails(id));
      card.addEventListener('focus',()=>showDetails(id));
      icon(card.querySelector(".module-art"), meta.icon); root.querySelector(".module-cards").append(card);
    }
    showDetails(held?.id ?? inspected);
    for (const [key, title] of [["damage", "全武器伤害"], ["rate", "主炮射速"], ["ascend", "晶核升阶"]]) {
      const status = coreStatus(key);
      const node = button(`${title} ${state.tower.upgrades[key]} · ${status.maxed ? "已满级" : status.unlocked ? `${status.cost} 金` : status.reason}`, () => { buyCore(key); redraw(); }, !status.unlocked || state.coins < status.cost);
      node.dataset.upgrade = key; node.dataset.focus = `core-${key}`; root.querySelector(".module-core-upgrades").append(node);
    }
    paintPreview();
    if (focusKey) root.querySelector(`[data-focus="${focusKey}"]`)?.focus({ preventScroll: true });
  }
  update();
  return { update, handleKey, cancel, destroy: () => controller.abort() };
}
