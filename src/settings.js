// Settings window. Reads and writes the same localStorage entry the overlay
// uses (validated by preferences.js), then broadcasts "pet://settings" so the
// overlay applies the change.
import { PETS } from "./pets/index.js";
import {
  readSettings,
  writeSettings,
  normalizeSettings,
  parseBackup,
  keepLocalTrust,
  profileFor,
  milestonesFor,
  accessoryUnlocked,
  ACCESSORY_SLOTS,
  MAX_ACCESSORIES,
  DEFAULTS,
  STORAGE_KEY,
} from "./preferences.js";
import { getPet } from "./pets/index.js";
import { paintPetSprite, customImageSvg, renderAccessoryNodes } from "./appearance.js";
import { updateConfirmation } from "./update-state.js";
import { petMood } from "./mood.js";
import { parsePetPreset, parsePetPresetLink } from "./pet-preset.js";

const { emit, listen } = window.__TAURI__.event;
const { invoke } = window.__TAURI__.core;

const $ = (id) => document.getElementById(id);
let settings = readSettings();

function save(patch) {
  settings = writeSettings(patch);
  emit("pet://settings", patch).catch(() => {});
}

// --- tabs --------------------------------------------------------------------

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => {
    clearFilter();
    showTab(tab.dataset.tab);
  });
  // Lets the search view label each panel it pulls cards from.
  const panel = document.querySelector(`[data-panel="${tab.dataset.tab}"]`);
  if (panel) {
    panel.dataset.title = tab.textContent;
    panel.id = `panel-${tab.dataset.tab}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${tab.dataset.tab}`);
    tab.id = `tab-${tab.dataset.tab}`;
    tab.setAttribute("aria-controls", panel.id);
  }
}
document.getElementById("tabs").addEventListener("keydown", (event) => {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
});

function showTab(name) {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
    tab.tabIndex = tab.dataset.tab === name ? 0 : -1;
  }
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== name;
  }
  if (name === "dashboard") renderDashboard();
  if (name === "pets") renderPets();
}

// --- pet lists ----------------------------------------------------------------

const allPets = () => [
  ...Object.values(PETS).map((p) => ({ id: p.id, label: `${p.emoji}  ${settings.petNames[p.id] || p.name}` })),
  ...settings.customPets.map((p) => ({ id: p.id, label: `🖼️  ${p.name}` })),
];

function fillPetSelect(select, includeNone) {
  const current = select.value;
  select.innerHTML = "";
  if (includeNone) select.add(new Option("None", ""));
  for (const p of allPets()) select.add(new Option(p.label, p.id));
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function renderPetChoices() {
  const list = $("petChoices");
  const focusedId = list.contains(document.activeElement) ? document.activeElement.dataset.petId : null;
  const pets = [...Object.values(PETS), ...settings.customPets];
  list.replaceChildren();
  for (const p of pets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pet-option";
    button.dataset.petId = p.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(settings.pet === p.id));
    button.tabIndex = settings.pet === p.id ? 0 : -1;
    const art = document.createElement("span");
    art.className = "sprite pet-option-art";
    art.setAttribute("aria-hidden", "true");
    paintPetSprite(art, spriteFor(p.id), settings.colors[p.id]);
    const name = document.createElement("span");
    name.className = "pet-option-name";
    name.textContent = settings.petNames[p.id] || p.name;
    const check = document.createElement("span");
    check.className = "pet-option-check";
    check.textContent = "✓";
    check.hidden = settings.pet !== p.id;
    check.setAttribute("aria-hidden", "true");
    button.append(art, name, check);
    const select = (id) => {
      $("pet").value = id;
      $("pet").dispatchEvent(new Event("input", { bubbles: true }));
      [...list.children].find((node) => node.dataset.petId === id)?.focus();
    };
    button.addEventListener("click", () => select(p.id));
    button.addEventListener("keydown", (event) => {
      const index = pets.findIndex((entry) => entry.id === p.id);
      let next;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % pets.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + pets.length) % pets.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = pets.length - 1;
      else return;
      event.preventDefault();
      select(pets[next].id);
    });
    list.append(button);
  }
  if (focusedId) [...list.children].find((node) => node.dataset.petId === focusedId)?.focus();
}

// --- simple fields -------------------------------------------------------------

