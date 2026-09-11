import { MODULES, moduleAt, occupiedSlots, adjacentReactors, modulePlacementStatus, moduleUpgradeCost, installModule, removeModule, moveModule, upgradeModule } from "./modules.js";

export function createModuleUi(root, state, { icon, notify, refresh, coreStatus, buyCore }) {
  let slot = 0;
  let moving = null;
  let signature = "";
  const act = (action, message) => {
    if (action()) notify(message);
    signature = "";
    update();
    refresh();
  };
  const button = (label, handler, disabled = false, className = "") => {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = label; node.disabled = disabled; node.className = className;
    node.addEventListener("click", handler);
    return node;
  };
  function update() {
    const bay = state.tower.moduleBay;
    const next = [bay.revision, Math.floor(state.coins), Math.ceil(bay.refitCooldown), state.threat, ...["damage", "rate", "ascend"].map((key) => state.tower.upgrades[key]), slot, moving].join(":");
    if (signature === next) return;
    signature = next;
    const focusKey = root.contains(document.activeElement) ? document.activeElement?.dataset.focus : null;
    root.classList.add("module-workspace");
    root.innerHTML = `<section class="module-layout"><div class="module-heading"><span>外围装配</span><strong>${occupiedSlots(state)} <small>/ 6 槽</small></strong></div><div class="module-ring"><div class="module-core"><span>◇</span><strong>永耀晶核</strong><small>相邻供能 · 六向防线</small></div></div><p class="module-hint">${moving !== null ? "选择目标槽位；大型模块按顺时针占两格。" : "先选择槽位，再安装模块。1 与 6 相邻。"}</p><div class="module-selection"></div><div class="module-core-upgrades"><strong>晶核调校 · 不占外围槽位</strong></div></section><section class="module-catalog"><div class="module-heading"><span>模块仓库</span><small>每种限装一件 · 最高 III 级</small></div><div class="module-cards"></div><p class="module-refit-note" role="status">${bay.refitCooldown > 0 ? `防线重整中，还需战斗 ${Math.ceil(bay.refitCooldown)} 秒才可再次装配。` : "面板内暂停战斗，可连续装配；关闭后重整 8 秒。拆卸返还总投入的 80%。"}</p></section><section class="module-build-guide"><b>构筑取舍</b><span><strong>重炮塔</strong> 穿透、首领爆发 · 留意近身盲区</span><span><strong>环刃塔</strong> 清理贴身怪群 · 优先处理远程骚扰</span><span><strong>蜂巢塔</strong> 无人机主攻 · G 安排出击与充能</span><span><strong>元素塔</strong> 反应器贴邻武器 · 3 秒内异种命中引爆</span></section>`;
    const ring = root.querySelector(".module-ring");
    for (let index = 0; index < 6; index += 1) {
      const module = moduleAt(state, index);
      const meta = module && MODULES[module.id];
      const canMove = moving !== null && modulePlacementStatus(state, moduleAt(state, moving)?.id, index, true).ok;
      const node = button("", () => {
        if (moving !== null) {
          if (moveModule(state, moving, index)) { moving = null; notify("模块位置已调整"); }
        }
        slot = index; signature = ""; update(); refresh();
      }, false, `module-slot${slot === index ? " selected" : ""}${canMove ? " can-place" : ""}`);
      const angle = index * Math.PI / 3 - Math.PI / 2;
      node.style.setProperty("--x", `${50 + Math.cos(angle) * 34}%`);
      node.style.setProperty("--y", `${50 + Math.sin(angle) * 36}%`);
      node.style.setProperty("--module-color", meta?.color ?? "#607b96");
      node.dataset.focus = `slot-${index}`;
      node.setAttribute("aria-pressed", String(slot === index));
      node.setAttribute("aria-label", `槽位 ${index + 1}，${meta?.name ?? "空槽"}${module && module.slot !== index ? "，延伸占位" : ""}`);
      node.innerHTML = `<b>${index + 1}</b><span class="module-art"></span><strong>${meta?.name ?? "空槽"}</strong><small>${module ? module.slot !== index ? "连体占位" : `Lv.${module.level} · ${meta.size} 格` : "选择安装"}</small>`;
      if (meta) icon(node.querySelector(".module-art"), meta.icon);
      ring.append(node);
    }
    const selected = moduleAt(state, slot);
    const info = root.querySelector(".module-selection");
    if (selected) {
      const meta = MODULES[selected.id];
      const adjacent = adjacentReactors(state, selected.id);
      const weapons = meta.element ? bay.installed.filter((item) => MODULES[item.id].weapon && adjacentReactors(state, item.id).includes(selected)) : [];
      info.innerHTML = `<strong>槽位 ${slot + 1} · ${meta.name} · Lv.${selected.level}</strong><p>${meta.weapon ? `相邻供能：${adjacent.map((item) => MODULES[item.id].name).join("、") || "无"}` : meta.element ? `作用于：${weapons.map((item) => MODULES[item.id].name).join("、") || "未连接武器，当前无效果"}` : `保护第 ${selected.slot + 1} 扇区 · 减伤 ${35 + selected.level * 10}%`}</p><div class="module-actions"></div>`;
      const actions = info.querySelector(".module-actions");
      actions.append(button(moving === null ? "移动" : "取消移动", () => { moving = moving === null ? selected.slot : null; signature = ""; update(); }, bay.refitCooldown > 0));
      actions.append(button(selected.level >= 3 ? "已满级" : `强化 · ${moduleUpgradeCost(selected)} 金`, () => act(() => upgradeModule(state, slot), "模块强化完成"), selected.level >= 3 || state.coins < moduleUpgradeCost(selected) || bay.refitCooldown > 0));
      actions.append(button(`拆卸 · 返 ${Math.floor(selected.invested * 0.8)} 金`, () => { moving = null; act(() => removeModule(state, slot), "模块已拆卸"); }, bay.refitCooldown > 0));
    } else {
      info.innerHTML = `<strong>槽位 ${slot + 1} · 可用</strong><p>从右侧选择模块；两格武器还需顺时针下一格空闲。</p>`;
      if (moving !== null) info.append(button("取消移动", () => { moving = null; signature = ""; update(); }));
    }
    for (const [id, meta] of Object.entries(MODULES)) {
      const status = modulePlacementStatus(state, id, slot);
      const card = button("", () => act(() => installModule(state, id, slot), `${meta.name}已安装`), !status.ok || moving !== null, "module-card");
      card.dataset.focus = `install-${id}`; card.dataset.module = id;
      card.style.setProperty("--module-color", meta.color);
      card.innerHTML = `<span class="module-art"></span><div><h3>${meta.name}<small>${meta.size} 格</small></h3><p>${meta.description}</p><strong>${status.ok ? `安装 · ${meta.cost} 金币` : status.reason}</strong></div>`;
      icon(card.querySelector(".module-art"), meta.icon);
      root.querySelector(".module-cards").append(card);
    }
    for (const [key, title] of [["damage", "全武器伤害"], ["rate", "主炮射速"], ["ascend", "晶核升阶"]]) {
      const status = coreStatus(key);
      const node = button(`${title} ${state.tower.upgrades[key]} · ${status.maxed ? "已满级" : status.unlocked ? `${status.cost} 金` : status.reason}`, () => { buyCore(key); signature = ""; update(); }, !status.unlocked || state.coins < status.cost);
      node.dataset.upgrade = key;
      node.dataset.focus = `core-${key}`;
      root.querySelector(".module-core-upgrades").append(node);
    }
    if (focusKey) root.querySelector(`[data-focus="${focusKey}"]`)?.focus({ preventScroll: true });
  }
  update();
  return { update };
}
