// Tasks window. Runs a web errand through the Rust agent (agent.rs) and shows
// its progress. Settings (provider, model, history) share the overlay's
// localStorage via preferences.js; API keys go to Credential Manager only.
import { readSettings, writeSettings, AGENT_PROVIDERS } from "./preferences.js";

const { invoke } = window.__TAURI__.core;
const { listen, emit } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
let settings = readSettings();
let providers = [];
let current = null; // { id, task, provider, model, startedAt }

const LABEL = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Google Gemini",
  ollama: "Ollama (local)",
  custom: "Custom OpenAI-compatible",
};
const KEY_HINT = {
  claude: "console.anthropic.com → API keys",
  openai: "platform.openai.com → API keys",
  groq: "console.groq.com → API keys",
  gemini: "aistudio.google.com → Get API key",
};
const EXAMPLES = [
  "Find three well-reviewed veg restaurants near me that deliver right now, with links.",
  "What's the cheapest direct flight Chennai → Bengaluru next Friday morning? Give the booking link.",
  "Compare the latest Pixel and iPhone base models: price in India, battery, camera. Cite sources.",
  "Summarise today's top three tech headlines with links.",
  "Find a 3-star hotel near Marina Beach, Chennai, under ₹4 000 a night for next weekend.",
];

function save(patch) {
  settings = writeSettings(patch);
  emit("pet://settings", patch).catch(() => {});
}

// --- tabs --------------------------------------------------------------------

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}
function showTab(name) {
  for (const tab of document.querySelectorAll('[role="tab"]')) tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== name;
  if (name === "history") renderHistory();
  if (name === "providers") renderKeys();
}

// --- providers & models ---------------------------------------------------------

async function loadProviders() {
  try {
    providers = await invoke("agent_providers");
  } catch {
    providers = AGENT_PROVIDERS.map((id) => ({ id, needs_key: id !== "ollama" && id !== "custom", base_url: "", default_model: "", has_key: false }));
  }
  const sel = $("provider");
  sel.innerHTML = "";
  for (const p of providers) sel.add(new Option(LABEL[p.id] ?? p.id, p.id));
  sel.value = settings.agent.provider;
  onProviderChange(false);
}

function providerInfo(id = $("provider").value) {
  return providers.find((p) => p.id === id) ?? { id, needs_key: true, default_model: "", has_key: false };
}

function onProviderChange(persist = true) {
  const id = $("provider").value;
  const p = providerInfo(id);
  $("model").value = settings.agent.models[id] ?? p.default_model ?? "";
  $("model").placeholder = p.default_model || "model id";
  const hasKey = p.has_key || !p.needs_key;
  $("providerHint").textContent = !hasKey
    ? `No API key saved for ${LABEL[id]}. Add one under Providers & keys.`
    : id === "claude"
      ? "Claude searches and reads pages with Anthropic's own web tools."
      : id === "ollama" || id === "custom"
        ? "Local models: pick one that supports tool calling (e.g. llama3.1, qwen2.5) or it will answer from memory only."
        : "Uses the provider's OpenAI-compatible endpoint with PocketPet's search and page-reading tools.";
  if (persist) save({ agent: { provider: id } });
  $("modelList").innerHTML = "";
}

$("provider").addEventListener("input", () => onProviderChange(true));
$("model").addEventListener("change", () => save({ agent: { models: { [$("provider").value]: $("model").value.trim() } } }));

$("refreshModels").addEventListener("click", async () => {
  const id = $("provider").value;
  $("status").textContent = "Fetching models…";
  try {
    const ids = await invoke("agent_models", { provider: id, baseUrl: settings.agent.baseUrls[id] ?? "" });
    const list = $("modelList");
    list.innerHTML = "";
    for (const m of ids) list.append(new Option(m));
    $("status").textContent = `${ids.length} models — start typing to pick.`;
    if (!$("model").value && ids[0]) $("model").value = ids[0];
  } catch (err) {
    $("status").textContent = `Couldn't list models: ${err}`;
  }
});

// --- keys --------------------------------------------------------------------------

function renderKeys() {
  const list = $("keys");
  list.innerHTML = "";
  for (const p of providers.filter((p) => p.needs_key)) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = LABEL[p.id] ?? p.id;
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = p.has_key ? "•••••••• (saved) — paste a new key to replace" : "Paste API key";
    input.autocomplete = "off";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.disabled = !p.has_key;
    const state = document.createElement("span");
    state.className = `state ${p.has_key ? "ok" : ""}`;
    state.textContent = p.has_key ? "Key saved." : `No key. ${KEY_HINT[p.id] ?? ""}`;
    saveBtn.addEventListener("click", async () => {
      const key = input.value.trim();
      if (!key) return;
      try {
        await invoke("agent_set_key", { provider: p.id, key });
        input.value = "";
        await loadProviders();
        renderKeys();
      } catch (err) {
        state.textContent = `Couldn't save: ${err}`;
      }
    });
    del.addEventListener("click", async () => {
      await invoke("agent_delete_key", { provider: p.id }).catch(() => {});
      await loadProviders();
      renderKeys();
    });
    li.append(name, input, saveBtn, del, state);
    list.append(li);
  }
  $("url_ollama").value = settings.agent.baseUrls.ollama ?? "";
  $("url_custom").value = settings.agent.baseUrls.custom ?? "";
  $("maxTurns").value = settings.agent.maxTurns;
  $("maxTurnsHint").textContent = String(settings.agent.maxTurns);
  $("narrate").checked = settings.agent.narrate;
}