const FIELDS = {
  pet: "value",
  companion: "value",
  size: "value",
  speed: "value",
  toy: "value",
  follow: "checked",
  mischief: "checked",
  realClick: "checked",
  chatter: "value",
  hungerRate: "value",
  showHunger: "checked",
  pauseHungerOffline: "checked",
  sound: "checked",
  volume: "value",
  lowPower: "checked",
  focusFullscreen: "checked",
  quietHours: "checked",
  quietStart: "value",
  quietEnd: "value",
  focusAction: "value",
  monitor: "value",
  roamMargin: "value",
  roamBottomOnly: "checked",
  breakMins: "value",
  breakSnooze: "value",
  showCountdown: "checked",
  toasts: "checked",
  breakCycles: "checked",
  breakDuration: "value",
  speechSize: "value",
  speechDuration: "value",
};
const NUMERIC = new Set([
  "chatter", "hungerRate", "volume", "roamMargin", "breakMins", "breakSnooze", "breakDuration",
  "speechSize", "speechDuration",
]);

function hints() {
  const pct = (id) => `${$(id).value}%`;
  $("chatterHint").textContent = Number($("chatter").value) === 0 ? "(silent)" : pct("chatter");
  $("hungerRateHint").textContent = Number($("hungerRate").value) === 0 ? "(never hungry)" : pct("hungerRate");
  $("volumeHint").textContent = pct("volume");
  $("roamMarginHint").textContent = `${$("roamMargin").value} px`;
  const mins = Number($("breakMins").value);
  $("breakMinsHint").textContent = mins === 0 ? "(off)" : mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ""}` : `${mins} min`;
  $("speechSizeHint").textContent = `${$("speechSize").value} px`;
  $("speechDurationHint").textContent = pct("speechDuration");
  $("hungerNow").textContent = `Right now: ${Math.round(100 - settings.hunger)}% full`;
}

function fill() {
  settings = readSettings();
  fillPetSelect($("pet"), false);
  fillPetSelect($("companion"), true);
  fillPetSelect($("customisePet"), false);
  fillPetSelect($("dashPet"), false);
  for (const [id, prop] of Object.entries(FIELDS)) $(id)[prop] = settings[id];
  renderPetChoices();
  const a = settings.avoidArea;
  $("avoidEnabled").checked = a.enabled;
  $("avoidX").value = a.x;
  $("avoidY").value = a.y;
  $("avoidW").value = a.w;
  $("avoidH").value = a.h;
  for (const key of Object.keys(settings.shortcuts)) if ($(`sc_${key}`)) $(`sc_${key}`).value = settings.shortcuts[key];
  $("updateCheck").checked = settings.agent.updateCheck;
  hints();
  syncDependents();
  checkShortcutConflicts();
  paintAvoidPreview();
  renderPets();
  renderCustomList();
  renderAppProfiles();
}

function renderAppProfiles() {
  const list = $("appProfileList");
  list.replaceChildren();
  for (const rule of settings.appProfiles) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${rule.app} · ${rule.mode}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      save({ appProfiles: settings.appProfiles.filter((item) => item.app !== rule.app) });
      renderAppProfiles();
    });
    li.append(label, remove);
    list.append(li);
  }
  if (!settings.appProfiles.length) list.textContent = "No app rules yet.";
}

$("appProfileCurrent").addEventListener("click", async () => {
  const env = await invoke("get_environment").catch(() => null);
  $("appProfileName").value = env?.active_app || "";
  $("appProfileStatus").textContent = env?.active_app ? `Found ${env.active_app}. Choose mode, then save.` : "No foreground app found. Enter executable name.";
});
$("appProfileAdd").addEventListener("click", () => {
  const entered = $("appProfileName").value.trim().toLowerCase();
  const app = entered.endsWith(".exe") ? entered : `${entered}.exe`;
  if (!/^[a-z0-9][a-z0-9._ -]{0,75}\.exe$/.test(app)) {
    $("appProfileStatus").textContent = "Enter executable filename, such as zoom.exe.";
    return;
  }
  const mode = $("appProfileMode").value;
  save({ appProfiles: [...settings.appProfiles.filter((item) => item.app !== app), { app, mode }] });
  $("appProfileStatus").textContent = `${app} uses ${mode} mode.`;
  renderAppProfiles();
});

// --- dependent fields ------------------------------------------------------------
// Groups marked data-needs="<id>" fade out (and stop taking input) while the
// switch or slider they depend on is off / zero.

function syncDependents() {
  for (const group of document.querySelectorAll("[data-needs]")) {
    const master = $(group.dataset.needs);
    const on = master.type === "checkbox" ? master.checked : Number(master.value) > 0;
    group.classList.toggle("off", !on);
    for (const control of group.querySelectorAll("input, select, button")) control.disabled = !on;
  }
}

// --- search --------------------------------------------------------------------------
// Filters cards across every tab by their visible text.

const filterBox = $("filter");
let noResults = null;

function applyFilter() {
  const q = filterBox.value.trim().toLowerCase();
  document.body.classList.toggle("filtering", q.length > 0);
  if (!q) {
    for (const card of document.querySelectorAll(".card, [data-panel]")) card.classList.remove("filtered-out");
    noResults?.remove();
    return;
  }
  let any = false;
  for (const panel of document.querySelectorAll("[data-panel]")) {
    let hit = false;
    for (const card of panel.querySelectorAll(".card")) {
      const match = card.textContent.toLowerCase().includes(q);
      card.classList.toggle("filtered-out", !match);
      hit ||= match;
    }
    panel.classList.toggle("filtered-out", !hit);
    any ||= hit;
    if (hit && panel.dataset.panel === "dashboard") renderDashboard();
  }
  if (!any) {
    noResults ??= Object.assign(document.createElement("p"), { className: "no-results" });
    noResults.textContent = `Nothing matches "${filterBox.value.trim()}".`;
    document.querySelector("main").append(noResults);
  } else noResults?.remove();
}

function clearFilter() {
  if (!filterBox.value) return;
  filterBox.value = "";
  applyFilter();
}

filterBox.addEventListener("input", applyFilter);
filterBox.addEventListener("keydown", (e) => {
  if (e.key === "Escape") clearFilter();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    filterBox.focus();
    filterBox.select();
  }
});

// --- per-card reset ---------------------------------------------------------------------
// Every card whose controls map to plain settings gets a "Reset" that puts
// just those back to their defaults.

for (const card of document.querySelectorAll(".card")) {
  const ids = [...card.querySelectorAll("[id]")].map((n) => n.id).filter((id) => id in FIELDS);
  const avoid = card.querySelector("#avoidEnabled") != null;
  if (!ids.length && !avoid) continue;
  const h2 = card.querySelector("h2");
  if (!h2) continue;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reset-section";
  button.textContent = "Reset";
  button.title = "Reset this section to its defaults";
  button.addEventListener("click", () => {
    const patch = {};
    for (const id of ids) patch[id] = DEFAULTS[id];
    if (avoid) patch.avoidArea = { ...DEFAULTS.avoidArea };
    save(patch);
    fill();
  });
  h2.append(button);
}

for (const [id, prop] of Object.entries(FIELDS)) {
  $(id).addEventListener("input", () => {
    let v = $(id)[prop];
    if (NUMERIC.has(id)) v = Number(v);
    save({ [id]: v });
    hints();
    syncDependents();
    if (id === "pet" || id === "companion") fill();
  });
}

// keep-out area
for (const id of ["avoidEnabled", "avoidX", "avoidY", "avoidW", "avoidH"]) {
  $(id).addEventListener("input", () => {
    save({
      avoidArea: {
        enabled: $("avoidEnabled").checked,
        x: Number($("avoidX").value),
        y: Number($("avoidY").value),
        w: Number($("avoidW").value),
        h: Number($("avoidH").value),
      },
    });
    paintAvoidPreview();
  });
}

function paintAvoidPreview() {
  const a = settings.avoidArea;
  const box = $("avoidPreview").querySelector(".preview-box");
  box.style.left = `${a.x}%`;
  box.style.top = `${a.y}%`;
  box.style.width = `${a.w}%`;
  box.style.height = `${a.h}%`;
  box.style.opacity = a.enabled ? "1" : "0.3";
}

// monitors: populated from the overlay's screen info
async function fillMonitors() {
  const select = $("monitor");
  const current = settings.monitor;
  select.innerHTML = "";
  select.add(new Option("Any (wherever it is)", "all"));
  try {
    const info = await invoke("get_screen");
    (info.monitors ?? []).forEach((m, i) => {
      select.add(new Option(`Monitor ${i + 1} — ${m.w}×${m.h}${m.x === 0 && m.y === 0 ? " (primary)" : ""}`, String(i)));
    });
  } catch {
    /* overlay not reachable; "Any" still works */
  }
  select.value = [...select.options].some((o) => o.value === current) ? current : "all";
}

// --- pets tab -----------------------------------------------------------------

const EMOJI_PRESETS = ["🎀", "⭐", "👑", "🎩", "🧢", "👒", "🎓", "🕶️", "👓", "🧣", "🎧", "🌸", "🍀", "🦋", "🐝", "💎", "🔥", "🎈", "🎃", "🎄", "❤️", "🍪", "🎒", "🪄"];
const SLOT_LABEL = { hat: "Hat (top)", face: "Face", neck: "Neck", back: "Back", paw: "Paw" };

/** The pet's own body colour, so the picker starts somewhere sensible. */
const baseColor = (id) => getPet(id)?.tint?.[0] ?? "#f5a94c";

/** Sprite for any pet id, built-in or custom picture. */
function spriteFor(id) {
  const custom = settings.customPets.find((p) => p.id === id);
  return custom ? { id, svg: customImageSvg(custom.image, custom.frames) } : getPet(id);
}

function renderPreview(id) {
  settings = readSettings();
  const p = spriteFor(id);
  const sprite = $("previewSprite");
  paintPetSprite(sprite, p, settings.colors[id]);
  renderAccessoryNodes($("previewAccessories"), settings.accessories[id] ?? []);
  $("previewPet").dataset.personality = settings.personalities[id] ?? "calm";
}

function renderPets() {
  const id = $("customisePet").value || settings.pet;
  const base = allPets().find((p) => p.id === id);
  $("customiseWho").textContent = base ? `· ${base.label}` : "";
  renderPreview(id);
  $("petName").value = settings.petNames[id] ?? "";
  $("personality").value = settings.personalities[id] ?? "calm";
  const custom = settings.colors[id];
  $("color").value = custom || baseColor(id);
  $("color").disabled = id.startsWith("custom:");
  $("colorHint").textContent = id.startsWith("custom:") ? "(image pets keep their colours)" : custom ? custom : "(original)";
  renderAccessories(id);
}

function renderAccessories(id) {
  const items = settings.accessories[id] ?? [];
  $("accessoryCount").textContent = `· ${items.length}/${MAX_ACCESSORIES}`;
  const presets = $("emojiPresets");
  presets.innerHTML = "";
  for (const e of EMOJI_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = e;
    const unlocked = accessoryUnlocked(settings, id, e);
    b.title = unlocked ? `Add ${e}` : `${e} unlocks from this pet's milestones. See Dashboard.`;
    b.disabled = items.length >= MAX_ACCESSORIES || !unlocked;
    b.addEventListener("click", () => addAccessory(id, e));
    presets.append(b);
  }
  const custom = document.createElement("button");
  custom.type = "button";
  custom.textContent = "+ type…";
  custom.disabled = items.length >= MAX_ACCESSORIES;
  custom.addEventListener("click", () => {
    const e = prompt("Emoji to add:");
    if (e && e.trim()) addAccessory(id, e.trim().slice(0, 8));
  });
  presets.append(custom);

  const list = $("accessoryList");
  list.innerHTML = "";
  items.forEach((a, i) => {
    const li = document.createElement("li");
    const emoji = document.createElement("input");
    emoji.type = "text";
    emoji.className = "emoji";
    emoji.maxLength = 8;
    emoji.value = a.emoji;
    emoji.addEventListener("change", () => updateAccessory(id, i, { emoji: emoji.value }));
    const slot = document.createElement("select");
    for (const s of ACCESSORY_SLOTS) slot.add(new Option(SLOT_LABEL[s], s));
    slot.value = a.slot;
    slot.addEventListener("input", () => updateAccessory(id, i, { slot: slot.value }));
    const size = document.createElement("input");
    size.type = "range";
    size.min = "0.5";
    size.max = "1.8";
    size.step = "0.1";
    size.value = a.size;
    size.title = "Size";
    size.addEventListener("input", () => updateAccessory(id, i, { size: Number(size.value) }));
    const nudge = document.createElement("input");
    nudge.type = "range";
    nudge.min = "-50";
    nudge.max = "50";
    nudge.step = "2";
    nudge.value = a.y;
    nudge.title = "Up / down";
    nudge.addEventListener("input", () => updateAccessory(id, i, { y: Number(nudge.value) }));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () =>
      setAccessories(id, (readSettings().accessories[id] ?? []).filter((_, j) => j !== i)),
    );
    li.append(emoji, slot, size, nudge, del);
    list.append(li);
  });
  $("accessoryHint").textContent = items.length ? "Drag the sliders: size, then up/down." : "No accessories yet.";
}

