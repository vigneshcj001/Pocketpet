// Tasks window. Runs a web errand through the Rust agent (agent.rs) and shows
// its progress; pauses for approvals; holds memory, keys and limits. Settings
// (provider, model, history, spend) share the overlay's localStorage via
// preferences.js; API keys go to Credential Manager only.
import { readSettings, writeSettings, AGENT_PROVIDERS } from "./preferences.js";

const { invoke } = window.__TAURI__.core;
const { listen, emit } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
let settings = readSettings();
let providers = [];
let current = null; // { id, task, provider, model, startedAt, paused }

const LABEL = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  ollama: "Ollama (local)",
  custom: "Custom OpenAI-compatible",
};
const KEY_HINT = {
  claude: "console.anthropic.com → API keys",
  openai: "platform.openai.com → API keys",
  groq: "console.groq.com → API keys",
  gemini: "aistudio.google.com → Get API key",
  deepseek: "platform.deepseek.com → API keys",
};
const EXAMPLES = [
  "Find three well-reviewed veg restaurants near me that deliver right now, with links.",
  "Order a margherita pizza from Domino's to my usual address — stop before payment.",
  "Search MakeMyTrip for a 3-star hotel near Marina Beach, Chennai, next weekend, under ₹4 000 a night; show me the best two.",
  "Go to amazon.in, search for a 65 W USB-C charger under ₹1 500 with 4+ stars, and add the best one to the cart.",
  "Summarise today's top three tech headlines with links.",
];

const today = () => new Date().toISOString().slice(0, 10);
const spentToday = () => (settings.agent.spend.date === today() ? settings.agent.spend.usd : 0);

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
  if (name === "memory") loadMemory();
  if (name === "limits") renderLimits();
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
      ? "Claude uses Anthropic's own web tools plus the browser."
      : id === "ollama" || id === "custom"
        ? "Local models: pick one that supports tool calling (llama3.1, qwen2.5, mistral-nemo…) or it will answer from memory only."
        : "OpenAI-compatible endpoint with PocketPet's search, page-reading and browser tools.";
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
  $("voice").checked = settings.agent.voice;
  $("speakSetting").checked = settings.agent.speak;
  $("mic").hidden = !settings.agent.voice;
}

for (const id of ["ollama", "custom"]) {
  $(`url_${id}`).addEventListener("change", () => save({ agent: { baseUrls: { [id]: $(`url_${id}`).value.trim() } } }));
}
$("voice").addEventListener("input", () => {
  save({ agent: { voice: $("voice").checked } });
  $("mic").hidden = !$("voice").checked;
});
$("speakSetting").addEventListener("input", () => save({ agent: { speak: $("speakSetting").checked } }));

// --- limits & sites ---------------------------------------------------------------------

function renderLimits() {
  $("browserOn").checked = settings.agent.browser;
  $("sites").value = settings.agent.allowedSites.join("\n");
  $("dailyCap").value = settings.agent.dailyCapUsd;
  $("maxTurns").value = settings.agent.maxTurns;
  $("maxTurnsHint").textContent = String(settings.agent.maxTurns);
  $("narrate").checked = settings.agent.narrate;
  paintSpend();
}

function paintSpend() {
  const cap = settings.agent.dailyCapUsd;
  const s = spentToday();
  $("spendToday").textContent = `Spent today: $${s.toFixed(3)}${cap ? ` of $${cap.toFixed(2)}` : ""}`;
  $("spend").textContent = s ? `· $${s.toFixed(3)} today` : "";
}

$("browserOn").addEventListener("input", () => save({ agent: { browser: $("browserOn").checked } }));
$("sites").addEventListener("change", () => {
  const lines = $("sites").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  save({ agent: { allowedSites: lines } });
  const kept = settings.agent.allowedSites;
  $("sitesStatus").textContent = kept.length === lines.length ? `${kept.length} site${kept.length === 1 ? "" : "s"}.` : `Kept ${kept.length} of ${lines.length} (use plain domains like amazon.in).`;
  $("sites").value = kept.join("\n");
});
$("dailyCap").addEventListener("change", () => {
  save({ agent: { dailyCapUsd: Number($("dailyCap").value) } });
  paintSpend();
});
$("maxTurns").addEventListener("input", () => {
  $("maxTurnsHint").textContent = $("maxTurns").value;
  save({ agent: { maxTurns: Number($("maxTurns").value) } });
});
$("narrate").addEventListener("input", () => save({ agent: { narrate: $("narrate").checked } }));
$("closeBrowser").addEventListener("click", async () => {
  const closed = await invoke("agent_close_browser").catch(() => false);
  $("status").textContent = closed ? "Browser closed." : "No pet browser was open.";
});

