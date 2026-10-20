"use strict";
const $ = (id) => document.getElementById(id),
  clone = (x) => structuredClone(x),
  NS = "http://www.w3.org/2000/svg";
let doc = null,
  analysis = null,
  id = null,
  revision = 0,
  dirty = false,
  busy = false,
  undo = [],
  redo = [],
  selected = new Set(),
  query = "",
  filter = "all",
  pageNumber = 0,
  zoom = 1,
  month = "2026-10",
  editCallback = null;
const KIND = "roomweave",
  KEY = "objects";
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function button(text, fn, cls) {
  const b = node("button", text, cls);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function svg(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text !== undefined) n.textContent = text;
  return n;
}
function say(text) {
  $("status").textContent = text;
  $("status").hidden = !text;
}
function fail(error) {
  for (const key of ["error", "dialog-error"]) {
    $(key).textContent = error.message || String(error);
    $(key).hidden = false;
  }
}
function controls() {
  document
    .querySelectorAll("button,input,select,textarea")
    .forEach((e) => (e.disabled = busy));
  $("undo").disabled = busy || !undo.length;
  $("redo").disabled = busy || !redo.length;
  $("save").disabled = busy || !doc;
}
async function api(path, data) {
  const r = await fetch(
    "/api/" + path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "Workspace",
          },
          body: JSON.stringify(data),
        },
  );
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "Request failed.");
  return value;
}
async function task(message, fn) {
  if (busy) return;
  busy = true;
  controls();
  $("error").hidden = true;
  $("dialog-error").hidden = true;
  say(message);
  try {
    await fn();
  } catch (e) {
    fail(e);
    say("");
  } finally {
    busy = false;
    controls();
  }
}
async function change(next, message = "Changes applied. Save when ready.") {
  const checked = await api("validate", next);
  undo.push(clone(doc));
  undo = undo.slice(-50);
  redo = [];
  doc = checked.document;
  analysis = checked.analysis;
  dirty = true;
  selected = new Set(
    [...selected].filter((k) => doc[KEY].some((x) => x.id === k)),
  );
  render();
  say(message);
}
function render() {
  const active = document.activeElement?.id;
  $("document-title").textContent = doc.title;
  $("revision").textContent = dirty
    ? "Unsaved changes"
    : `Saved revision ${revision}`;
  $("metrics").replaceChildren();
  Object.entries(analysis.metrics).forEach(([label, value]) => {
    const n = node("div", undefined, "metric");
    n.append(node("strong", String(value)), node("span", label));
    $("metrics").append(n);
  });
  renderWorkspace();
  controls();
  if (active && $(active)) $(active).focus({ preventScroll: true });
}
function field(label, key, value, type = "text", options) {
  const wrap = node("label", label);
  const input = node(
    options ? "select" : type === "textarea" ? "textarea" : "input",
  );
  input.id = "field-" + key;
  input.name = key;
  if (!options && type !== "textarea") input.type = type;
  if (options) options.forEach((o) => input.add(new Option(o, o)));
  if (type === "checkbox") input.checked = value;
  else input.value = value;
  wrap.append(input);
  if (type === "textarea") wrap.className = "wide";
  $("fields").append(wrap);
  return input;
}
function dialog(title, fields, callback) {
  $("editor-title").textContent = title;
  $("fields").replaceChildren();
  $("dialog-error").hidden = true;
  fields.forEach((f) => field(...f));
  editCallback = () => {
    const values = {};
    fields.forEach(([, key, , type]) => {
      const e = $("field-" + key);
      values[key] =
        type === "number"
          ? Number(e.value)
          : type === "checkbox"
            ? e.checked
            : e.value;
    });
    return callback(values);
  };
  $("editor").showModal();
  $("fields").querySelector("input,select,textarea")?.focus();
}
$("cancel").onclick = () => $("editor").close();
$("editor-form").onsubmit = (e) => {
  e.preventDefault();
  task("Validating edits…", async () => {
    await editCallback();
    $("editor").close();
  });
};
function editEntry(entry) {
  const original = entry ? clone(entry) : newEntry();
  dialog(
    entry ? "Edit entry" : "Add entry",
    entryFields(original),
    async (values) => {
      const next = clone(doc);
      const result = normalizeEntry({ ...original, ...values });
      if (entry)
        next[KEY] = next[KEY].map((x) => (x.id === entry.id ? result : x));
      else next[KEY].push(result);
      selected = new Set([result.id]);
      await change(next);
    },
  );
}
function removeEntry(key) {
  if (
    !confirm(
      "Remove this entry? Undo remains available until you open another document.",
    )
  )
    return;
  task("Checking removal…", () =>
    change({ ...doc, [KEY]: doc[KEY].filter((x) => x.id !== key) }),
  );
}
function selectField(label, options, value, callback) {
  const l = node("label", label),
    s = node("select");
  s.id = "tool-" + label.toLowerCase().replaceAll(" ", "-");
  for (const [v, t] of options) s.add(new Option(t, v));
  s.value = value;
  s.onchange = () => callback(s.value);
  l.append(s);
  return l;
}
function setupTools() {
  const tools = $("tools");
  tools.replaceChildren();
  const l = node("label", "Search entries"),
    input = node("input");
  input.type = "search";
  input.id = "search";
  input.oninput = () => {
    query = input.value.toLowerCase();
    pageNumber = 0;
    renderWorkspace();
    controls();
  };
  l.append(input);
  tools.append(l);
  domainTools(tools);
}
function download(name, data, type) {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = node("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function library() {
  const rows = await api("documents");
  $("library").replaceChildren(new Option("Select a document", ""));
  rows.forEach((x) =>
    $("library").add(new Option(`${x.title} · v${x.revision}`, x.id)),
  );
  $("library").value = id || "";
}
async function load(document, key = null, rev = 0) {
  const checked = await api("validate", document);
  doc = checked.document;
  analysis = checked.analysis;
  id = key;
  revision = rev;
  dirty = !key;
  undo = [];
  redo = [];
  selected.clear();
  query = "";
  filter = "all";
  pageNumber = 0;
  zoom = 1;
  setupTools();
  render();
}
$("new").onclick = () => {
  if (dirty && !confirm("Discard unsaved changes and load the sample?")) return;
  task("Loading sample…", async () => {
    await load(await api("sample"));
    say("Fictional sample ready.");
  });
};
$("save").onclick = () =>
  task("Saving document…", async () => {
    const r = await api("save", { id, revision, document: doc });
    id = r.id;
    revision = r.revision;
    dirty = false;
    await library();
    render();
    say(`Saved revision ${revision} locally.`);
  });
$("open").onclick = () => {
  const key = $("library").value;
  if (!key) return;
  if (dirty && !confirm("Discard unsaved changes and open the saved document?"))
    return;
  task("Opening document…", async () => {
    const r = await api("documents/" + key);
    await load(r.document, r.id, r.revision);
    say("Saved document opened.");
  });
};
$("undo").onclick = () =>
  task("Restoring previous state…", async () => {
    if (!undo.length) return;
    const next = undo.at(-1),
      checked = await api("validate", next);
    undo.pop();
    redo.push(clone(doc));
    doc = checked.document;
    analysis = checked.analysis;
    dirty = true;
    selected = new Set(
      [...selected].filter((k) => doc[KEY].some((x) => x.id === k)),
    );
    render();
    say("Change undone.");
  });
$("redo").onclick = () =>
  task("Reapplying change…", async () => {
    if (!redo.length) return;
    const next = redo.at(-1),
      checked = await api("validate", next);
    redo.pop();
    undo.push(clone(doc));
    doc = checked.document;
    analysis = checked.analysis;
    dirty = true;
    render();
    say("Change reapplied.");
  });
$("add").onclick = () => editEntry();
$("settings").onclick = () =>
  dialog("Document settings", settingsFields(), (values) =>
    change({ ...doc, ...values }),
  );
$("export").onclick = () =>
  task("Validating export…", async () => {
    const checked = await api("validate", doc);
    download(
      KIND + ".json",
      JSON.stringify(checked.document, null, 2) + "\n",
      "application/json",
    );
    say("Validated document exported.");
  });
$("import").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (dirty && !confirm("Replace unsaved changes with this import?")) {
    e.target.value = "";
    return;
  }
  task("Validating import…", async () => {
    try {
      if (file.size > 256000) throw Error("Imports are limited to 256 KB.");
      await load(JSON.parse(await file.text()));
      say("Document imported. Save to add it to the library.");
    } finally {
      e.target.value = "";
    }
  });
};
$("print").onclick = () => window.print();
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function normalizeEntry(x) {
  return x;
}
function unique() {
  return "entry-" + crypto.randomUUID().slice(0, 12);
}
function settingsFields() {
  return [
    ["Document title", "title", doc.title],
    ["Width · mm", "width", doc.width, "number"],
    ["Height · mm", "height", doc.height, "number"],
  ];
}
function domainTools(tools) {
  tools.append(
    selectField(
      "Zoom",
      [
        ["1", "Fit"],
        ["2", "200%"],
        ["3", "300%"],
      ],
      String(zoom),
      (v) => {
        zoom = Number(v);
        renderWorkspace();
        controls();
      },
    ),
  );
  $("visual-export").hidden = false;
}
function spatialFields(x) {
  return [
    ["Name", "name", x.name],
    ["X · mm", "x", x.x, "number"],
    ["Y · mm", "y", x.y, "number"],
    ["Width · mm", "width", x.width, "number"],
    ["Height · mm", "height", x.height, "number"],
  ];
}
function moveObject(key, x, y) {
  if (busy) return;
  const original = doc[KEY].find((o) => o.id === key);
  if (original?.locked) {
    say("Unlock the layer in its editor before moving it.");
    renderWorkspace();
    return;
  }
  task("Checking position…", async () => {
    try {
      await change({
        ...doc,
        [KEY]: doc[KEY].map((o) =>
          o.id === key ? { ...o, x: Math.round(x), y: Math.round(y) } : o,
        ),
      });
    } catch (e) {
      renderWorkspace();
      throw e;
    }
  });
}
function pick(key) {
  selected = new Set([key]);
  renderInspector();
}
function renderInspector() {
  const aside = $("inspector");
  if (!aside) return;
  aside.replaceChildren(
    node("h2", KIND === "pageloom" ? "Layers · back to front" : "Objects"),
  );
  for (const o of doc[KEY].filter((o) =>
    o.name.toLowerCase().includes(query),
  )) {
    const row = node("div", undefined, "layer"),
      choose = button(
        o.name + (o.locked ? " · locked" : ""),
        () => {
          pick(o.id);
          $("shape-" + o.id)?.focus({ preventScroll: true });
        },
        selected.has(o.id) ? "selected" : "",
      );
    choose.id = "select-" + o.id;
    row.append(choose);
    aside.append(row);
  }
  const item = doc[KEY].find((o) => selected.has(o.id));
  if (item) {
    const panel = node("div", undefined, "stack");
    panel.append(
      node("h3", item.name),
      node(
        "p",
        `${item.x}, ${item.y} mm · ${item.width} × ${item.height} mm`,
        "muted",
      ),
      button("Edit selected", () => editEntry(item)),
      button("Remove selected", () => removeEntry(item.id)),
    );
    if (KIND === "pageloom")
      for (const [label, delta] of [
        ["Send backward", -1],
        ["Bring forward", 1],
      ])
        panel.append(
          button(label, () =>
            task("Changing layer order…", () => {
              const next = clone(doc),
                i = next.elements.findIndex((x) => x.id === item.id),
                j = Math.max(0, Math.min(next.elements.length - 1, i + delta));
              [next.elements[i], next.elements[j]] = [
                next.elements[j],
                next.elements[i],
              ];
              return change(next);
            }),
          ),
        );
    aside.append(node("hr"), panel);
  } else
    aside.append(
      node(
        "p",
        "Select a shape or an entry in the list. Arrow keys nudge a focused shape; drag to reposition.",
        "muted",
      ),
    );
}
function renderWorkspace() {
  const root = $("workspace");
  root.replaceChildren();
  const card = node("section", undefined, "card"),
    split = node("div", undefined, "split"),
    canvas = node("div", undefined, "canvas zoom-" + zoom),
    inspector = node("section");
  canvas.id = "canvas";
  inspector.id = "inspector";
  const drawing = svg("svg", {
    viewBox: `0 0 ${doc.width} ${doc.height}`,
    width: doc.width + "mm",
    height: doc.height + "mm",
    role: "group",
    "aria-label": "Measured composition",
    "font-family": "system-ui, sans-serif",
  });
  drawing.id = "drawing";
  drawing.append(
    svg("rect", {
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      fill: "#ffffff",
      stroke: "#9aafb9",
      "stroke-width": KIND === "roomweave" ? 15 : 1,
    }),
  );
  const defs = svg("defs", {});
  drawing.append(defs);
  for (const o of doc[KEY]) {
    const g = svg("g", {
      id: "shape-" + o.id,
      transform: `translate(${o.x} ${o.y})`,
      tabindex: 0,
      role: "button",
      "aria-label": o.name + ", " + o.x + ", " + o.y + " millimetres",
      class: "object",
    });
    drawShape(g, o, defs);
    g.onclick = () => pick(o.id);
    g.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = (KIND === "roomweave" ? 10 : 1) * (e.shiftKey ? 10 : 1);
        moveObject(
          o.id,
          o.x +
            (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
          o.y +
            (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
        );
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pick(o.id);
        editEntry(o);
      }
    };
    g.onpointerdown = (e) => {
      if (busy || e.button !== 0) return;
      pick(o.id);
      g.focus({ preventScroll: true });
      if (o.locked) {
        say("This layer is locked. Edit it to unlock.");
        return;
      }
      e.preventDefault();
      const matrix = drawing.getScreenCTM().inverse();
      const start = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
      let target = { x: o.x, y: o.y };
      g.setPointerCapture(e.pointerId);
      g.onpointermove = (event) => {
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix,
        );
        target = {
          x: Math.round(o.x + p.x - start.x),
          y: Math.round(o.y + p.y - start.y),
        };
        g.setAttribute("transform", `translate(${target.x} ${target.y})`);
      };
      const clean = () => {
        g.onpointermove = null;
        g.onpointerup = null;
        g.onpointercancel = null;
      };
      g.onpointerup = () => {
        clean();
        if (target.x !== o.x || target.y !== o.y)
          moveObject(o.id, target.x, target.y);
      };
      g.onpointercancel = () => {
        clean();
        renderWorkspace();
      };
    };
    drawing.append(g);
  }
  canvas.append(drawing);
  split.append(canvas, inspector);
  card.append(
    split,
    node(
      "p",
      "Drag to move. Arrow keys nudge; Shift increases the step. Enter opens the editor. Out-of-bounds edits are rejected.",
      "muted",
    ),
  );
  root.append(card);
  renderInspector();
  const messages = domainNotices();
  if (messages.length) {
    const notices = node("section", undefined, "card");
    notices.append(node("h2", "Review notices"));
    messages.forEach((t) => notices.append(node("p", t, "notice")));
    root.append(notices);
  }
}
$("visual-export").onclick = () =>
  task("Validating artwork…", async () => {
    await api("validate", doc);
    const drawing = $("drawing").cloneNode(true);
    drawing.querySelectorAll("[tabindex]").forEach((n) => {
      n.removeAttribute("tabindex");
      n.removeAttribute("role");
      n.removeAttribute("class");
    });
    drawing.setAttribute("xmlns", NS);
    download(
      KIND + ".svg",
      new XMLSerializer().serializeToString(drawing),
      "image/svg+xml",
    );
    say("Measured SVG exported. Verify print scaling independently.");
  });