function setAccessories(id, items) {
  save({ accessories: { [id]: items } });
  renderAccessories(id);
  renderPreview(id);
}

function addAccessory(id, emoji) {
  const items = settings.accessories[id] ?? [];
  if (items.length >= MAX_ACCESSORIES || !accessoryUnlocked(settings, id, emoji)) return;
  const used = new Set(items.map((a) => a.slot));
  const slot = ACCESSORY_SLOTS.find((s) => !used.has(s)) ?? "hat";
  setAccessories(id, [...items, { emoji, slot, size: 1, x: 0, y: 0 }]);
}

function updateAccessory(id, index, patch) {
  if (patch.emoji && !accessoryUnlocked(settings, id, patch.emoji)) {
    renderAccessories(id);
    return;
  }
  const items = (settings.accessories[id] ?? []).map((a, i) => (i === index ? { ...a, ...patch } : a));
  save({ accessories: { [id]: items } });
  settings = readSettings();
  $("accessoryCount").textContent = `· ${items.length}/${MAX_ACCESSORIES}`;
  renderPreview(id);
}

$("customisePet").addEventListener("input", renderPets);
$("petName").addEventListener("change", () => {
  const id = $("customisePet").value;
  save({ petNames: { [id]: $("petName").value } });
  fill();
});
$("personality").addEventListener("input", () => {
  const id = $("customisePet").value;
  save({ personalities: { [id]: $("personality").value } });
  renderPreview(id);
});
$("color").addEventListener("input", () => {
  const id = $("customisePet").value;
  save({ colors: { [id]: $("color").value } });
  $("colorHint").textContent = $("color").value;
  renderPreview(id);
  renderPetChoices();
});
$("colorReset").addEventListener("click", () => {
  const id = $("customisePet").value;
  save({ colors: { [id]: "" } });
  renderPets();
  renderPetChoices();
});