// --- memory ----------------------------------------------------------------------------

async function loadMemory() {
  $("memory").value = await invoke("memory_read").catch(() => "");
  $("memoryStatus").textContent = "";
}
$("memorySave").addEventListener("click", async () => {
  try {
    await invoke("memory_write", { text: $("memory").value });
    $("memoryStatus").textContent = "Saved.";
  } catch (err) {
    $("memoryStatus").textContent = `Couldn't save: ${err}`;
  }
});
$("memoryClear").addEventListener("click", async () => {
  if (!confirm("Forget everything the pet remembers about you?")) return;
  await invoke("memory_write", { text: "" }).catch(() => {});
  loadMemory();
});

// --- running a task ------------------------------------------------------------------

function logLine(kind, text) {
  const log = $("log");
  log.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.className = kind;
  const icon = { start: "▶", tool: "🔎", result: "↳", note: "💬", answer: "✅", error: "⚠", cancelled: "⏹", ask: "❓", confirm: "🛑", browser: "🌐", act: "👉", usage: "·" }[kind] ?? "•";
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
  $("pause").disabled = !on;
  $("task").disabled = on;
  $("provider").disabled = on;
  if (!on) {
    $("pause").textContent = "Pause";
    hideAsk();
  }
}

$("run").addEventListener("click", startTask);
$("task").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) startTask();
});

async function startTask() {
  const task = $("task").value.trim();
  if (!task || current) return;
  settings = readSettings();
  const cap = settings.agent.dailyCapUsd;
  const budget = cap > 0 ? Math.max(0, cap - spentToday()) : 0;
  if (cap > 0 && budget <= 0) {
    $("status").textContent = "Daily spend cap reached — raise it under Limits & sites.";
    return;
  }
  const provider = $("provider").value;
  const model = $("model").value.trim();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  current = { id, task, provider, model, startedAt: Date.now(), paused: false };
  $("log").innerHTML = "";
  $("answerCard").hidden = true;
  $("planCard").hidden = true;
  $("plan").innerHTML = "";
  $("shotWrap").hidden = true;
  $("status").textContent = "Working…";
  setRunning(true);
  const petName = settings.petNames[settings.pet] || "";
  try {
    await invoke("agent_run", {
      req: {
        id, task, provider, model,
        baseUrl: settings.agent.baseUrls[provider] ?? "",
        petName,
        maxTurns: settings.agent.maxTurns,
        allowedSites: settings.agent.allowedSites,
        budgetUsd: budget,
        browser: settings.agent.browser,
      },
    });
  } catch (err) {
    finish("error", String(err));
  }
}

$("cancel").addEventListener("click", () => {
  if (current) invoke("agent_cancel", { id: current.id }).catch(() => {});
});
$("pause").addEventListener("click", () => {
  if (!current) return;
  current.paused = !current.paused;
  invoke("agent_pause", { id: current.id, paused: current.paused }).catch(() => {});
  $("pause").textContent = current.paused ? "Resume" : "Pause";
  $("status").textContent = current.paused ? "Paused — take over in the browser, then Resume." : "Working…";
});

// approvals and questions
function showAsk(kind, text) {
  $("askCard").hidden = false;
  $("askTitle").textContent = kind === "confirm" ? "Approve this step?" : "The pet has a question";
  $("askText").textContent = text;
  $("askConfirm").hidden = kind !== "confirm";
  $("askReply").hidden = kind === "confirm";
  if (kind !== "confirm") {
    $("replyText").value = "";
    $("replyText").focus();
  }
  $("status").textContent = kind === "confirm" ? "Waiting for your approval…" : "Waiting for your answer…";
}
function hideAsk() {
  $("askCard").hidden = true;
}
function reply(text) {
  if (!current) return;
  invoke("agent_reply", { id: current.id, text }).catch(() => {});
  hideAsk();
  $("status").textContent = "Working…";
}
$("approve").addEventListener("click", () => reply("yes"));
$("deny").addEventListener("click", () => reply("no"));
$("replySend").addEventListener("click", () => reply($("replyText").value.trim() || "done"));
$("replyText").addEventListener("keydown", (e) => {
  if (e.key === "Enter") reply($("replyText").value.trim() || "done");
});