function newEntry() {
  return {
    id: unique(),
    name: "New object",
    x: 100,
    y: 100,
    width: 600,
    height: 500,
    clearance: 100,
    kind: "storage",
  };
}
function entryFields(x) {
  return [
    ...spatialFields(x),
    ["Clearance · mm", "clearance", x.clearance, "number"],
    ["Kind", "kind", x.kind, "text", ["work", "storage", "seating"]],
  ];
}
function drawShape(g, o) {
  const colors = { work: "#bfd8d0", storage: "#d4c8e3", seating: "#efd7b1" };
  g.append(
    svg("rect", {
      width: o.width,
      height: o.height,
      fill: colors[o.kind],
      stroke: "#55716b",
      "stroke-width": 12,
    }),
    svg(
      "text",
      {
        x: o.width / 2,
        y: o.height / 2,
        "text-anchor": "middle",
        "font-size": Math.min(100, o.width / (o.name.length * 0.6)),
        fill: "#233b35",
      },
      o.name,
    ),
    svg(
      "text",
      {
        x: o.width / 2,
        y: o.height / 2 + 130,
        "text-anchor": "middle",
        "font-size": 65,
        fill: "#233b35",
      },
      `${o.width} × ${o.height}`,
    ),
  );
}
function domainNotices() {
  const name = (k) => doc.objects.find((x) => x.id === k).name;
  return [
    ...analysis.overlaps.map(([a, b]) => `${name(a)} overlaps ${name(b)}.`),
    ...analysis.clearance.map(
      ([a, b]) =>
        `${name(a)} and ${name(b)} have less than their requested clearance.`,
    ),
    ...analysis.walls.map(
      (k) => `${name(k)} is within its requested wall clearance.`,
    ),
  ];
}

task("Preparing workspace…", async () => {
  await load(await api("sample"));
  await library();
  say("Fictional sample loaded. Changes stay local.");
});