// custom image pets: pick → square-crop → shrink to 256 px → store
$("addCustom").addEventListener("click", async () => {
  if (settings.customPets.length >= 12) {
    alert("You already have 12 custom pets. Remove one first.");
    return;
  }
  try {
    const url = await invoke("pick_image");
    if (!url) return;
    const image = await shrink(url, 256);
    const id = `custom:${Date.now().toString(36)}`;
    save({ customPets: [...settings.customPets, { id, name: `My pet ${settings.customPets.length + 1}`, image, frames: 1 }] });
    fill();
  } catch (err) {
    alert(String(err));
  }
});

$("addCustomSheet").addEventListener("click", async () => {
  if (settings.customPets.length >= 12) { alert("You already have 12 custom pets. Remove one first."); return; }
  try {
    const url = await invoke("pick_image");
    if (!url) return;
    const image = await shrinkSheet(url);
    const id = `custom:${Date.now().toString(36)}`;
    save({ customPets: [...settings.customPets, { id, name: `Animated pet ${settings.customPets.length + 1}`, image, frames: 4 }] });
    fill();
  } catch (error) { alert(String(error)); }
});

$("importPetPreset").addEventListener("click", async () => {
  try {
    const text = await invoke("load_backup");
    if (!text) { $("presetStatus").textContent = "Import cancelled."; return; }
    save(parsePetPreset(JSON.parse(text)));
    fill();
    $("presetStatus").textContent = "Website pet setup imported.";
  } catch (error) { $("presetStatus").textContent = `Import failed: ${error.message ?? error}`; }
});