for (const id of ["ollama", "custom"]) {
  $(`url_${id}`).addEventListener("change", () => save({ agent: { baseUrls: { [id]: $(`url_${id}`).value.trim() } } }));
}
$("maxTurns").addEventListener("input", () => {
  $("maxTurnsHint").textContent = $("maxTurns").value;
  save({ agent: { maxTurns: Number($("maxTurns").value) } });
});
$("narrate").addEventListener("input", () => save({ agent: { narrate: $("narrate").checked } }));

// --- running a task ------------------------------------------------------------------

function logLine(kind, text) {
  const log = $("log");
  log.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.className = kind;
  const icon = { start: "▶", tool: "🔎", result: "↳", note: "💬", answer: "✅", error: "⚠", cancelled: "⏹" }[kind] ?? "•";
  const i = document.createElement("span");
  i.textContent = icon;
  const t = document.createElement("span");
  t.textContent = text;
  li.append(i, t);
  log.append(li);
  log.scrollTop = log.scrollHeight;
}

function setRunning(on) {
  $("run").disabled = on;
  $("cancel").disabled = !on;
  $("task").disabled = on;
  $("provider").disabled = on;
}

$("run").addEventListener("click", startTask);
$("task").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) startTask();
});

async function startTask() {
  const task = $("task").value.trim();
  if (!task || current) return;
  const provider = $("provider").value;
  const model = $("model").value.trim();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  current = { id, task, provider, model, startedAt: Date.now() };
  $("log").innerHTML = "";
  $("answerCard").hidden = true;
  $("status").textContent = "Working…";
  setRunning(true);
  const petName = settings.petNames[settings.pet] || "";
  try {
    await invoke("agent_run", {
      req: { id, task, provider, model, baseUrl: settings.agent.baseUrls[provider] ?? "", petName, maxTurns: settings.agent.maxTurns },
    });
  } catch (err) {
    finish("error", String(err));
  }
}

$("cancel").addEventListener("click", () => {
  if (current) invoke("agent_cancel", { id: current.id }).catch(() => {});
});

function finish(status, text) {
  if (!current) return;
  const done = { ...current, status, answer: text };
  current = null;
  setRunning(false);
  $("status").textContent = status === "done" ? `Done in ${Math.round((Date.now() - done.startedAt) / 1000)} s` : status === "cancelled" ? "Cancelled." : "Failed.";
  if (status === "done") {
    $("answerCard").hidden = false;
    renderAnswer(text);
  }
  logLine(status === "done" ? "answer" : status, status === "done" ? "Answer ready" : text);
  // History is written by the overlay (single writer avoids cross-window
  // localStorage races); it tells us via pet://settings when it has.
}

/** Plain text with clickable links; nothing else is interpreted. */
function renderAnswer(text) {
  const box = $("answer");
  box.innerHTML = "";
  const re = /https?:\/\/[^\s)\]>"']+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    box.append(document.createTextNode(text.slice(last, m.index)));
    const a = document.createElement("a");
    a.href = m[0];
    a.textContent = m[0];
    a.addEventListener("click", (e) => {
      e.preventDefault();
      invoke("open_external", { url: a.href }).catch(() => {});
    });
    box.append(a);
    last = m.index + m[0].length;
  }
  box.append(document.createTextNode(text.slice(last)));
}

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("answer").textContent);
    $("copy").textContent = "Copied";
    setTimeout(() => ($("copy").textContent = "Copy"), 1200);
  } catch {
    /* clipboard blocked */
  }
});

listen("pet://task", ({ payload }) => {
  if (!current || payload.id !== current.id) return;
  const { kind, text } = payload;
  if (kind === "answer") finish("done", text);
  else if (kind === "error") finish("error", text);
  else if (kind === "cancelled") finish("cancelled", text);
  else logLine(kind, text);
});

// --- history -------------------------------------------------------------------------

function renderHistory() {
  settings = readSettings();
  const list = $("history");
  list.innerHTML = "";
  const items = [...settings.tasks].reverse();
  if (!items.length) list.innerHTML = '<li class="hint">No tasks yet.</li>';
  for (const t of items) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.textContent = t.task;
    const meta = document.createElement("div");
    meta.className = `meta ${t.status === "error" ? "status-error" : ""}`;
    meta.textContent = `${new Date(t.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${t.provider}${t.model ? " · " + t.model : ""} · ${t.status}`;
    li.append(title, meta);
    li.addEventListener("click", () => {
      $("task").value = t.task;
      if (t.status === "done" && t.answer) {
        $("answerCard").hidden = false;
        renderAnswer(t.answer);
      }
      showTab("run");
    });
    list.append(li);
  }
}

$("clearHistory").addEventListener("click", () => {
  save({ tasks: [] });
  renderHistory();
});

// --- boot ------------------------------------------------------------------------------

for (const e of EXAMPLES) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = e.length > 60 ? e.slice(0, 58) + "…" : e;
  b.title = e;
  b.addEventListener("click", () => {
    $("task").value = e;
    $("task").focus();
  });
  $("examples").append(b);
}
$("log").innerHTML = '<li class="empty">Nothing running.</li>';
window.addEventListener("storage", () => {
  settings = readSettings();
});
listen("pet://settings", () => {
  settings = readSettings();
  if (!document.querySelector('[data-panel="history"]').hidden) renderHistory();
});
loadProviders();
