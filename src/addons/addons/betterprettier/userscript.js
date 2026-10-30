export default async function ({ addon, console }) {
  // ---------------------------------------------------------------------------
  // Arrange blocks (improved)
  // Right click the code area -> "Arrange blocks".
  // How to arrange (mode, order, spacing...) is set in the addon options (manifest).
  // All moves go into a single undo group: one Ctrl+Z reverts everything.
  // ---------------------------------------------------------------------------

  const HAT_PAD = 18; // hat blocks draw their "cap" above the block position
  const CATEGORY_ORDER = [
    "events",
    "control",
    "motion",
    "looks",
    "sound",
    "sensing",
    "operators",
    "data",
    "data-lists",
    "more",
    "pen",
    "music",
    "videoSensing",
    "text2speech",
    "translate",
  ];

  const MODE_NAMES = {
    column: "Column",
    row: "Row",
    grid: "Grid",
    mosaic: "Mosaic",
    category: "By category",
    scripts: "Scripts and loose",
  };

  // ----- settings (read on every click, so changing an option takes effect immediately) -----
  // addon.settings.get throws when an option does not exist in the loaded manifest,
  // so every read falls back to a default and the menu item always shows up.
  function getSetting(id, fallback) {
    try {
      const value = addon.settings.get(id);
      return value === undefined || value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function readSettings() {
    const num = (id, fallback, min, max) => {
      const v = Number(getSetting(id, fallback));
      if (!Number.isFinite(v)) return fallback;
      return Math.min(max, Math.max(min, v));
    };
    const mode = String(getSetting("mode", "column"));
    return {
      mode: MODE_NAMES[mode] ? mode : "column",
      order: String(getSetting("order", "position")),
      gap: num("spacing", 24, 0, 200),
      columns: Math.round(num("columns", 0, 0, 30)),
      categoryHeight: num("categoryHeight", 2000, 300, 20000),
      origin: String(getSetting("origin", "current")),
      center: getSetting("center", true) !== false,
    };
  }

  // ----- collect the top blocks (scripts) -----
  function blockText(block) {
    try {
      return String(block.toString?.(100) ?? block.type ?? "").trim();
    } catch (e) {
      return String(block.type || "");
    }
  }

  function collectItems(workspace) {
    return workspace.getTopBlocks(false).map((block) => {
      const size = block.getHeightWidth();
      const xy = block.getRelativeToSurfaceXY();
      const shapes = block.svgGroup_?.getAttribute?.("data-shapes") || "";
      const hatPad = shapes.includes("hat") ? HAT_PAD : 0;
      return {
        block,
        w: size.width,
        h: size.height + hatPad,
        x0: xy.x,
        y0: xy.y,
        hatPad,
        isHat: !block.previousConnection && !block.outputConnection,
        category: block.getCategory?.() ?? block.category_ ?? "other",
        text: blockText(block),
      };
    });
  }

  // ----- ordering -----
  const byReading = (a, b) => a.y0 - b.y0 || a.x0 - b.x0;
  const byLeftToRight = (a, b) => a.x0 - b.x0 || a.y0 - b.y0;

  function makeComparator(order, mode) {
    const position = mode === "row" ? byLeftToRight : byReading;
    switch (order) {
      case "alpha":
        return (a, b) =>
          a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" }) || position(a, b);
      case "size-desc":
        return (a, b) => b.h - a.h || b.w - a.w || position(a, b);
      case "size-asc":
        return (a, b) => a.h - b.h || a.w - b.w || position(a, b);
      default:
        return position;
    }
  }

  // ----- layouts -----
  // Each layout receives the items ALREADY sorted and returns { list: [{ item, x, y }], width, height },
  // with x/y relative to the top-left corner of the result.
  function layoutColumn(sorted, gap) {
    const list = [];
    let y = 0;
    let width = 0;
    for (const item of sorted) {
      list.push({ item, x: 0, y });
      y += item.h + gap;
      width = Math.max(width, item.w);
    }
    return { list, width, height: Math.max(0, y - gap) };
  }

  function layoutRow(sorted, gap) {
    const list = [];
    let x = 0;
    let height = 0;
    for (const item of sorted) {
      list.push({ item, x, y: 0 });
      x += item.w + gap;
      height = Math.max(height, item.h);
    }
    return { list, width: Math.max(0, x - gap), height };
  }

  function layoutGrid(sorted, gap, colsOpt) {
    const n = sorted.length;
    if (!n) return { list: [], width: 0, height: 0 };
    const cols = Math.min(n, colsOpt > 0 ? colsOpt : Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const colW = new Array(cols).fill(0);
    const rowH = new Array(rows).fill(0);
    sorted.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      colW[c] = Math.max(colW[c], item.w);
      rowH[r] = Math.max(rowH[r], item.h);
    });
    const colX = [];
    const rowY = [];
    let acc = 0;
    for (const w of colW) {
      colX.push(acc);
      acc += w + gap;
    }
    const width = Math.max(0, acc - gap);
    acc = 0;
    for (const h of rowH) {
      rowY.push(acc);
      acc += h + gap;
    }
    const height = Math.max(0, acc - gap);
    const list = sorted.map((item, i) => ({ item, x: colX[i % cols], y: rowY[Math.floor(i / cols)] }));
    return { list, width, height };
  }

  function layoutMosaic(sorted, gap, colsOpt) {
    const n = sorted.length;
    if (!n) return { list: [], width: 0, height: 0 };
    const cols = Math.max(1, Math.min(n, colsOpt > 0 ? colsOpt : Math.ceil(Math.sqrt(n))));
    const heights = new Array(cols).fill(0);
    const buckets = Array.from({ length: cols }, () => []);
    for (const item of sorted) {
      let c = 0;
      for (let i = 1; i < cols; i++) if (heights[i] < heights[c]) c = i;
      buckets[c].push({ item, y: heights[c] });
      heights[c] += item.h + gap;
    }
    const list = [];
    let x = 0;
    for (const bucket of buckets) {
      if (!bucket.length) continue;
      const colW = Math.max(...bucket.map((b) => b.item.w));
      for (const b of bucket) list.push({ item: b.item, x, y: b.y });
      x += colW + gap;
    }
    return { list, width: Math.max(0, x - gap), height: Math.max(0, Math.max(...heights) - gap) };
  }

  function layoutCategory(sorted, gap, maxColumnHeight) {
    const groups = new Map();
    for (const item of sorted) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    const rank = (key) => {
      const idx = CATEGORY_ORDER.indexOf(key);
      return idx < 0 ? 999 : idx;
    };
    const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
    const list = [];
    let x = 0;
    let height = 0;
    for (const key of keys) {
      // hat scripts first; inside each kind the chosen order is kept (Array.sort is stable)
      const group = groups.get(key).sort((a, b) => Number(b.isHat) - Number(a.isHat));
      let col = [];
      let y = 0;
      const flush = () => {
        if (!col.length) return;
        const w = Math.max(...col.map((c) => c.item.w));
        for (const c of col) list.push({ item: c.item, x, y: c.y });
        height = Math.max(height, y - gap);
        x += w + gap;
        col = [];
        y = 0;
      };
      for (const item of group) {
        if (col.length && y + item.h > maxColumnHeight) flush();
        col.push({ item, y });
        y += item.h + gap;
      }
      flush();
      x += gap; // extra separation between categories
    }
    return { list, width: Math.max(0, x - gap * 2), height: Math.max(0, height) };
  }

  function layoutScripts(sorted, gap, colsOpt) {
    const scripts = sorted.filter((i) => i.isHat);
    const loose = sorted.filter((i) => !i.isHat);
    const a = layoutMosaic(scripts, gap, colsOpt);
    const b = layoutMosaic(loose, gap, colsOpt);
    const offset = scripts.length && loose.length ? a.width + gap * 3 : 0;
    return {
      list: [...a.list, ...b.list.map((e) => ({ ...e, x: e.x + offset }))],
      width: offset + b.width,
      height: Math.max(a.height, b.height),
    };
  }

  function computeLayout(items, s) {
    const sorted = [...items].sort(makeComparator(s.order, s.mode));
    switch (s.mode) {
      case "row":
        return layoutRow(sorted, s.gap);
      case "grid":
        return layoutGrid(sorted, s.gap, s.columns);
      case "mosaic":
        return layoutMosaic(sorted, s.gap, s.columns);
      case "category":
        return layoutCategory(sorted, s.gap, s.categoryHeight);
      case "scripts":
        return layoutScripts(sorted, s.gap, s.columns);
      default:
        return layoutColumn(sorted, s.gap);
    }
  }

  // ----- apply -----
  // The Blockly instance used by Scratch (documented API: addon.tab.traps.getBlockly()).
  // It is requested at startup and cached so the menu can use it synchronously.
  let cachedBlockly = null;
  try {
    addon.tab.traps
      .getBlockly()
      .then((b) => {
        cachedBlockly = b;
      })
      .catch(() => {});
  } catch (e) {
    // ignore: arrangeBlocks asks again when needed
  }

  async function getBlockly() {
    if (cachedBlockly) return cachedBlockly;
    try {
      cachedBlockly = await Promise.race([
        addon.tab.traps.getBlockly(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
    } catch (e) {
      cachedBlockly = null;
    }
    return cachedBlockly;
  }

  // traps.getWorkspace() is not available everywhere (it is not part of the documented traps),
  // so try it first and fall back to the main workspace of the Blockly instance.
  function findWorkspace(Blockly) {
    const attempts = [
      () => addon.tab.traps.getWorkspace?.(),
      () => addon.tab.traps.onceValues?.workspace,
      () => Blockly?.getMainWorkspace?.(),
      () => Blockly?.mainWorkspace,
    ];
    for (const attempt of attempts) {
      try {
        const ws = attempt();
        if (ws && typeof ws.getTopBlocks === "function") return ws;
      } catch (e) {
        // try the next one
      }
    }
    return null;
  }

  async function arrangeBlocks() {
    try {
      const Blockly = await getBlockly();
      const workspace = findWorkspace(Blockly);
      if (!workspace) {
        console.error("Arrange blocks: could not find the Blockly workspace (getWorkspace/getMainWorkspace failed).");
        return;
      }
      const settings = readSettings();
      const items = collectItems(workspace);
      if (!items.length) return;

      const layout = computeLayout(items, settings);

      let ox = 0;
      let oy = 0;
      if (settings.origin !== "corner") {
        // keep the result near where the blocks already were
        ox = Math.min(...items.map((i) => i.x0));
        oy = Math.min(...items.map((i) => i.y0 - i.hatPad));
      }

      const events = Blockly?.Events;
      events?.setGroup?.(true); // a single "undo" step
      try {
        for (const { item, x, y } of layout.list) {
          const cur = item.block.getRelativeToSurfaceXY();
          item.block.moveBy(ox + x - cur.x, oy + y + item.hatPad - cur.y);
        }
      } finally {
        events?.setGroup?.(false);
      }

      workspace.resizeContents?.();
      if (settings.center) {
        try {
          workspace.scrollCenter?.();
        } catch (e) {
          // scrolling is just an extra; ignore failures
        }
      }
    } catch (e) {
      console.error("Arrange blocks: failed to arrange", e);
    }
  }

  // ----- code area context menu -----
  addon.tab.createBlockContextMenu(
    (items) => {
      if (addon.self.disabled) return items;

      let hasBlocks = true;
      try {
        const ws = findWorkspace(cachedBlockly);
        if (ws) {
          hasBlocks = ws.getTopBlocks(false).length > 0;
        } else {
          // same DOM check the original addon used
          const canvas = document.querySelector("svg.blocklySvg g.blocklyBlockCanvas");
          if (canvas) hasBlocks = canvas.childNodes.length > 0;
        }
      } catch (e) {
        // if the check fails, keep the item enabled
      }

      // if the devtools "paste" item exists, go before it; otherwise at the end
      const pasteItemIndex = items.findIndex((obj) => obj._isDevtoolsFirstItem);
      const insertBeforeIndex = pasteItemIndex !== -1 ? pasteItemIndex : items.length;

      const modeName = MODE_NAMES[String(getSetting("mode", "column"))] || MODE_NAMES.column;
      items.splice(insertBeforeIndex, 0, {
        enabled: hasBlocks,
        text: `Arrange blocks (${modeName})`,
        callback: () => arrangeBlocks(),
        separator: true,
      });

      return items;
    },
    { workspace: true }
  );
}