async function receivePetPresetLink() {
  try {
    const link = await invoke("take_pet_preset_link");
    if (!link) return;
    save(parsePetPresetLink(link));
    fill();
    $("presetStatus").textContent = "Website pet setup applied.";
    showTab("pets");
  } catch (error) {
    $("presetStatus").textContent = `Pet link failed: ${error.message ?? error}`;
  }
}
listen("pet://preset-link", receivePetPresetLink);
window.addEventListener("focus", receivePetPresetLink);
receivePetPresetLink();

function shrinkSheet(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio < 3.8 || ratio > 4.2) { reject(new Error("Sprite sheet must have four square frames side by side (4:1 ratio).")); return; }
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 256;
      canvas.getContext("2d").drawImage(img, 0, 0, 1024, 256);
      const result = canvas.toDataURL("image/png");
      if (result.length > 1_800_000) { reject(new Error("Sprite sheet too large after resize. Use simpler art or fewer colours.")); return; }
      resolve(result);
    };
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = dataUrl;
  });
}

/** Centre-crop to a square and resize on a canvas; GIFs lose animation but keep the first frame. */
function shrink(dataUrl, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = dataUrl;
  });
}

function renderCustomList() {
  const list = $("customList");
  list.innerHTML = "";
  for (const p of settings.customPets) {
    const li = document.createElement("li");
    const img = new Image();
    img.src = p.image;
    if (p.frames === 4) { img.style.objectFit = "cover"; img.style.objectPosition = "left"; }
    const name = document.createElement("input");
    name.type = "text";
    name.value = p.name;
    name.maxLength = 40;
    name.className = "grow";
    name.addEventListener("change", () => {
      save({ customPets: settings.customPets.map((c) => (c.id === p.id ? { ...c, name: name.value || "My pet" } : c)) });
      fill();
    });
    const use = document.createElement("button");
    use.textContent = settings.pet === p.id ? "Active" : "Use";
    use.disabled = settings.pet === p.id;
    use.addEventListener("click", () => {
      save({ pet: p.id });
      fill();
    });
    const del = document.createElement("button");
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      const patch = { customPets: settings.customPets.filter((c) => c.id !== p.id) };
      if (settings.pet === p.id) patch.pet = "cat";
      if (settings.companion === p.id) patch.companion = "";
      save(patch);
      fill();
    });
    li.append(img, name, use, del);
    list.append(li);
  }
}