function finish(status, text) {
  if (!current) return;
  const done = { ...current };
  current = null;
  setRunning(false);
  $("status").textContent = status === "done" ? `Done in ${Math.round((Date.now() - done.startedAt) / 1000)} s` : status === "cancelled" ? "Cancelled." : "Failed.";
  if (status === "done") {
    $("answerCard").hidden = false;
    renderAnswer(text);
    if (settings.agent.speak) speak(text);
  }
  logLine(status === "done" ? "answer" : status, status === "done" ? "Answer ready" : text);
  // History and spend are written by the overlay (single writer avoids
  // cross-window localStorage races); it tells us via pet://settings.
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

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "link").slice(0, 1200));
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {
    /* no voices */
  }
}
$("speak").addEventListener("click", () => speak($("answer").textContent));

listen("pet://task", ({ payload }) => {
  if (!current || payload.id !== current.id) return;
  const { kind, text, detail } = payload;
  switch (kind) {
    case "answer":
      return finish("done", text);
    case "error":
      return finish("error", text);
    case "cancelled":
      return finish("cancelled", text);
    case "confirm":
    case "ask":
      logLine(kind, text);
      return showAsk(kind, text);
    case "plan": {
      $("planCard").hidden = false;
      $("plan").innerHTML = "";
      for (const s of detail?.steps ?? []) {
        const li = document.createElement("li");
        li.textContent = s;
        $("plan").append(li);
      }
      return;
    }
    case "step": {
      const li = $("plan").children[detail?.index ?? -1];
      if (li) li.dataset.status = detail.status;
      return;
    }
    case "shot":
      $("shotWrap").hidden = false;
      $("shot").src = `data:image/jpeg;base64,${detail?.jpeg ?? ""}`;
      return logLine("tool", "screenshot");
    case "usage":
      $("spend").textContent = `· $${(spentToday() + (detail?.usd ?? 0)).toFixed(3)} today`;
      return;
    case "act":
      return; // the pet animates these; nothing to log
    default:
      logLine(kind, text);
  }
});

// --- voice input ----------------------------------------------------------------------
// Hold the mic button; on release the clip goes to Whisper (Groq/OpenAI key).

let recorder = null;
let chunks = [];

async function startRecording() {
  if (recorder) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      recorder = null;
      $("mic").classList.remove("recording");
      if (blob.size < 2000) return;
      $("status").textContent = "Transcribing…";
      try {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(blob);
        });
        const text = await invoke("agent_transcribe", { audioB64: b64, mime: "audio/webm" });
        $("task").value = ($("task").value.trim() ? $("task").value.trim() + " " : "") + text;
        $("status").textContent = "Heard you. Press Go.";
      } catch (err) {
        $("status").textContent = String(err);
      }
    };
    recorder.start();
    $("mic").classList.add("recording");
    $("status").textContent = "Listening… release to stop.";
  } catch (err) {
    $("status").textContent = `Microphone unavailable: ${err.message ?? err}. Press Win+H to dictate instead.`;
  }
}
function stopRecording() {
  if (recorder && recorder.state === "recording") recorder.stop();
}
$("mic").addEventListener("pointerdown", startRecording);
$("mic").addEventListener("pointerup", stopRecording);
$("mic").addEventListener("pointerleave", stopRecording);

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
$("mic").hidden = !settings.agent.voice;
window.addEventListener("storage", () => {
  settings = readSettings();
  paintSpend();
});
listen("pet://settings", () => {
  settings = readSettings();
  paintSpend();
  if (!document.querySelector('[data-panel="history"]').hidden) renderHistory();
});
loadProviders();
paintSpend();
