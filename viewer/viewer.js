// Renders a SpecGuard JSON report. No build step and no dependencies: open
// index.html directly or serve the folder. Reports never leave the browser.

const SEVERITIES = ["breaking", "risky", "compatible", "info"];
const $ = (id) => document.getElementById(id);

let current = null;
const hidden = new Set();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
}

function load(report, label) {
  if (!report || report.schema !== 1 || !Array.isArray(report.changes)) {
    showError(`${label}: not a SpecGuard report`);
    return;
  }
  current = report;
  $("error").hidden = true;
  $("empty").hidden = true;
  $("report").hidden = false;
  document.title = `${report.verdict} · ${report.new.source} · SpecGuard`;
  render();
}

function render() {
  const r = current;

  const verdict = $("verdict");
  verdict.className = `verdict sev-${r.verdict}`;
  verdict.textContent = r.verdict;

  $("counts").replaceChildren(
    ...SEVERITIES.map((s) => el("span", { class: r.summary[s] ? `sev-${s}` : "dim" }, `${r.summary[s]} ${s}`)),
  );

  $("old-source").textContent = r.old.source;
  $("old-hash").textContent = r.old.wasmHash;
  $("new-source").textContent = r.new.source;
  $("new-hash").textContent = r.new.wasmHash;

  $("filters").replaceChildren(
    ...SEVERITIES.filter((s) => r.summary[s] > 0).map((s) => {
      const box = el("input", { type: "checkbox" });
      box.checked = !hidden.has(s);
      box.addEventListener("change", () => {
        box.checked ? hidden.delete(s) : hidden.add(s);
        render();
      });
      return el("label", { class: `sev-${s}` }, box, s);
    }),
  );

  const rows = r.changes
    .filter((c) => !hidden.has(c.severity))
    .map((c) =>
      el("tr", {},
        el("td", {}, el("span", { class: `sev sev-${c.severity}` }, c.severity)),
        el("td", { class: "where" }, c.path),
        el("td", {}, c.message),
        el("td", { class: "detail" }, ...detail(c)),
      ),
    );
  $("rows").replaceChildren(...rows);
  $("none").hidden = r.changes.length > 0;
}

function detail(c) {
  const out = [];
  if (c.before !== undefined && c.after !== undefined) {
    out.push(el("div", {}, c.before, el("span", { class: "arrow" }, "→"), c.after));
  } else if (c.before !== undefined) {
    out.push(el("div", {}, `was ${c.before}`));
  } else if (c.after !== undefined) {
    out.push(el("div", {}, `+ ${c.after}`));
  }
  if (c.usedBy?.length) out.push(el("div", {}, `used by ${c.usedBy.join(", ")}`));
  return out;
}

async function readFile(file) {
  try {
    load(JSON.parse(await file.text()), file.name);
  } catch {
    showError(`${file.name}: could not read JSON`);
  }
}

for (const id of ["file", "file2"]) {
  $(id).addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  });
}

let depth = 0;
window.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; $("drop").hidden = false; });
window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; $("drop").hidden = true; } });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  depth = 0;
  $("drop").hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file) readFile(file);
});

const param = new URLSearchParams(location.search).get("report");
if (param) {
  fetch(param)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((json) => load(json, param))
    .catch((err) => showError(`${param}: ${err.message}`));
}