// --- shortcuts ----------------------------------------------------------------

/** Two actions on one combination: only the first registers, so flag both. */
function checkShortcutConflicts() {
  const seen = new Map();
  const clashes = new Set();
  for (const key of Object.keys(DEFAULTS.shortcuts)) {
    const combo = ($(`sc_${key}`)?.value ?? "").trim().toLowerCase();
    if (!combo) continue;
    if (seen.has(combo)) {
      clashes.add(seen.get(combo));
      clashes.add(key);
    } else seen.set(combo, key);
  }
  for (const key of Object.keys(DEFAULTS.shortcuts)) $(`sc_${key}`)?.classList.toggle("conflict", clashes.has(key));
  const status = $("shortcutStatus");
  status.hidden = clashes.size === 0;
  if (clashes.size) status.textContent = "Two actions share a combination — only one of them will work. Change one.";
}

function setShortcut(key, combo) {
  $(`sc_${key}`).value = combo;
  save({ shortcuts: { [key]: combo } });
  checkShortcutConflicts();
}

for (const button of document.querySelectorAll(".sc-clear")) {
  button.addEventListener("click", () => setShortcut(button.dataset.clear, ""));
}

for (const key of Object.keys(DEFAULTS.shortcuts)) {
  const input = $(`sc_${key}`);
  if (!input) continue;
  input.addEventListener("keydown", (e) => {
    e.preventDefault();
    if (e.key === "Backspace" || e.key === "Delete") {
      setShortcut(key, "");
      return;
    }
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Win"].filter(Boolean);
    if (!mods.length) {
      input.value = "needs Ctrl / Alt / Shift / Win";
      return;
    }
    let k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k === " ") k = "Space";
    setShortcut(key, [...mods, k].join("+"));
  });
}

// --- updates & diagnostics --------------------------------------------------------

const PENDING_INSTALL_KEY = "pocketpet:pending-update";
const installedBuild = invoke("build_identity")
  .then((identity) => {
    $("buildIdentity").textContent = identity;
    let pending;
    try { pending = JSON.parse(localStorage.getItem(PENDING_INSTALL_KEY)); } catch { /* no valid saved attempt */ }
    const result = updateConfirmation(pending, identity);
    if (result) {
      $("installedUpdateStatus").hidden = false;
      $("installedUpdateStatus").textContent = result.installed
        ? `Update confirmed: PocketPet ${result.current} is now running.`
        : `Update to ${result.target} is not installed yet. This copy is still running ${result.current}.`;
      if (result.installed) {
        localStorage.removeItem(PENDING_INSTALL_KEY);
        showTab("about");
      }
    }
    return identity;
  })
  .catch(() => {
    $("buildIdentity").textContent = "Build information unavailable. Restart PocketPet after installing an update.";
    return null;
  });

let pendingUpdate = null;
let releasePage = "https://github.com/vigneshcj001/Pocketpet/releases";
let updateBusy = false;
let downloadingUpdate = false;
function setUpdateBusy(busy) {
  updateBusy = busy;
  $("checkUpdate").disabled = busy;
  $("installUpdate").disabled = busy;
}
const updateProgressReady = listen("pet://update-progress", ({ payload }) => {
  if (!downloadingUpdate || !payload) return;
  const downloaded = Math.max(0, Number(payload.downloaded) || 0);
  const total = Math.max(0, Number(payload.total) || 0);
  const progress = $("updateProgress");
  progress.hidden = false;
  if (payload.done || total > 0) {
    progress.max = total || downloaded || 1;
    progress.value = payload.done ? progress.max : Math.min(downloaded, total);
  } else progress.removeAttribute("value");
  const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  $("updateStatus").textContent = payload.done
    ? "Download complete. Opening the installer… PocketPet will close."
    : total > 0
      ? `Downloading ${Math.floor(downloaded / total * 100)}% · ${mb(downloaded)} of ${mb(total)}`
      : `Downloading… ${mb(downloaded)} received`;
}).then(() => true).catch(() => false);

