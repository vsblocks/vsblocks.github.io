export default async function ({ addon, console }) {
  const KEY = 'codeEditorTabbing';
  const STAMP = 'tabId';
  const LIST = 'tabList';
  const LEGACY_MARK = '// multi-tab configuration entry\n';

  const Blockly = await addon.tab.traps.getBlockly();
  const vm = addon.tab.traps.vm;
  const { RenderedTarget } = vm.exports;

  let tabTarget = null;
  let tabs = [];
  let selectedId = null;
  let hoveredId = null;
  let dragging = false;
  let pendingDrop = null;
  let commentTabs = {};
  let press = null;
  let reorderEndedAt = -1e9;
  let viewOwner = null;
  let viewOwnerTarget = null;

  let scroll = 0;
  let scrollSelected = false;
  let selectStartX = 0;
  let selectStartScroll = 0;

  const soup_ = '!#%()*+,-./:;=?@[]^_`{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function uid() {
    const id = [];
    for (let i = 0; i < 20; i++) id[i] = soup_.charAt(Math.random() * soup_.length);
    return id.join('');
  }
  const newTabId = () => 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const flag = (name, def) => {
    const v = addon.settings.get(name);
    return v === undefined || v === null ? def : (v === true || v === 'true');
  };
  const tabById = id => tabs.find(t => t.id === id);
  const warn = (...args) => console.warn('[tabs]', ...args);

  function stampOf(blockId) {
    const s = tabTarget.blocks._blocks[blockId]?.mutation?.[STAMP];
    return typeof s === 'string' ? s : null;
  }
  function setStamp(blockId, tabId) {
    const block = tabTarget.blocks._blocks[blockId];
    if (!block) return;
    if (!block.mutation || typeof block.mutation !== 'object') block.mutation = { tagName: 'mutation', children: [] };
    block.mutation.tagName ??= 'mutation';
    block.mutation.children ??= [];
    block.mutation[STAMP] = tabId;
  }
  function tabIdOfScript(blockId) {
    const s = stampOf(blockId);
    return s && tabById(s) ? s : tabs[0].id;
  }
  const scriptsOf = tabId => tabTarget.blocks._scripts.filter(id => tabIdOfScript(id) === tabId);
  function commentTabIdOf(commentId) {
    const t = commentTabs[commentId];
    return t && tabById(t) ? t : tabs[0].id;
  }

  const isLegacyComment = c => !!c && typeof c.text === 'string' && c.text.startsWith(LEGACY_MARK);
  function readLegacy(target) {
    for (const c of Object.values(target.comments || {})) {
      if (!isLegacyComment(c)) continue;
      try {
        const old = JSON.parse(c.text.slice(LEGACY_MARK.length));
        if (!Array.isArray(old) || !old.length) return null;
        const blocks = target.blocks._blocks;
        const byOldId = {};
        for (const id in blocks) {
          const o = blocks[id].mutation?.blockId;
          if (typeof o === 'string' && o !== id) byOldId[o] = id;
        }
        const out = { tabs: [], selected: null, comments: {}, stamps: new Map() };
        old.forEach((t, i) => {
          const id = newTabId();
          out.tabs.push({ id, name: typeof t.name === 'string' && t.name ? t.name : `Tab ${i + 1}` });
          if (t.selected) out.selected = id;
          for (const s of t.scripts || []) {
            const cur = blocks[s] ? s : byOldId[s];
            if (cur) out.stamps.set(cur, id);
          }
          for (const cid of t.comments || []) out.comments[cid] = id;
        });
        out.selected ??= out.tabs[0].id;
        return out;
      } catch (err) { warn('could not read the tabs from the old format', err); return null; }
    }
    return null;
  }

  function parseView(v) {
    if (!Array.isArray(v) || v.length < 3) return null;
    const [x, y, s] = v;
    if (![x, y, s].every(n => typeof n === 'number' && Number.isFinite(n)) || s <= 0) return null;
    return [x, y, s];
  }

  function captureView() {
    try {
      if (!viewOwner || !tabTarget || viewOwnerTarget !== tabTarget) return;
      const meta = tabById(viewOwner);
      const ws = Blockly.getMainWorkspace();
      if (!meta || !ws) return;
      const view = parseView([ws.scrollX, ws.scrollY, ws.scale]);
      if (view) meta.view = [Math.round(view[0] * 10) / 10, Math.round(view[1] * 10) / 10, Math.round(view[2] * 1000) / 1000];
    } catch (err) { warn('could not capture the block area position', err); }
  }

  function restoreView() {
    viewOwner = selectedId;
    viewOwnerTarget = tabTarget;
    try {
      const meta = tabById(selectedId);
      const ws = Blockly.getMainWorkspace();
      if (!meta || !meta.view || !ws) return;
      ws.scrollX = meta.view[0];
      ws.scrollY = meta.view[1];
      ws.scale = meta.view[2];
      ws.resize();
    } catch (err) { warn('could not restore the block area position', err); }
  }

  function stampTabList() {
    const list = JSON.stringify(tabs.map(t => (t.view ? [t.id, t.name, t.view] : [t.id, t.name])));
    const blocks = tabTarget.blocks;
    for (const id of blocks._scripts) {
      const block = blocks._blocks[id];
      if (!block) continue;
      if (!block.mutation || typeof block.mutation !== 'object') block.mutation = { tagName: 'mutation', children: [] };
      block.mutation.tagName ??= 'mutation';
      block.mutation.children ??= [];
      if (block.mutation[LIST] !== list) block.mutation[LIST] = list;
    }
  }

  function parseTabList(raw) {
    if (typeof raw !== 'string') return null;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      const out = [];
      for (const item of arr) {
        if (!Array.isArray(item) || typeof item[0] !== 'string' || !item[0]) continue;
        if (out.some(t => t.id === item[0])) continue;
        out.push({ id: item[0], name: typeof item[1] === 'string' ? item[1] : '', view: parseView(item[2]) });
      }
      return out.length ? out : null;
    } catch (err) {
      return null;
    }
  }

  function readStampList(target) {
    const blocks = target.blocks;
    const counts = new Map();
    for (const id of blocks._scripts) {
      const raw = blocks._blocks[id]?.mutation?.[LIST];
      if (typeof raw === 'string') counts.set(raw, (counts.get(raw) || 0) + 1);
    }
    let best = null;
    let bestCount = 0;
    for (const [raw, count] of counts) {
      if (count > bestCount && parseTabList(raw)) {
        best = raw;
        bestCount = count;
      }
    }
    return best ? parseTabList(best) : null;
  }

  function hasAnyStamp(target) {
    const blocks = target.blocks;
    return blocks._scripts.some(id => typeof blocks._blocks[id]?.mutation?.[STAMP] === 'string');
  }

  function stampedName(target, blockId, tabId) {
    const list = parseTabList(target.blocks._blocks[blockId]?.mutation?.[LIST]);
    const entry = list && list.find(t => t.id === tabId);
    return entry ? entry.name : '';
  }

  function persist() {
    if (!tabTarget || !tabs.length) return;
    for (const cid of Object.keys(commentTabs))
      if (!tabTarget.comments[cid]) delete commentTabs[cid];
    tabTarget.extensionStorage ??= {};
    tabTarget.extensionStorage[KEY] = {
      v: 2,
      tabs: tabs.map(t => (t.view ? { id: t.id, name: t.name, view: t.view } : { id: t.id, name: t.name })),
      selected: selectedId,
      comments: { ...commentTabs }
    };
    try { stampTabList(); } catch (err) { warn('could not write the tabs into the scripts', err); }
  }

  function loadTarget(target) {
    captureView();
    if (tabTarget && tabTarget !== target) persist();
    tabTarget = target;
    viewOwner = null;
    viewOwnerTarget = null;
    tabs = [];
    commentTabs = {};
    let saved = target.extensionStorage?.[KEY];
    let legacy = null;
    if (!(saved && Array.isArray(saved.tabs))) {
      const list = readStampList(target);
      if (list) {
        saved = { tabs: list, selected: null, comments: {} };
      } else if (!hasAnyStamp(target)) {
        legacy = readLegacy(target);
        saved = legacy;
      } else {
        saved = null;
      }
    }
    if (saved && Array.isArray(saved.tabs)) {
      for (const t of saved.tabs) {
        if (!t || typeof t.id !== 'string' || tabById(t.id)) continue;
        tabs.push({ id: t.id, name: typeof t.name === 'string' && t.name ? t.name : '', view: parseView(t.view), element: null });
      }
      if (saved.comments && typeof saved.comments === 'object') Object.assign(commentTabs, saved.comments);
    }
    const blocks = target.blocks;
    for (const id of blocks._scripts) {
      const s = stampOf(id);
      if (s && !tabById(s)) tabs.push({ id: s, name: stampedName(target, id, s), element: null });
    }
    if (!tabs.length) tabs.push({ id: newTabId(), name: '', element: null });
    tabs.forEach((t, i) => { if (!t.name) t.name = `Tab ${i + 1}`; });
    if (legacy) for (const [blockId, tabId] of legacy.stamps) if (blocks._blocks[blockId]) setStamp(blockId, tabId);
    const fallbackTab = legacy && tabById(legacy.selected) ? legacy.selected : tabs[0].id;
    for (const id of blocks._scripts) if (!stampOf(id)) setStamp(id, fallbackTab);
    selectedId = saved && tabById(saved.selected) ? saved.selected : tabs[0].id;
    rebuildUI();
    persist();
  }

  function ensureTarget() {
    const target = vm.editingTarget;
    if (!target || !target.blocks) return false;
    if (target !== tabTarget) loadTarget(target);
    return true;
  }
  function safeEnsure() {
    try { return ensureTarget(); } catch (err) { warn('failed to load the tabs', err); return false; }
  }

  const ogEmitUpdate = vm.emitWorkspaceUpdate;
  vm.emitWorkspaceUpdate = function () {
    captureView();
    if (!safeEnsure()) {
      viewOwner = null;
      viewOwnerTarget = null;
      return ogEmitUpdate.call(this);
    }
    const target = tabTarget;
    const blocks = target.blocks;
    const realScripts = blocks._scripts;
    const realComments = target.comments;
    const shownComments = {};
    for (const cid in realComments) {
      const c = realComments[cid];
      if (isLegacyComment(c)) continue;
      if ((c.blockId !== null && c.blockId !== undefined) || commentTabIdOf(cid) === selectedId)
        shownComments[cid] = c;
    }
    let captured = null;
    const hadOwnEmit = Object.prototype.hasOwnProperty.call(vm, 'emit');
    const prevEmit = vm.emit;
    vm.emit = function (name, ...args) {
      if (name === 'workspaceUpdate' && !captured) { captured = args; return true; }
      return prevEmit.call(this, name, ...args);
    };
    blocks._scripts = realScripts.filter(id => tabIdOfScript(id) === selectedId);
    target.comments = shownComments;
    try {
      ogEmitUpdate.call(this);
    } finally {
      blocks._scripts = realScripts;
      target.comments = realComments;
      if (hadOwnEmit) vm.emit = prevEmit; else delete vm.emit;
    }
    if (captured) {
      vm.emit('workspaceUpdate', ...captured);
      restoreView();
    }
  };

  const ogBlockListener = vm.blockListener;
  vm.blockListener = function (e) {
    if (!safeEnsure()) return ogBlockListener(e);
    let stampBefore = null;
    try {
      if (e && e.type === 'delete' && typeof e.blockId === 'string') {
        const top = tabTarget.blocks.getTopLevelScript(e.blockId);
        if (top === null || tabIdOfScript(top) !== selectedId) return;
      }
      if (e && e.type === 'comment_delete' && typeof e.commentId === 'string') {
        const c = tabTarget.comments[e.commentId];
        if (c && (c.blockId === null || c.blockId === undefined) && commentTabIdOf(e.commentId) !== selectedId) return;
      }
      if (e && e.type === 'change' && e.element === 'mutation' && typeof e.blockId === 'string')
        stampBefore = stampOf(e.blockId);
    } catch (err) { warn('event filter', err); }

    ogBlockListener(e);

    try { afterEvent(e, stampBefore); } catch (err) { warn('after event', err); }
  };

  function afterEvent(e, stampBefore) {
    if (!e) return;
    const blocks = tabTarget.blocks;
    switch (e.type) {
    case 'create': {
      if (typeof e.blockId !== 'string') break;
      const top = blocks.getTopLevelScript(e.blockId);
      if (top) setStamp(top, selectedId);
      break;
    }
    case 'move': {
      if (typeof e.blockId === 'string' && !e.newParentId && blocks.getBlock(e.blockId))
        setStamp(e.blockId, selectedId);
      break;
    }
    case 'change': {
      if (stampBefore && e.element === 'mutation' && !stampOf(e.blockId)) setStamp(e.blockId, stampBefore);
      break;
    }
    case 'comment_create': {
      const c = tabTarget.comments[e.commentId];
      if (c && (c.blockId === null || c.blockId === undefined)) {
        commentTabs[e.commentId] = selectedId;
        persist();
      }
      break;
    }
    case 'comment_delete': {
      if (commentTabs[e.commentId]) { delete commentTabs[e.commentId]; persist(); }
      break;
    }
    case 'endDrag': {
      const drop = pendingDrop;
      pendingDrop = null;
      clearDragUI();
      if (!drop || !drop.tabId || drop.tabId === selectedId || !tabById(drop.tabId)) break;
      if (typeof e.blockId === 'string' && drop.blockId && e.blockId !== drop.blockId) break;
      dropScriptOnTab(drop.blockId, drop.tabId);
      break;
    }
    }
  }

  function dropScriptOnTab(blockId, destId) {
    const blocks = tabTarget.blocks;
    const block = blocks.getBlock(blockId);
    if (!block || block.parent !== null || !blocks._scripts.includes(blockId)) return;
    const isDefinition = typeof block.opcode === 'string' && block.opcode.startsWith('procedures_definition');
    if (flag('moveOnDrag', false) || isDefinition) {
      setStamp(blockId, destId);
      selectTab(destId);
    } else {
      copyScript(blockId, destId);
    }
  }

  function copyScript(topId, destId) {
    const blocks = tabTarget.blocks;
    const order = [];
    const seen = new Set();
    const stack = [topId];
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      const b = blocks.getBlock(id);
      if (!b) continue;
      seen.add(id);
      order.push(id);
      if (b.next) stack.push(b.next);
      for (const name in b.inputs) {
        const input = b.inputs[name];
        if (input.block) stack.push(input.block);
        if (input.shadow) stack.push(input.shadow);
      }
    }
    const map = new Map(order.map(id => [id, uid()]));
    const remap = id => (id && map.has(id) ? map.get(id) : null);
    const clones = order.map(id => {
      const c = JSON.parse(JSON.stringify(blocks.getBlock(id)));
      c.id = map.get(id);
      c.parent = remap(c.parent);
      c.next = remap(c.next);
      for (const name in c.inputs) {
        const input = c.inputs[name];
        input.block = remap(input.block);
        input.shadow = remap(input.shadow);
      }
      delete c.comment;
      return c;
    });
    const top = clones[0];
    top.topLevel = true;
    top.parent = null;
    top.x = (top.x || 0) + 30;
    top.y = (top.y || 0) + 30;
    top.mutation = {
      ...(top.mutation || {}),
      tagName: top.mutation?.tagName ?? 'mutation',
      children: top.mutation?.children ?? [],
      [STAMP]: destId
    };
    for (const c of clones) blocks.createBlock(c);
  }

  const rt = vm.runtime;
  const ogGlowScript = rt.glowScript;
  rt.glowScript = function (script, glow) {
    try {
      if (tabTarget && tabs.length && tabTarget.blocks._blocks[script] && tabIdOfScript(script) !== selectedId) return;
    } catch (err) {}
    return ogGlowScript.call(this, script, glow);
  };

  const vmSaveJSON = vm.toJSON;
  vm.toJSON = function (optTargetId, serializationOptions) {
    captureView();
    try { persist(); } catch (err) { warn('persist', err); }
    const json = vmSaveJSON.call(this, optTargetId, serializationOptions);
    try {
      const originals = vm.runtime.targets.filter(t => t.isOriginal && t.extensionStorage?.[KEY]);
      if (!originals.length || typeof json !== 'string') return json;
      const obj = JSON.parse(json);
      const list = Array.isArray(obj.targets) ? obj.targets : [obj];
      let changed = false;
      for (const st of list) {
        const t = originals.find(x => x.getName() === st.name);
        if (!t) continue;
        st.extensionStorage = { ...(st.extensionStorage || {}), [KEY]: t.extensionStorage[KEY] };
        changed = true;
      }
      return changed ? JSON.stringify(obj) : json;
    } catch (err) {
      warn('could not save the tabs into the project', err);
      return json;
    }
  };

  const ogDuplicate = RenderedTarget.prototype.duplicate;
  RenderedTarget.prototype.duplicate = function () {
    try { if (this === tabTarget) persist(); } catch (err) { warn('persist', err); }
    const saved = this.extensionStorage?.[KEY];
    const result = ogDuplicate.call(this);
    if (!saved || !result || typeof result.then !== 'function') return result;
    return result.then(copy => {
      try {
        copy.extensionStorage ??= {};
        copy.extensionStorage[KEY] = JSON.parse(JSON.stringify(saved));
      } catch (err) { warn('could not copy the tabs to the duplicated sprite', err); }
      return copy;
    });
  };

  function mutationToDom(mutation, generateShadows) {
    const str = tabTarget.blocks.mutationToXML(mutation);
    const element = new DOMParser().parseFromString(`<xml>${str}</xml>`, 'text/xml').firstChild.firstChild;
    if (generateShadows) element.setAttribute('generateshadows', 'true');
    return element;
  }
  function domToMutationObject(dom) {
    const obj = Object.create(null);
    obj.tagName = dom.tagName.toLowerCase();
    obj.children = [];
    for (const attr of Array.from(dom.attributes)) obj[attr.name] = attr.value;
    for (const child of Array.from(dom.children)) obj.children.push(domToMutationObject(child));
    return Object.assign({}, obj);
  }
  class MutatorWrapper {
    constructor(mutation, blockId) { this.mutation = mutation; this.blockId = blockId; }
    get id() { return this.blockId; }
    get workspace() { return Blockly.getMainWorkspace(); }
    getInput() { return null; }
    getProcCode() { return this.mutation?.proccode; }
    mutationToDom(generateShadows) { return mutationToDom(this.mutation, generateShadows); }
    domToMutation(dom) {
      const block = tabTarget.blocks._blocks[this.blockId];
      const stamp = block?.mutation?.[STAMP];
      this.mutation = domToMutationObject(dom);
      if (stamp) this.mutation[STAMP] = stamp;
      if (block) block.mutation = this.mutation;
    }
  }
  function findVmPrototype(procCode) {
    const blocks = tabTarget.blocks;
    for (const id in blocks._blocks) {
      const b = blocks._blocks[id];
      if (b.opcode === 'procedures_prototype' && b.mutation && b.mutation.proccode === procCode) return b;
    }
    return null;
  }
  function walkScript(rootId, fn) {
    const blocks = tabTarget.blocks;
    const stack = [rootId];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const b = blocks.getBlock(id);
      if (!b) continue;
      fn(b);
      if (b.next) stack.push(b.next);
      for (const name in b.inputs) {
        if (b.inputs[name].block) stack.push(b.inputs[name].block);
      }
    }
  }
  const Procedures = Blockly.Procedures;
  const isMain = ws => !ws || ws === Blockly.getMainWorkspace();
  if (Procedures) {
    const ogAllMutations = Procedures.allProcedureMutations;
    Procedures.allProcedureMutations = function (root) {
      const result = ogAllMutations.call(this, root);
      try {
        if (!tabTarget || !isMain(root)) return result;
        const have = new Set(result.map(m => m.getAttribute('proccode')));
        const blocks = tabTarget.blocks;
        for (const id in blocks._blocks) {
          const b = blocks._blocks[id];
          if (b.opcode === 'procedures_prototype' && b.mutation && !have.has(b.mutation.proccode)) {
            have.add(b.mutation.proccode);
            result.push(mutationToDom(b.mutation, true));
          }
        }
      } catch (err) { warn('allProcedureMutations', err); }
      return result;
    };

    const ogGetDefineBlock = Procedures.getDefineBlock;
    Procedures.getDefineBlock = function (procCode, workspace) {
      const real = ogGetDefineBlock.call(this, procCode, workspace);
      if (real) return real;
      try {
        if (!tabTarget || !isMain(workspace)) return real;
        const proto = findVmPrototype(procCode);
        if (proto) {
          const def = tabTarget.blocks.getBlock(proto.parent);
          return new MutatorWrapper(def?.mutation ?? proto.mutation, proto.id);
        }
      } catch (err) { warn('getDefineBlock', err); }
      return real;
    };

    const ogGetPrototypeBlock = Procedures.getPrototypeBlock;
    Procedures.getPrototypeBlock = function (procCode, workspace) {
      try {
        const define = Procedures.getDefineBlock(procCode, workspace);
        if (define instanceof MutatorWrapper) {
          const proto = findVmPrototype(procCode);
          return proto ? new MutatorWrapper(proto.mutation, proto.id) : null;
        }
      } catch (err) { warn('getPrototypeBlock', err); }
      return ogGetPrototypeBlock.call(this, procCode, workspace);
    };

    const ogGetCallers = Procedures.getCallers;
    Procedures.getCallers = function (name, ws, definitionRoot, allowRecursive) {
      const callers = ogGetCallers.call(this, name, ws, definitionRoot, allowRecursive);
      try {
        if (!tabTarget || !isMain(ws)) return callers;
        const have = new Set(callers.map(c => c.id));
        for (const rootId of tabTarget.blocks._scripts) {
          if (tabIdOfScript(rootId) === selectedId) continue;
          if (!allowRecursive && definitionRoot && rootId === definitionRoot.id) continue;
          walkScript(rootId, b => {
            if (b.opcode === 'procedures_call' && b.mutation?.proccode === name && !have.has(b.id)) {
              have.add(b.id);
              callers.push(new MutatorWrapper(b.mutation, b.id));
            }
          });
        }
      } catch (err) { warn('getCallers', err); }
      return callers;
    };
  }

  const workspace = Blockly.getMainWorkspace();
  const Dragger = Blockly.BlockDragger && Blockly.BlockDragger.prototype;
  if (Dragger) {
    const ogStartBlockDrag = Dragger.startBlockDrag;
    Dragger.startBlockDrag = function (...args) {
      dragging = true;
      return ogStartBlockDrag.apply(this, args);
    };
    const ogFireEndDrag = Dragger.fireEndDragEvent_;
    Dragger.fireEndDragEvent_ = function (...args) {
      pendingDrop = { blockId: this.draggingBlock_ && this.draggingBlock_.id, tabId: hoveredId };
      return ogFireEndDrag.apply(this, args);
    };
  }
  if (workspace && Array.isArray(workspace.listeners_)) {
    let at = workspace.listeners_.indexOf(ogBlockListener);
    if (at === -1) at = workspace.listeners_.findIndex(f => typeof f === 'function' && ogBlockListener.name && f.name === ogBlockListener.name);
    if (at !== -1) workspace.listeners_.splice(at, 1);
  }

  const blockSpace = (workspace && workspace.getInjectionDiv && workspace.getInjectionDiv()) ||
    document.querySelector('.injectionDiv');
  if (!blockSpace) { warn('block area not found'); return; }
  const flyout = blockSpace.querySelector('.blocklyFlyout');
  const toolbox = blockSpace.querySelector('.blocklyToolboxDiv');
  const scrollBar = document.createElement('div');
  scrollBar.classList.add('tab-scrollbar');
  const tabScroller = document.createElement('div');
  tabScroller.classList.add('tab-scroller');
  tabScroller.onmouseleave = () => { hoveredId = null; };
  const tabWrapper = document.createElement('div');
  tabWrapper.classList.add('tab-wrapper');
  tabWrapper.appendChild(tabScroller);
  tabWrapper.appendChild(scrollBar);
  (function animateBar() {
    try {
      const boundSize = blockSpace.getBoundingClientRect();
      const right = Math.max(flyout ? flyout.getBoundingClientRect().right : 0, toolbox ? toolbox.getBoundingClientRect().right : 0);
      tabWrapper.style.width = `calc(100% - ${right - boundSize.left}px)`;
      computeScrollbar();
    } catch (err) {}
    requestAnimationFrame(animateBar);
  })();
  blockSpace.appendChild(tabWrapper);
  const addButton = document.createElement('img');
  addButton.src = addon.self.getResource('/add.svg');
  addButton.textContent = '+';
  addButton.classList.add('tab-adder-button');
  tabScroller.appendChild(addButton);

  const menu = document.createElement('div');
  menu.classList.add('tab-context-menu');
  menu.style.position = 'fixed';
  menu.style.display = 'none';
  document.body.appendChild(menu);

  function hideMenu() {
    menu.style.display = 'none';
    menu.textContent = '';
  }
  function menuItem(label, onClick, { danger = false, disabled = false } = {}) {
    const item = document.createElement('div');
    item.textContent = label;
    item.classList.add('tab-context-item');
    if (danger) item.classList.add('danger');
    if (disabled) item.classList.add('disabled');
    if (!disabled) {
      item.onclick = e => {
        e.stopPropagation();
        hideMenu();
        onClick();
      };
    }
    return item;
  }
  function menuHeader(label) {
    const item = document.createElement('div');
    item.textContent = label;
    item.classList.add('tab-context-header');
    return item;
  }
  function menuSeparator() {
    const sep = document.createElement('div');
    sep.classList.add('tab-context-separator');
    return sep;
  }

  function showMenu(meta, x, y) {
    if (!safeEnsure()) return;
    menu.textContent = '';
    const idx = tabs.findIndex(t => t.id === meta.id);
    if (idx === -1) return;
    const others = tabs.filter(t => t.id !== meta.id);
    const neighbour = tabs[idx + 1] || tabs[idx - 1];
    const count = scriptsOf(meta.id).length;

    menu.appendChild(menuItem('Rename', () => renameTab(meta)));
    menu.appendChild(menuSeparator());
    menu.appendChild(menuItem(
      'Delete tab (keep scripts)',
      () => removeTab(meta.id, 'merge', neighbour && neighbour.id),
      { disabled: others.length === 0 }
    ));
    menu.appendChild(menuItem(
      `Delete tab and ${count} script(s)`,
      () => removeTab(meta.id, 'delete'),
      { danger: true, disabled: others.length === 0 }
    ));
    if (others.length) {
      menu.appendChild(menuSeparator());
      menu.appendChild(menuHeader('Merge and delete, sending to'));
      for (const t of others) {
        menu.appendChild(menuItem(t.name, () => removeTab(meta.id, 'merge', t.id)));
      }
    }

    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.display = 'block';
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - w - 4))}px`;
    menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - h - 4))}px`;
  }

  document.addEventListener('mousedown', e => {
    if (menu.style.display !== 'none' && !menu.contains(e.target)) hideMenu();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.style.display !== 'none') hideMenu();
  }, true);
  window.addEventListener('blur', hideMenu);
  window.addEventListener('resize', hideMenu);
  tabWrapper.addEventListener('wheel', hideMenu);

  function clearDragUI() {
    dragging = false;
    tabWrapper.classList.remove('copying');
    for (const t of tabs) {
      if (!t.element) continue;
      t.element.classList.remove('copying');
      t.element.classList.remove('hover');
      t.element.parentElement?.classList.remove('copying');
    }
  }

  function updateTabClasses() {
    for (const t of tabs) {
      if (!t.element) continue;
      t.element.classList.remove('selected');
      t.element.classList.remove('unselected');
      t.element.classList.add(t.id === selectedId ? 'selected' : 'unselected');
    }
  }

  function renameTab(meta) {
    const res = prompt(`New name for "${meta.name}"?`, meta.name);
    const name = (res || '').trim();
    if (!name || name === meta.name) return;
    meta.name = name;
    if (meta.element) meta.element.textContent = name;
    persist();
  }

  function moveTab(meta, index) {
    const from = tabs.indexOf(meta);
    if (from === -1 || from === index || !meta.element) return false;
    tabs.splice(from, 1);
    tabs.splice(index, 0, meta);
    const next = tabs[index + 1];
    tabScroller.insertBefore(meta.element.parentElement, next && next.element ? next.element.parentElement : addButton);
    return true;
  }

  function indexForPointer(meta, x) {
    let n = 0;
    for (const t of tabs) {
      if (t === meta || !t.element) continue;
      const r = t.element.getBoundingClientRect();
      if (x > r.left + r.width / 2) n++;
    }
    return n;
  }

  function autoScrollTabs(x) {
    if (scrollBar.hidden) return;
    const r = tabWrapper.getBoundingClientRect();
    if (x < r.left + 24) scroll -= 12;
    else if (x > r.right - 24) scroll += 12;
  }

  function finishPress() {
    const p = press;
    press = null;
    if (!p || !p.active) return;
    reorderEndedAt = performance.now();
    if (p.meta.element) p.meta.element.classList.remove('reordering');
    tabWrapper.classList.remove('reordering');
    if (tabs.indexOf(p.meta) !== p.startIndex) persist();
  }

  document.addEventListener('mousemove', e => {
    if (!press) return;
    if (e.buttons === 0) {
      finishPress();
      return;
    }
    if (!press.active) {
      if (Math.abs(e.clientX - press.startX) < 5 && Math.abs(e.clientY - press.startY) < 5) return;
      press.active = true;
      hideMenu();
      if (press.meta.element) press.meta.element.classList.add('reordering');
      tabWrapper.classList.add('reordering');
    }
    autoScrollTabs(e.clientX);
    moveTab(press.meta, indexForPointer(press.meta, e.clientX));
  });
  document.addEventListener('mouseup', () => { if (press) finishPress(); });
  window.addEventListener('blur', () => { if (press) finishPress(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !press) return;
    if (press.active) {
      moveTab(press.meta, press.startIndex);
      e.preventDefault();
      e.stopPropagation();
    }
    finishPress();
  }, true);

  function createTabElement(meta) {
    const tabOuter = document.createElement('div');
    tabOuter.classList.add('tab-bounds');
    const tab = document.createElement('div');
    meta.element = tab;
    tab.classList.add('tab');
    tab.textContent = meta.name;
    tabOuter.onmousedown = e => {
      if (e.button !== 0 || tabs.length < 2) return;
      press = { meta, startX: e.clientX, startY: e.clientY, startIndex: tabs.indexOf(meta), active: false };
    };
    tabOuter.onclick = () => {
      if (performance.now() - reorderEndedAt < 150) return;
      if (meta.id === selectedId) {
        renameTab(meta);
        return;
      }
      selectTab(meta.id);
    };
    tabOuter.oncontextmenu = e => {
      e.preventDefault();
      e.stopPropagation();
      if (press && press.active) return;
      showMenu(meta, e.clientX, e.clientY);
    };
    tab.onmouseenter = () => {
      hoveredId = meta.id;
      if (dragging) {
        tab.classList.add('copying');
        tabOuter.classList.add('copying');
        tabWrapper.classList.add('copying');
        return;
      }
      tab.classList.add('hover');
    };
    tab.onmouseleave = () => {
      if (hoveredId === meta.id) hoveredId = null;
      tab.classList.remove('copying');
      tabOuter.classList.remove('copying');
      tabWrapper.classList.remove('copying');
      tab.classList.remove('hover');
    };
    tabOuter.appendChild(tab);
    addButton.before(tabOuter);
  }

  function rebuildUI() {
    hoveredId = null;
    press = null;
    tabWrapper.classList.remove('reordering');
    hideMenu();
    while (tabScroller.children.length > 1) tabScroller.children[0].remove();
    for (const t of tabs) createTabElement(t);
    updateTabClasses();
    computeScrollbar();
  }

  function selectTab(id) {
    if (!tabTarget || !tabById(id)) return;
    selectedId = id;
    updateTabClasses();
    persist();
    vm.runtime._scriptGlowsPreviousFrame = [];
    vm.emitWorkspaceUpdate();
  }

  function addTab(select = true) {
    if (!safeEnsure()) return;
    let n = tabs.length + 1;
    while (tabs.some(t => t.name === `Tab ${n}`)) n++;
    const meta = { id: newTabId(), name: `Tab ${n}`, element: null };
    tabs.push(meta);
    createTabElement(meta);
    persist();
    computeScrollbar();
    if (select) selectTab(meta.id);
  }

  function removeTab(id, mode = 'auto', destId = null) {
    if (!safeEnsure() || tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = tabs[idx];
    const wasSelected = tab.id === selectedId;
    const neighbour = tabs[idx + 1] || tabs[idx - 1];
    const chosen = destId && destId !== id ? tabById(destId) : null;
    const dest = chosen || (wasSelected ? neighbour : tabById(selectedId));
    const scripts = scriptsOf(tab.id);
    const merge = mode === 'merge' ? true : mode === 'delete' ? false : flag('shouldDelete', true);
    if (!merge && scripts.length > 0 &&
        !confirm(`Deleting the tab "${tab.name}" will DELETE ${scripts.length} script(s). Continue?`)) return;

    const looseComments = Object.keys(tabTarget.comments).filter(cid => {
      const c = tabTarget.comments[cid];
      return (c.blockId === null || c.blockId === undefined) && commentTabIdOf(cid) === tab.id;
    });
    if (merge) {
      for (const s of scripts) setStamp(s, dest.id);
      for (const cid of looseComments) commentTabs[cid] = dest.id;
    } else {
      for (const s of scripts) tabTarget.blocks.deleteBlock(s);
      for (const cid of looseComments) tabTarget.deleteComment?.(cid);
    }

    tab.element?.parentElement?.remove();
    tabs.splice(idx, 1);
    if (hoveredId === tab.id) hoveredId = null;
    if (wasSelected) selectedId = dest.id;
    updateTabClasses();
    persist();
    computeScrollbar();
    vm.runtime._scriptGlowsPreviousFrame = [];
    vm.emitWorkspaceUpdate();
  }

  addButton.onclick = () => addTab(true);

  function computeScrollbar() {
    scrollBar.hidden = true;
    const bodySize = tabScroller.getBoundingClientRect();
    const wrapperSize = tabWrapper.getBoundingClientRect();
    const diff = bodySize.width - wrapperSize.width;
    const len = wrapperSize.width - diff;
    if (len > wrapperSize.width) return;
    scrollBar.hidden = false;
    scrollBar.style.width = `${len}px`;
    scroll = Math.max(Math.min(scroll, diff), 0);
    scrollBar.style.left = `${scroll}px`;
    tabScroller.style.left = `-${scroll}px`;
  }
  tabWrapper.onwheel = e => {
    const bodySize = tabScroller.getBoundingClientRect();
    const wrapperSize = tabWrapper.getBoundingClientRect();
    const diff = bodySize.width - wrapperSize.width;
    scroll = Math.max(Math.min((e.deltaX || e.deltaY) + scroll, diff), 0);
    scrollBar.style.left = `${scroll}px`;
    tabScroller.style.left = `-${scroll}px`;
  };
  scrollBar.onmousedown = e => {
    scrollSelected = true;
    selectStartScroll = scroll;
    selectStartX = e.x;
  };
  document.addEventListener('mouseup', () => { scrollSelected = false; });
  document.addEventListener('mousemove', e => {
    if (!scrollSelected) return;
    const bodySize = tabScroller.getBoundingClientRect();
    const wrapperSize = tabWrapper.getBoundingClientRect();
    const diff = bodySize.width - wrapperSize.width;
    scroll = Math.max(Math.min((e.x - selectStartX) + selectStartScroll, diff), 0);
    scrollBar.style.left = `${scroll}px`;
    tabScroller.style.left = `-${scroll}px`;
  });

  function isTyping(e) {
    const el = e.target;
    if (!el || !el.tagName) return false;
    return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
  }
  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || (press && press.active)) return;
    if (!tabTarget || !tabs.length) return;
    const idx = tabs.findIndex(t => t.id === selectedId);
    switch (e.key) {
    case '{':
      if (idx > 0) selectTab(tabs[idx - 1].id);
      break;
    case '}':
      if (idx !== -1 && idx + 1 < tabs.length) selectTab(tabs[idx + 1].id);
      break;
    case '_':
      if (tabs.length > 1) removeTab(selectedId);
      break;
    case '+':
      addTab(true);
      break;
    }
  });

  if (vm.editingTarget) vm.emitWorkspaceUpdate();
}