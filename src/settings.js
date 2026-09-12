// Settings window. Reads and writes the same localStorage entry the overlay
// uses, then broadcasts "pet://settings" so the overlay applies the change.
import { PETS } from "./pets/index.js";

const { emit } = window.__TAURI__.event;

const KEY = "pocketpet";
const $ = (id) => document.getElementById(id);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(patch) {
  const next = { ...load(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  emit("pet://settings", patch).catch(() => {});
}

// Selects for pet / companion share the same option list.
const petOptions = Object.values(PETS).map((p) => [p.id, `${p.emoji}  ${p.name}`]);
for (const [id, label] of petOptions) {
  $("pet").add(new Option(label, id));
}
$("companion").add(new Option("None", ""));
for (const [id, label] of petOptions) {
  $("companion").add(new Option(label, id));
}
if (load().customImage) $("pet").add(new Option("🖼️  Custom image", "custom"));

const fields = {
  pet: "value",
  companion: "value",
  size: "value",
  speed: "value",
  breakMins: "value",
  follow: "checked",
  mischief: "checked",
  realClick: "checked",
  toasts: "checked",
  sound: "checked",
  chatter: "value",
  hungerRate: "value",
  volume: "value",
};

const defaults = {
  pet: "cat",
  companion: "",
  size: "medium",
  speed: "normal",
  breakMins: 0,
  follow: true,
  mischief: false,
  realClick: false,
  toasts: true,
  sound: true,
  chatter: 50,
  hungerRate: 100,
  volume: 60,
};

function hints() {
  $("chatterHint").textContent =
    Number($("chatter").value) === 0 ? "(silent)" : `${$("chatter").value}%`;
  $("hungerHint").textContent =
    Number($("hungerRate").value) === 0 ? "(never hungry)" : `${$("hungerRate").value}%`;
  $("volumeHint").textContent = `${$("volume").value}%`;
}

function fill() {
  const s = { ...defaults, ...load() };
  for (const [id, prop] of Object.entries(fields)) {
    $(id)[prop] = s[id];
  }
  hints();
}

for (const [id, prop] of Object.entries(fields)) {
  $(id).addEventListener("input", () => {
    let v = $(id)[prop];
    if (["breakMins", "chatter", "hungerRate", "volume"].includes(id)) v = Number(v);
    save({ [id]: v });
    hints();
  });
}

// Another window (the overlay) may change settings too; stay in sync.
window.addEventListener("storage", fill);
fill();