$("checkUpdate").addEventListener("click", async () => {
  if (updateBusy) return;
  setUpdateBusy(true);
  pendingUpdate = null;
  $("installUpdate").hidden = true;
  $("updateProgress").hidden = true;
  $("updateStatus").textContent = "Checking…";
  try {
    const info = await invoke("check_update");
    pendingUpdate = info.available ? info : null;
    releasePage = info.latest && info.latest !== info.current
      ? `https://github.com/vigneshcj001/Pocketpet/releases/tag/${encodeURIComponent(info.latest)}`
      : "https://github.com/vigneshcj001/Pocketpet/releases";
    $("installUpdate").hidden = !info.available;
    $("updateStatus").textContent = info.notes === "No releases published yet."
      ? `Installed ${info.current}; no public release exists yet.`
      : info.available
        ? `Installed ${info.current}; latest published ${info.latest}. Update ready.${info.notes ? " " + info.notes.slice(0, 300) : ""}`
        : `Installed ${info.current}; latest published ${info.latest}. ${info.notes || "No newer published build."}`;
    save({ agent: { lastUpdateCheck: Date.now() } });
  } catch (err) {
    $("updateStatus").textContent = `Couldn't check: ${err}`;
  } finally {
    setUpdateBusy(false);
  }
});
$("installUpdate").addEventListener("click", async () => {
  if (!pendingUpdate || updateBusy) return;
  setUpdateBusy(true);
  downloadingUpdate = true;
  $("updateProgress").hidden = false;
  $("updateProgress").removeAttribute("value");
  $("updateStatus").textContent = "Connecting to the update download…";
  try {
    const identity = await installedBuild;
    if (!identity) throw new Error("Couldn't identify this build. Restart PocketPet and try again.");
    if (!await updateProgressReady) throw new Error("Couldn't prepare download progress. Reopen Settings and try again.");
    localStorage.setItem(PENDING_INSTALL_KEY, JSON.stringify({ fromIdentity: identity, targetVersion: pendingUpdate.latest }));
    // Windows quits into the installer; macOS and Linux return where the download went.
    const message = await invoke("install_update", { url: pendingUpdate.url, sha256: pendingUpdate.sha256 });
    if (message) {
      $("updateStatus").textContent = message;
      $("updateProgress").max = 1;
      $("updateProgress").value = 1;
    }
  } catch (err) {
    localStorage.removeItem(PENDING_INSTALL_KEY);
    $("updateProgress").hidden = true;
    $("updateStatus").textContent = `Update failed: ${err}`;
  } finally {
    downloadingUpdate = false;
    setUpdateBusy(false);
  }
});
$("updateCheck").addEventListener("input", () => save({ agent: { updateCheck: $("updateCheck").checked } }));
$("openLogs").addEventListener("click", () => invoke("open_logs_folder").catch(() => {}));
$("copyDiag").addEventListener("click", async () => {
  try {
    const text = await invoke("diagnostics");
    await navigator.clipboard.writeText(text);
    $("diagStatus").textContent = "Copied — paste it into your bug report.";
  } catch (err) {
    $("diagStatus").textContent = `Couldn't copy: ${err}`;
  }
});

$("resetShortcuts").addEventListener("click", () => {
  save({ shortcuts: { ...DEFAULTS.shortcuts } });
  fill();
});

// --- dashboard -------------------------------------------------------------------

function renderDashboard() {
  const id = $("dashPet").value || settings.pet;
  const p = profileFor(settings, id);
  const mood = petMood(p, id === settings.pet ? settings.hunger : id === settings.companion ? settings.buddyHunger : 0);
  const days = Math.max(1, Math.round((Date.now() - p.firstRun) / 86_400_000));
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  $("dashSummary").innerHTML = [
    stat(days, "days together"),
    stat(p.meals, "meals"),
    stat(p.pats + p.pets, "pats & cuddles"),
    stat(p.fetches, "fetches"),
    stat(p.games, "games"),
    stat(p.wins, "wins"),
    stat(p.breaks, "breaks taken"),
    stat(`Level ${mood.level}`, "friendship"),
    stat(mood.mood, "mood"),
    stat(settings.personalities[id] ?? "calm", "personality"),
    stat(`${Math.round(100 - (id === settings.pet ? settings.hunger : id === settings.companion ? settings.buddyHunger : 0))}%`, "full"),
  ].join("");
  const ms = $("dashMilestones");
  ms.innerHTML = "";
  for (const m of milestonesFor(p)) {
    const li = document.createElement("li");
    li.className = m.unlocked ? "" : "locked";
    const pctDone = Math.min(100, Math.round((m.value / m.goal) * 100));
    li.innerHTML = `<span>${m.unlocked ? "🏆" : "🔒"}</span><span class="grow"><b>${m.label}</b><br><span class="hint">${m.description}</span></span><div class="bar"><div style="width:${pctDone}%"></div></div><span class="hint">${Math.min(m.value, m.goal)}/${m.goal}</span>`;
    ms.append(li);
  }
  const j = $("dashJournal");
  j.innerHTML = "";
  const entries = [...p.journal].reverse();
  if (!entries.length) j.innerHTML = '<li class="hint">Nothing yet — feed, pat or play and it shows up here.</li>';
  for (const e of entries) {
    const li = document.createElement("li");
    const t = document.createElement("time");
    t.textContent = new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const text = document.createElement("span");
    text.textContent = e.text;
    li.append(t, text);
    j.append(li);
  }
}

$("dashPet").addEventListener("input", renderDashboard);

// --- backup ------------------------------------------------------------------------

$("exportBackup").addEventListener("click", async () => {
  const status = $("backupStatus");
  try {
    const json = JSON.stringify({ app: "PocketPet", version: 1, exportedAt: new Date().toISOString(), settings: readSettings() }, null, 2);
    const path = await invoke("save_backup", { json });
    status.textContent = path ? `Saved to ${path}` : "Export cancelled.";
  } catch (err) {
    status.textContent = `Export failed: ${err}`;
  }
});

$("importBackup").addEventListener("click", async () => {
  const status = $("backupStatus");
  try {
    const text = await invoke("load_backup");
    if (!text) {
      status.textContent = "Import cancelled.";
      return;
    }
    const restored = keepLocalTrust(parseBackup(JSON.parse(text)), readSettings());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    settings = readSettings();
    emit("pet://settings", { restored: true }).catch(() => {});
    fill();
    status.textContent = "Backup restored. Provider URLs and site rules on this computer were kept.";
  } catch (err) {
    status.textContent = `Import failed: ${err.message ?? err}`;
  }
});
$("openRelease").addEventListener("click", () => invoke("open_external", { url: releasePage }).catch(() => {}));

$("clearTaskHistory").addEventListener("click", () => {
  if (!confirm("Clear saved task history? Existing backup files will not change.")) return;
  save({ tasks: [] });
  $("dataStatus").textContent = "Task history cleared.";
});

$("clearSavedMemory").addEventListener("click", async () => {
  if (!confirm("Clear facts PocketPet remembers? Existing backup files will not change.")) return;
  try {
    await invoke("memory_write", { text: "" });
    $("dataStatus").textContent = "Saved memory cleared.";
  } catch (error) {
    $("dataStatus").textContent = `Could not clear memory: ${error}`;
  }
});

$("clearTaskLogs").addEventListener("click", async () => {
  if (!confirm("Permanently delete PocketPet task and crash logs from this computer?")) return;
  try {
    const count = await invoke("clear_logs");
    $("dataStatus").textContent = `${count} log file${count === 1 ? "" : "s"} cleared.`;
  } catch (error) {
    $("dataStatus").textContent = `Could not clear logs: ${error}`;
  }
});

$("resetAll").addEventListener("click", () => {
  if (!confirm("Reset every setting, custom pet and all progress? This cannot be undone.")) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings({})));
  settings = readSettings();
  emit("pet://settings", { reset: true }).catch(() => {});
  fill();
});

// --- boot ---------------------------------------------------------------------------

// Another window (the overlay) may change settings too; stay in sync.
window.addEventListener("storage", () => {
  fill();
  if (!document.querySelector('[data-panel="dashboard"]').hidden) renderDashboard();
});
fill();
fillMonitors();
// Window-aware tricks need Win32 (window list, caption buttons); grey them out elsewhere.
if (!/Windows/i.test(navigator.userAgent)) {
  for (const id of ["mischief", "realClick"]) {
    const box = $(id);
    box.disabled = true;
    box.checked = false;
    box.closest("label")?.classList.add("dim");
    box.closest("label")?.append(" (Windows only)");
  }
  const keys = $("resetShortcuts").closest(".card")?.querySelector("p.hint");
  if (keys) keys.textContent += " On macOS, Win means ⌘.";
}
