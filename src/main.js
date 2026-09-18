import { getPet as getBuiltinPet, PETS, DEFAULT_PET } from "./pets/index.js";
import {
  readSettings,
  writeSettings,
  recordActivity,
  profileFor,
  milestonesFor,
} from "./preferences.js";
import {
  focusActive,
  hungerAfter,
  nearestMonitor,
  insetBounds,
  exclusionRect,
  constrainPoint,
  formatCountdown,
} from "./behavior.js";
import { createGames, TOYS } from "./games.js";

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// --- tunables ----------------------------------------------------------------

/** Pet box in CSS px. Chosen from SIZES; mirrored into --pet-size by applySize. */
let SIZE = 76;
const SIZES = { small: 56, medium: 76, large: 104 };
const SPEEDS = { slow: 0.6, normal: 1, fast: 1.5 };
const GRAVITY = 2400; // px/s^2
const WALK_SPEED = 210; // px/s, before the speed multiplier
const RUN_SPEED = 520;
const ARRIVE_RADIUS = 110; // stop chasing once this close to the cursor
const RUN_RADIUS = 420;
const HOP_REACH = 150; // highest ledge the pet will hop onto
const SETTLE_AFTER = 2_600; // cursor idle before the pet stops chasing and falls
const HUNGRY_AT = 70; // starts asking for food
const STARVING_AT = 90; // slows down

/** Personality and time of day decide how quickly the pet dozes off. */
const SLEEP_AFTER = () => {
  const p = personality();
  if (p === "sleepy") return 9_000;
  if (p === "playful") return 40_000;
  return isLateNight() ? 9_000 : 25_000;
};

const speedMul = () =>
  (SPEEDS[settings.speed] ?? 1) *
  (settings.hunger >= STARVING_AT ? 0.6 : 1) *
  (personality() === "playful" ? 1.12 : personality() === "sleepy" ? 0.8 : 1);

// --- dom ---------------------------------------------------------------------

const el = {
  stage: document.getElementById("stage"),
  pet: document.getElementById("pet"),
  sprite: document.getElementById("sprite"),
  accessories: document.getElementById("accessories"),
  bubble: document.getElementById("bubble"),
  bubbleText: document.getElementById("bubble-text"),
  shadow: document.getElementById("shadow"),
  ring: document.getElementById("target-ring"),
  food: document.getElementById("food"),
  ball: document.getElementById("ball"),
  buddy: document.getElementById("buddy"),
  buddySprite: document.getElementById("buddy-sprite"),
  buddyAccessories: document.getElementById("buddy-accessories"),
  hearts: document.getElementById("hearts"),
  hunger: document.getElementById("hunger"),
  hungerFill: document.getElementById("hunger-fill"),
  countdown: document.getElementById("countdown"),
};

// --- settings ----------------------------------------------------------------
// Validated by preferences.js. Writes are patches, so a hunger tick can never
// clobber an edit the settings window made a moment earlier.

let settings = readSettings();
let savedSettings = structuredClone(settings);

function saveSettings() {
  try {
    const patch = Object.fromEntries(
      Object.entries(settings).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(savedSettings[key]),
      ),
    );
    if (Object.keys(patch).length === 0) return;
    settings = writeSettings(patch);
    savedSettings = structuredClone(settings);
  } catch (err) {
    console.error("Could not save PocketPet settings", err);
  }
}

const personality = (id = settings.pet) => settings.personalities[id] ?? "calm";
const petName = (id = pet.id) => settings.petNames[id] || getPet(id).name;

/** Bump a per-pet counter (and the global one) and refresh unlocks. */
function record(kind, amount = 1, id = pet.id) {
  saveSettings();
  try {
    settings = recordActivity(id, kind, amount);
    savedSettings = structuredClone(settings);
    applyAppearance();
  } catch (error) {
    console.error("Could not save pet progress", error);
  }
}

/** The settings window edited localStorage; pick up what changed. */
function reloadSettings(patch) {
  const fresh = readSettings();
  const before = settings;
  settings = fresh;
  savedSettings = structuredClone(fresh);
  const changed = (k) => JSON.stringify(before[k]) !== JSON.stringify(fresh[k]);
  if (games.isActive()) games.cancel();
  if (changed("size")) setSize(fresh.size, true);
  if (changed("pet") || changed("customPets")) mountPet(fresh.pet, true);
  if (changed("colors") || changed("accessories")) applyAppearance();
  if (changed("companion") || changed("customPets")) mountBuddy(fresh.companion);
  if (changed("breakMins") || changed("breakCycles") || changed("breakDuration")) {
    endBreak(false);
    scheduleBreak();
  }
  if (changed("shortcuts")) configureShortcuts();
  if (changed("lowPower")) invoke("set_low_power", { enabled: settings.lowPower }).catch(console.error);
  if (changed("toy")) applyToy();
  applyAppearance();
  updateFocus();
  if (patch && "sound" in patch && fresh.sound) playChirp();
  syncTray();
}

// --- pets --------------------------------------------------------------------

const GENERIC_LINES = {
  greet: ["Hi!", "I'm here."],
  idle: ["...", "Hm.", "What are we doing?"],
  click: ["!", "Hehe."],
  sleep: ["Zzz..."],
  drag: ["Whee!"],
  land: ["Oof."],
  close: ["Bye, window!"],
  minimize: ["Down you go."],
  mischief: ["Oops."],
  perch: ["I'll stay here."],
  call: ["Coming!"],
  welcome: ["Welcome back!"],
  hungry: ["Feed me?"],
  eat: ["Nom."],
  fetch: ["Got it!", "Ball!"],
};

/** Built-in pets plus any picture the user turned into one. */
function getPet(id) {
  const custom = settings.customPets.find((p) => p.id === id);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      emoji: "🖼️",
      food: "🍪",
      paw: { x: 0.7, y: 0.6 },
      svg: `<img class="custom-img" src="${custom.image}" alt="" draggable="false" />`,
      lines: GENERIC_LINES,
    };
  }
  return getBuiltinPet(id);
}

let pet = getPet(settings.pet);
const line = (key) => pick(pet.lines[key] ?? GENERIC_LINES[key] ?? ["..."]);

// --- geometry ----------------------------------------------------------------

/** Overlay geometry, filled in by `syncScreen`. */
let screen = { virtual: { x: 0, y: 0, w: 1920, h: 1080 }, scale: 1, monitors: [], work_areas: [] };

const state = {
  x: 200, // top-left of the pet box, CSS px inside the overlay
  y: 200,
  vx: 0,
  vy: 0,
  facing: 1,
  anim: "idle",
  /** "free" while the pet runs its own life; "mission" / "break" / "game" while busy. */
  mode: "free",
  grounded: false,
  /**
   * Set when the user drops the pet somewhere with nothing to stand on. It
   * clings there instead of falling, until it is dragged again or sent on a
   * mission.
   */
  perched: false,
  /** Name of the idle antic in progress, or null. */
  antic: null,
  /** Overlay hidden via tray/hotkey; timers keep running but nothing acts. */
  hidden: false,
  /** Hidden by focus mode specifically, so we know to bring it back. */
  focusHidden: false,
  /** Focus mode "quiet": no chatter, antics, sounds or nags. */
  quiet: false,
  autostart: false,
  /** "Feed"/"Throw" was chosen; the next click decides where it goes. */
  placing: null, // null | "food" | "buddyFood" | "ball"
  food: null, // { x, y, forBuddy } top-left, CSS px
  cursor: { x: 0, y: 0 }, // CSS px inside the overlay
  lastCursorMove: 0,
  windows: [],
  dragging: false,
  hovering: false,
  env: { fullscreen: false, onBattery: false },
};

const toCssX = (px) => (px - screen.virtual.x) / screen.scale;
const toCssY = (py) => (py - screen.virtual.y) / screen.scale;
const toPhysX = (cx) => Math.round(cx * screen.scale + screen.virtual.x);
const toPhysY = (cy) => Math.round(cy * screen.scale + screen.virtual.y);

const cssRect = (r) => ({
  x: toCssX(r.x),
  y: toCssY(r.y),
  w: r.w / screen.scale,
  h: r.h / screen.scale,
});

const footX = () => state.x + SIZE / 2;
const footY = () => state.y + SIZE;
const overlayW = () => screen.virtual.w / screen.scale;
const overlayH = () => screen.virtual.h / screen.scale;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const now = () => performance.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const monitorsCss = () => screen.monitors.map(cssRect);

/** The monitor under an overlay point, or the nearest one. */
function monitorAt(x, y) {
  const mons = monitorsCss();
  if (!mons.length) return { x: 0, y: 0, w: overlayW(), h: overlayH() };
  return nearestMonitor(mons, { x, y: y ?? 0 });
}

/**
 * Where the pet is allowed to be: the chosen monitor (or the one it is on)
 * inset by the roaming margin, optionally only its bottom strip.
 */
function roamBounds() {
  const mons = monitorsCss();
  const work = (screen.work_areas ?? []).map(cssRect);
  let index;
  if (settings.monitor !== "all" && mons[Number(settings.monitor)]) {
    index = Number(settings.monitor);
  } else {
    index = mons.indexOf(monitorAt(footX(), footY()));
  }
  const home = work[index] ?? mons[index] ?? { x: 0, y: 0, w: overlayW(), h: overlayH() };
  return insetBounds(home, settings.roamMargin, SIZE, settings.roamBottomOnly);
}

const avoidRect = (bounds) => exclusionRect(bounds, settings.avoidArea);

/** Bottom edge of the pet's allowed area, so it never sinks below a shorter monitor. */
function floorAt(x, y) {
  const b = roamBounds();
  const m = monitorAt(x, y);
  return Math.min(m.y + m.h, b.y + b.h);
}

// --- time of day -------------------------------------------------------------

const hour = () => new Date().getHours();
const isLateNight = () => hour() >= 23 || hour() < 5;

function timeGreeting() {
  const h = hour();
  const name = petName();
  if (h >= 5 && h < 11) return pick(["Morning! ☀️", "Good morning. Coffee first?", `${name} reporting for duty.`]);
  if (h >= 11 && h < 14) return pick(["Lunch soon?", "Midday already."]);
  if (h >= 18 && h < 23) return pick(["Evening. 🌇", "Winding down?"]);
  if (isLateNight()) return pick(["It's late. Go to bed, human. 🌙", "Sleep is a feature, you know."]);
  return null;
}

// --- sounds ------------------------------------------------------------------
// Everything is synthesised with WebAudio, so there are no files to ship.

let audioCtx = null;

function audio() {
  if (!settings.sound || state.quiet) return null;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

const gainFor = (ctx, level) => {
  const g = ctx.createGain();
  g.gain.value = (settings.volume / 100) * level;
  g.connect(ctx.destination);
  return g;
};

/** Short rising two-note chirp: greeting, menu confirm. */
function playChirp() {
  const ctx = audio();
  if (!ctx) return;
  const g = gainFor(ctx, 0.18);
  const o = ctx.createOscillator();
  o.type = "sine";
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(980, t + 0.09);
  o.frequency.setValueAtTime(880, t + 0.11);
  o.frequency.exponentialRampToValueAtTime(1240, t + 0.2);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.25);
}

/** Low rumbling purr for ~1.6 s. */
function playPurr() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const g = gainFor(ctx, 0.22);
  const base = ctx.createOscillator();
  base.type = "sawtooth";
  base.frequency.value = 27;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 180;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain).connect(g.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(g.gain.value || 0.2, t + 0.2);
  g.gain.setValueAtTime(g.gain.value, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  base.connect(lp).connect(g);
  base.start(t);
  lfo.start(t);
  base.stop(t + 1.65);
  lfo.stop(t + 1.65);
}

/** Three quick crunchy bites. */
function playMunch() {
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.22;
    const len = 0.09;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400 + Math.random() * 600;
    bp.Q.value = 1.2;
    const g = gainFor(ctx, 0.35);
    src.connect(bp).connect(g);
    src.start(t);
  }
}

/** Soft "boing" on landing / bounce. */
function playBoing() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const g = gainFor(ctx, 0.12);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(260, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.22);
}

// --- size / speed / break settings -------------------------------------------

function applySize() {
  SIZE = SIZES[settings.size] ?? SIZES.medium;
  document.documentElement.style.setProperty("--pet-size", `${SIZE}px`);
}

/** The tray menu lives in Rust and cannot see localStorage; keep its ticks honest. */
function syncTray() {
  invoke("sync_tray", {
    size: settings.size,
    speed: settings.speed,
    breakMins: [0, 25, 45, 60].includes(settings.breakMins) ? settings.breakMins : 0,
  }).catch(() => {});
}

function setSize(id, quiet) {
  if (!SIZES[id]) return;
  const anchorX = footX();
  const anchorY = footY();
  settings.size = id;
  applySize();
  // Keep the feet where they were so a resize does not teleport the pet.
  state.x = anchorX - SIZE / 2;
  state.y = anchorY - SIZE;
  if (!quiet) {
    saveSettings();
    syncTray();
  }
}

function setSpeed(id) {
  if (!SPEEDS[id]) return;
  settings.speed = id;
  saveSettings();
  syncTray();
}

function setBreak(mins) {
  settings.breakMins = Number(mins) || 0;
  saveSettings();
  syncTray();
  scheduleBreak();
}

// --- sprite & appearance -----------------------------------------------------

function mountPet(id, quiet) {
  pet = getPet(id);
  settings.pet = pet.id;
  saveSettings();
  applyAppearance();
  if (!quiet) {
    say(timeGreeting() ?? line("greet"));
    playChirp();
  }
}

// Colour picking works on the SVG itself: every fill in the pet's `tint`
// list is replaced by the chosen colour, keeping each fill's lightness
// offset from the first (the "base" body colour). Raster custom pets can't
// be recoloured this way and are left alone.

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function tintedSvg(p, color) {
  if (!color || !p.tint?.length) return p.svg;
  const target = hexToHsl(color);
  const base = hexToHsl(p.tint[0]);
  const map = new Map();
  for (const c of p.tint) {
    const src = hexToHsl(c);
    const l = clamp(target.l + (src.l - base.l), 0.04, 0.96);
    const s = clamp(target.s + (src.s - base.s) * 0.5, 0, 1);
    map.set(c.toLowerCase(), hslToHex(target.h, s, l));
  }
  const pattern = new RegExp([...map.keys()].join("|"), "gi");
  return p.svg.replace(pattern, (m) => map.get(m.toLowerCase()) ?? m);
}

/** Paint a sprite only when its colour/pet actually changed (innerHTML restarts CSS animations). */
function paintSprite(root, p, id) {
  const key = `${p.id}|${settings.colors[id] ?? ""}`;
  if (root.dataset.key === key) return;
  root.dataset.key = key;
  root.innerHTML = tintedSvg(p, settings.colors[id]);
}

function renderAccessories(container, id) {
  const items = settings.accessories[id] ?? [];
  const key = JSON.stringify(items);
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.innerHTML = "";
  for (const a of items) {
    const span = document.createElement("span");
    span.className = `acc acc-${a.slot}`;
    span.textContent = a.emoji;
    span.style.setProperty("--acc-size", a.size);
    span.style.setProperty("--acc-x", `${a.x}%`);
    span.style.setProperty("--acc-y", `${a.y}%`);
    container.append(span);
  }
}

/** Colour, accessories, personality and speech-bubble sizing for both animals. */
function applyAppearance() {
  paintSprite(el.sprite, pet, pet.id);
  renderAccessories(el.accessories, pet.id);
  el.pet.dataset.personality = settings.personalities[pet.id] ?? "calm";
  if (buddy.pet) {
    paintSprite(el.buddySprite, buddy.pet, buddy.pet.id);
    renderAccessories(el.buddyAccessories, buddy.pet.id);
    el.buddy.dataset.personality = settings.personalities[buddy.pet.id] ?? "calm";
  }
  document.documentElement.style.setProperty("--speech-size", `${settings.speechSize}px`);
  el.hunger.hidden = !settings.showHunger;
  paintHunger();
}

function setAnim(name) {
  if (state.anim === name) return;
  state.anim = name;
  el.pet.dataset.state = name;
}

function face(dir) {
  if (dir !== 0) state.facing = dir;
  el.pet.style.setProperty("--facing", state.facing);
}

// --- speech ------------------------------------------------------------------

let bubbleTimer = null;
let typeTimer = null;

function say(text, holdMs) {
  if (!text) return;
  clearTimeout(bubbleTimer);
  clearInterval(typeTimer);
  el.bubble.hidden = false;
  el.bubble.classList.remove("leaving");
  el.bubbleText.textContent = "";

  let i = 0;
  typeTimer = setInterval(() => {
    el.bubbleText.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typeTimer);
  }, 18);

  const base = holdMs ?? Math.max(1800, text.length * 65);
  const hold = holdMs != null && holdMs > 60_000 ? holdMs : base * (settings.speechDuration / 100);
  bubbleTimer = setTimeout(hideBubble, hold);
}

function hideBubble() {
  if (el.bubble.hidden) return;
  el.bubble.classList.add("leaving");
  setTimeout(() => {
    el.bubble.hidden = true;
    el.bubble.classList.remove("leaving");
  }, 180);
}

// --- surfaces ----------------------------------------------------------------

/**
 * The pet walks on the top edge of real windows, Shimeji-style, and on the
 * bottom of its allowed area otherwise. Returns the highest surface at or
 * below the pet's feet.
 */
function groundUnder(x, fromY) {
  let best = floorAt(x, fromY);
  for (const w of state.windows) {
    if (w.minimized) continue;
    const r = cssRect(w.rect);
    if (x < r.x + 6 || x > r.x + r.w - 6) continue;
    const top = r.y;
    if (top >= fromY - 4 && top < best) best = top;
  }
  return best;
}

/** Nearest window top *above* the feet within jumping reach, or null. */
function ledgeAbove(x, fromY) {
  let best = null;
  for (const w of state.windows) {
    if (w.minimized) continue;
    const r = cssRect(w.rect);
    if (x < r.x + 6 || x > r.x + r.w - 6) continue;
    const top = r.y;
    if (top < fromY - 8 && fromY - top <= HOP_REACH && (best == null || top > best)) best = top;
  }
  return best;
}

/** Is the pet standing on a window (not the floor), and how far to its edge? */
function ledgeInfo() {
  const gy = groundUnder(footX(), footY());
  if (gy >= floorAt(footX(), footY()) - 1) return null;
  for (const w of state.windows) {
    if (w.minimized) continue;
    const r = cssRect(w.rect);
    if (Math.abs(r.y - gy) > 2 || footX() < r.x || footX() > r.x + r.w) continue;
    return { rect: r, toLeft: footX() - r.x, toRight: r.x + r.w - footX() };
  }
  return null;
}

async function refreshWindows() {
  try {
    state.windows = await invoke("list_windows");
  } catch {
    state.windows = [];
  }
}

function scheduleWindowRefresh() {
  setTimeout(async () => {
    if (!state.hidden) await refreshWindows();
    scheduleWindowRefresh();
  }, state.hidden ? 5000 : lowPowerNow() ? 2500 : 700);
}

// --- main loop ---------------------------------------------------------------
// Runs on requestAnimationFrame normally. In low-power situations (hidden,
// asleep, on battery with the option on) it drops to ~15 fps on a timer.

let lastFrame = now();

function lowPowerNow() {
  return (
    state.hidden ||
    settings.lowPower ||
    (state.env.onBattery && settings.lowPower) ||
    (state.anim === "sleep" && state.mode === "free" && !buddy.pet)
  );
}

function scheduleFrame() {
  if (lowPowerNow()) setTimeout(frame, 66);
  else requestAnimationFrame(frame);
}

function frame() {
  const t = now();
  const dt = Math.min(0.05, (t - lastFrame) / 1000);
  lastFrame = t;

  if (state.hidden) {
    // Nothing to draw; just keep the clock honest.
    scheduleFrame();
    return;
  }

  if (games.isActive()) {
    games.tick(dt);
  } else if (state.dragging) {
    setAnim("drag");
  } else if (state.mode === "free") {
    stepFree(dt, t);
  }

  applyTransform();
  if (state.placing === "food" || state.placing === "buddyFood") {
    el.food.style.transform = `translate3d(${state.cursor.x - foodSize() / 2}px, ${state.cursor.y - foodSize() / 2}px, 0)`;
  }
  stepBall(dt);
  stepBuddy(dt, t);
  paintCountdown();
  reportHitRegions();
  scheduleFrame();
}

function stepFree(dt, t) {
  const cursorIdle = t - state.lastCursorMove;
  const chasing = settings.follow && !state.quiet && cursorIdle < SETTLE_AFTER && !state.perched;

  const ground = groundUnder(footX(), footY());
  const onGround = footY() >= ground - 1 && state.vy >= 0;

  if (state.perched) {
    state.vx = 0;
    state.vy = 0;
    setAnim(cursorIdle > SLEEP_AFTER() ? "sleep" : "idle");
    face(Math.sign(state.cursor.x - footX()) || state.facing);
  } else if (chasing) {
    state.antic = null; // the cursor moved: drop whatever the pet was doing
    const dx = state.cursor.x - footX();
    const dy = state.cursor.y - footY();
    const dist = Math.hypot(dx, dy);

    if (Math.abs(dx) > ARRIVE_RADIUS * 0.35 && dist > ARRIVE_RADIUS) {
      const speed = (dist > RUN_RADIUS ? RUN_SPEED : WALK_SPEED) * speedMul();
      state.vx = Math.sign(dx) * speed;
      face(Math.sign(dx));
      setAnim(dist > RUN_RADIUS ? "run" : "walk");

      // A ledge just ahead? Hop onto it instead of walking into its side.
      const ahead = footX() + Math.sign(dx) * 26;
      const aheadGround = groundUnder(ahead, footY());
      if (onGround && aheadGround < ground - 8 && ground - aheadGround < HOP_REACH) {
        state.vy = -Math.sqrt(2 * GRAVITY * (ground - aheadGround + 26));
      }
    } else {
      state.vx *= 0.82;
      setAnim(onGround ? "idle" : "walk");
      face(Math.sign(state.cursor.x - footX()) || state.facing);
      // Cursor is up on a window above us: climb onto it.
      if (onGround && dy < -60) {
        const up = ledgeAbove(footX(), footY());
        if (up != null && state.cursor.y < up + 40) {
          state.vy = -Math.sqrt(2 * GRAVITY * (footY() - up + 26));
          setAnim("walk");
        }
      }
    }
  } else if (state.antic === "wander") {
    // walking a few steps on its own; leave vx and the walk anim alone
  } else {
    state.vx *= 0.86;
    if (onGround && !state.antic) {
      setAnim(cursorIdle > SLEEP_AFTER() ? "sleep" : "idle");
    }
  }

  // Gravity always runs, so the pet drops onto whatever window is beneath it.
  if (!state.perched) {
    state.vy += GRAVITY * dt;
    state.x += state.vx * dt;
    state.y += state.vy * dt;
  }

  const landing = groundUnder(footX(), footY());
  if (!state.perched && state.y + SIZE >= landing) {
    const wasFalling = state.vy > 700;
    state.y = landing - SIZE;
    state.vy = 0;
    if (!state.grounded && wasFalling) {
      bounce();
      playBoing();
      if (Math.random() < 0.4 && !state.quiet) say(line("land"));
    }
    state.grounded = true;
  } else {
    state.grounded = false;
    if (state.vy > 60) setAnim("walk");
  }

  // Stay inside the roaming area and out of the protected region.
  const bounds = roamBounds();
  const kept = constrainPoint({ x: state.x, y: state.y }, bounds, SIZE, avoidRect(bounds));
  if (kept.x !== state.x) state.vx = 0;
  if (kept.y !== state.y && !state.perched) state.vy = 0;
  state.x = kept.x;
  state.y = kept.y;

  const height = Math.max(0, landing - (state.y + SIZE));
  el.shadow.style.setProperty("--shadow-scale", clamp(1 - height / 500, 0.45, 1));
  el.shadow.style.setProperty("--shadow-opacity", clamp(0.5 - height / 900, 0.12, 0.5));
  el.shadow.style.transform =
    `translate3d(${state.x}px, ${landing - 6}px, 0) scale(var(--shadow-scale, 1))`;
}

function bounce() {
  el.pet.classList.remove("landed");
  void el.pet.offsetWidth; // restart the CSS animation
  el.pet.classList.add("landed");
}

function applyTransform() {
  el.pet.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
}

// --- click-through hit testing ----------------------------------------------
// Tauri has no per-region hit testing, so the Rust cursor thread needs to know
// where the interactive bits are. Only push when something actually moved.

let lastRegionKey = "";

function reportHitRegions() {
  const regions = [rectOf(el.pet)];
  if (!el.bubble.hidden) regions.push(rectOf(el.bubble));
  if (menuEl) regions.push(rectOf(menuEl));
  if (buddy.pet) regions.push(rectOf(el.buddy));
  for (const r of games.hitRegions()) regions.push({ x: r.x, y: r.y, w: r.width, h: r.height });

  const physical = regions
    .filter(Boolean)
    .map((r) => ({
      x: toPhysX(r.x),
      y: toPhysY(r.y),
      w: Math.round(r.w * screen.scale),
      h: Math.round(r.h * screen.scale),
    }));

  const key = physical.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join("|");
  if (key === lastRegionKey) return;
  lastRegionKey = key;
  invoke("set_hit_regions", { regions: physical }).catch(() => {});
}

function rectOf(node) {
  const r = node.getBoundingClientRect();
  return r.width && r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
}

// --- tweened movement (used by missions) -------------------------------------

function tween(ms, fn) {
  return new Promise((resolve) => {
    const start = now();
    const tick = () => {
      const p = Math.min(1, (now() - start) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
}

/** Hop the pet to a point along a shallow arc, so it reads as a jump. */
async function moveTo(tx, ty) {
  const sx = state.x;
  const sy = state.y;
  const dist = Math.hypot(tx - sx, ty - sy);
  if (dist < 3) return;
  face(Math.sign(tx - sx) || state.facing);
  setAnim(dist > 320 ? "run" : "walk");
  const ms = clamp((dist / (RUN_SPEED * speedMul())) * 1000, 160, 1400);
  const arc = clamp(dist * 0.22, 10, 90);
  await tween(ms, (p) => {
    const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    state.x = sx + (tx - sx) * ease;
    state.y = sy + (ty - sy) * ease - Math.sin(Math.PI * ease) * arc;
    state.vx = 0;
    state.vy = 0;
    applyTransform();
  });
  state.x = tx;
  state.y = ty;
  setAnim("idle");
}

/** Extend the arm toward a screen rect and hold it there. */
async function reachAt(rect) {
  const shoulderX = state.x + SIZE * pet.paw.x * state.facing + (state.facing < 0 ? SIZE : 0);
  const shoulderY = state.y + SIZE * pet.paw.y;
  const dx = rect.x + rect.w / 2 - shoulderX;
  const dy = rect.y + rect.h / 2 - shoulderY;
  // The arm hangs downward at rest, so 0deg means "straight down".
  let angle = (Math.atan2(-dx, dy) * 180) / Math.PI;
  if (state.facing < 0) angle = -angle;
  const stretch = clamp(Math.hypot(dx, dy) / (SIZE * 0.32), 1, 2.6);

  el.pet.style.setProperty("--arm-angle", `${clamp(angle, -170, 170)}deg`);
  el.pet.style.setProperty("--arm-stretch", stretch.toFixed(2));
  setAnim("reach");
  await wait(260);
  // A short extra push sells the "press".
  el.pet.style.setProperty("--arm-stretch", (stretch * 1.12).toFixed(2));
  await wait(140);
  el.pet.style.setProperty("--arm-stretch", stretch.toFixed(2));
  await wait(120);
}

function resetArm() {
  el.pet.style.setProperty("--arm-angle", "0deg");
  el.pet.style.setProperty("--arm-stretch", "1");
  setAnim("idle");
}

// --- missions: walk over and press a real caption button ---------------------

function showRing(r) {
  Object.assign(el.ring.style, {
    transform: `translate3d(${r.x}px, ${r.y}px, 0)`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  });
  el.ring.hidden = false;
}

const hideRing = () => {
  el.ring.hidden = true;
};

/**
 * Send the pet to a window's caption button and have it press it.
 * `hwnd` omitted means "whatever the user is looking at".
 */
async function mission(which, hwnd) {
  if (state.mode !== "free") return;
  state.mode = "mission";
  state.perched = false;
  state.antic = null;
  try {
    let target;
    if (hwnd == null) {
      target = await invoke("get_foreground_window");
    } else {
      const buttons = await invoke("get_caption_buttons", { hwnd });
      const window = state.windows.find((w) => w.hwnd === hwnd);
      target = window && buttons ? { window, buttons } : null;
    }
    if (!target) {
      say("No window to poke!");
      return;
    }

    const rect = target.buttons[which];
    if (!rect) {
      say("I can't find that button. 🤔");
      return;
    }

    const r = cssRect(rect);
    showRing(r);

    // Stand on the titlebar line, just to one side of the button.
    const fromLeft = footX() <= r.x + r.w / 2;
    const standX = fromLeft ? r.x - SIZE * 0.8 : r.x + r.w - SIZE * 0.2;
    const standY = r.y + r.h - SIZE;
    await moveTo(clamp(standX, 0, overlayW() - SIZE), Math.max(0, standY));
    face(fromLeft ? 1 : -1);

    say(line(which), 1600);
    await reachAt(r);

    const ok = await invoke("press_caption_button", {
      hwnd: target.window.hwnd,
      which,
      realClick: settings.realClick,
    });
    if (!ok) say("That window said no. 😾");

    resetArm();
    hideRing();
    await wait(350);
    await refreshWindows();
  } catch (err) {
    say("Something went wrong.");
    console.error(err);
  } finally {
    resetArm();
    hideRing();
    state.mode = "free";
  }
}

// --- dragging ----------------------------------------------------------------

let dragOffset = { x: 0, y: 0 };
let dragHistory = [];

el.pet.addEventListener("pointerdown", (e) => {
  audio(); // first user gesture unlocks sound
  if (games.isActive()) return;
  if (state.placing) {
    e.stopPropagation();
    if (e.button === 0) placeAt(footX(), footY());
    else cancelPlacing();
    return;
  }
  if (e.button !== 0) return;
  if (state.mode === "mission") return;
  el.pet.setPointerCapture(e.pointerId);
  state.dragging = true;
  state.perched = false;
  state.vx = state.vy = 0;
  el.pet.classList.add("dragging");
  dragOffset = { x: e.clientX - state.x, y: e.clientY - state.y };
  dragHistory = [{ t: now(), x: e.clientX, y: e.clientY }];
  say(line("drag"), 1200);
});

el.pet.addEventListener("pointermove", (e) => {
  if (!state.dragging) return;
  state.x = e.clientX - dragOffset.x;
  state.y = e.clientY - dragOffset.y;
  dragHistory.push({ t: now(), x: e.clientX, y: e.clientY });
  if (dragHistory.length > 6) dragHistory.shift();
});

function endDrag(e) {
  if (!state.dragging) return;
  state.dragging = false;
  el.pet.classList.remove("dragging");
  // Throw the pet with whatever velocity the pointer had at release.
  const first = dragHistory[0];
  const last = dragHistory[dragHistory.length - 1];
  const dt = Math.max(16, last.t - first.t) / 1000;
  state.vx = clamp((last.x - first.x) / dt, -1600, 1600);
  state.vy = clamp((last.y - first.y) / dt, -1600, 1600);
  state.grounded = false;
  // A gentle drop with nothing underneath means "stay here". A throw still flies.
  const thrown = Math.hypot(state.vx, state.vy) > 260;
  const midAir = footY() < groundUnder(footX(), footY()) - 12;
  state.perched = !thrown && midAir;
  if (state.perched) {
    state.vx = state.vy = 0;
    say(line("perch"), 1400);
  }
  try {
    el.pet.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
}

el.pet.addEventListener("pointerup", endDrag);
el.pet.addEventListener("pointercancel", endDrag);

// --- pats, petting, double-click ---------------------------------------------

let patTimer = null;

el.pet.addEventListener("click", (e) => {
  if (games.onPetClick()) {
    e.stopPropagation();
    return;
  }
  // A click that followed a real drag isn't a pat.
  const first = dragHistory[0];
  const last = dragHistory[dragHistory.length - 1];
  if (first && last && Math.hypot(last.x - first.x, last.y - first.y) > 6) return;
  if (state.mode === "break") {
    endBreak(true);
    e.stopPropagation();
    return;
  }
  if (state.mode !== "free") return;
  state.antic = null;
  record("pats");
  setAnim("happy");
  say(line("click"));
  playChirp();
  clearTimeout(patTimer);
  patTimer = setTimeout(() => setAnim("idle"), 1300);
  e.stopPropagation();
});

/** Rest the cursor on the pet for a moment and it purrs, no click needed. */
let hoverTimer = null;

el.pet.addEventListener("pointerenter", () => {
  state.hovering = true;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(petting, 900);
});

el.pet.addEventListener("pointerleave", () => {
  state.hovering = false;
  clearTimeout(hoverTimer);
});

function petting() {
  if (!state.hovering || state.dragging || state.mode !== "free" || state.placing) return;
  record("pets");
  setAnim("happy");
  playPurr();
  spawnHearts(3, state.x, state.y, SIZE);
  clearTimeout(patTimer);
  patTimer = setTimeout(() => setAnim("idle"), 1500);
  hoverTimer = setTimeout(petting, 2600);
}

function spawnHearts(n, x0, y0, size) {
  for (let i = 0; i < n; i++) {
    const h = document.createElement("span");
    h.className = "heart";
    h.textContent = pick(["❤", "💛", "🧡"]);
    const x = x0 + size * (0.25 + Math.random() * 0.5);
    const y = y0 + size * 0.2;
    h.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    h.style.setProperty("--drift", `${(Math.random() - 0.5) * 40}px`);
    h.style.animationDelay = `${i * 140}ms`;
    el.hearts.appendChild(h);
    setTimeout(() => h.remove(), 1600 + i * 140);
  }
}

/** Double-click: hop up onto the window you are working in and stay there. */
el.pet.addEventListener("dblclick", async (e) => {
  e.stopPropagation();
  if (state.mode !== "free" || state.dragging) return;
  clearTimeout(patTimer);
  const target = await invoke("get_foreground_window").catch(() => null);
  if (!target) {
    say("No window to sit on!");
    return;
  }
  state.mode = "mission"; // borrow the mode so free-roam does not fight moveTo
  state.antic = null;
  try {
    say(line("call"), 1200);
    const r = cssRect(target.window.rect);
    const tx = clamp(r.x + r.w - SIZE * 1.6, 0, overlayW() - SIZE);
    const ty = Math.max(0, r.y - SIZE);
    await moveTo(tx, ty);
    state.perched = true;
    state.grounded = true;
  } finally {
    state.mode = "free";
  }
});

// --- right-click menu on the pet --------------------------------------------
// Plain HTML so it can show live values (hunger, current size). Arrow keys,
// Enter and Escape work once it is open; it follows the system light/dark theme.

let menuEl = null;

function closeMenu() {
  menuEl?.remove();
  menuEl = null;
  document.removeEventListener("keydown", onMenuKey, true);
}

function menuItems() {
  const toy = TOYS[settings.toy] ?? TOYS.ball;
  const hungerPct = Math.round(settings.hunger);
  return [
    ["Ask me to do something… 🌐", () => invoke("open_tasks").catch(() => say("Couldn't open the task window."))],
    ["Say something", () => say(line("idle"))],
    [`Feed ${pet.food}   (hunger ${hungerPct}%)`, () => startPlacing("food")],
    ...(buddy.pet
      ? [[`Feed ${petName(buddy.pet.id)} ${buddy.pet.food}   (${Math.round(settings.buddyHunger)}%)`, () => startPlacing("buddyFood")]]
      : []),
    [`Throw ${toy.name.toLowerCase()} ${toy.emoji}`, () => startPlacing("ball")],
    ["Play: obstacle jump 🪵", () => games.start("jump")],
    ["Play: hide & seek 📦", () => games.start("hide")],
    ["Stats", () => showStats()],
    ["separator"],
    ["Minimise active window", () => mission("minimize")],
    ["Close active window", () => confirmClose()],
    ["separator"],
    ...Object.values(PETS).map((p) => [
      `${p.emoji}  ${settings.petNames[p.id] || p.name}${p.id === pet.id ? "  ✓" : ""}`,
      () => mountPet(p.id),
    ]),
    ...settings.customPets.map((p) => [
      `🖼️  ${p.name}${p.id === pet.id ? "  ✓" : ""}`,
      () => mountPet(p.id),
    ]),
    ["separator"],
    [`Follow cursor: ${settings.follow ? "on" : "off"}`, () => toggle("follow")],
    [`Sound: ${settings.sound ? "on" : "off"}`, () => toggle("sound")],
    [`Size: ${settings.size}  ›`, () => setSize(cycle(Object.keys(SIZES), settings.size))],
    [`Speed: ${settings.speed}  ›`, () => setSpeed(cycle(Object.keys(SPEEDS), settings.speed))],
    [
      `Break reminder: ${settings.breakMins ? `${settings.breakMins} min` : "off"}  ›`,
      () => setBreak(cycle([0, 25, 45, 60], [0, 25, 45, 60].includes(settings.breakMins) ? settings.breakMins : 0)),
    ],
    ["Settings…", () => invoke("open_settings").catch(() => say("Couldn't open settings."))],
    ["separator"],
    [`Run at startup: ${state.autostart ? "on" : "off"}`, () => toggleAutostart()],
    [`Hide pet  (${settings.shortcuts.toggle || "no hotkey"})`, () => invoke("set_hidden", { hidden: true })],
    ["separator"],
    ["Quit PocketPet", () => invoke("quit_app")],
  ];
}

function openMenu(x, y) {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "pet-menu";
  menu.setAttribute("role", "menu");

  for (const [label, action] of menuItems()) {
    if (label === "separator") {
      const hr = document.createElement("div");
      hr.className = "sep";
      menu.appendChild(hr);
      continue;
    }
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "menuitem");
    row.tabIndex = -1;
    row.textContent = label;
    row.addEventListener("pointerenter", () => row.focus());
    row.addEventListener("click", () => {
      closeMenu();
      action();
    });
    menu.appendChild(row);
  }

  el.stage.appendChild(menu);
  menuEl = menu;
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = `${clamp(x, 4, overlayW() - mw - 4)}px`;
  menu.style.top = `${clamp(y, 4, overlayH() - mh - 4)}px`;
  menu.querySelector(".row")?.focus();
  document.addEventListener("keydown", onMenuKey, true);
  setTimeout(() => document.addEventListener("pointerdown", onOutside, { once: true }), 0);
}

function onMenuKey(e) {
  if (!menuEl) return;
  const rows = [...menuEl.querySelectorAll(".row")];
  const i = rows.indexOf(document.activeElement);
  if (e.key === "Escape") closeMenu();
  else if (e.key === "ArrowDown") rows[(i + 1) % rows.length]?.focus();
  else if (e.key === "ArrowUp") rows[(i - 1 + rows.length) % rows.length]?.focus();
  else if (e.key === "Home") rows[0]?.focus();
  else if (e.key === "End") rows[rows.length - 1]?.focus();
  else if (e.key === "Enter" || e.key === " ") document.activeElement?.click();
  else return;
  e.preventDefault();
  e.stopPropagation();
}

function onOutside(e) {
  if (menuEl && !menuEl.contains(e.target)) closeMenu();
}

el.pet.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (state.placing) return; // that right-click was "cancel"
  if (state.mode === "break") return snoozeBreak();
  if (games.isActive()) return;
  openMenu(e.clientX + 8, e.clientY + 8);
});

function toggle(key) {
  settings[key] = !settings[key];
  saveSettings();
  const name = { realClick: "Real clicks", follow: "Follow cursor", sound: "Sound" }[key] ?? key;
  say(`${name} ${settings[key] ? "on" : "off"}`, 1400);
  if (key === "sound" && settings.sound) playChirp();
}

/** Next entry after `current`, wrapping around. */
const cycle = (list, current) => list[(list.indexOf(current) + 1) % list.length];

async function toggleAutostart() {
  const want = !state.autostart;
  const ok = await invoke("set_autostart", { enabled: want }).catch(() => false);
  state.autostart = ok ? want : state.autostart;
  say(ok ? `Run at startup ${want ? "on" : "off"}` : "Couldn't change startup setting.", 1600);
}

// --- stats -------------------------------------------------------------------

function showStats() {
  const p = profileFor(settings, pet.id);
  const days = Math.max(1, Math.round((Date.now() - p.firstRun) / 86_400_000));
  const bar = (v) => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
  const done = milestonesFor(p).filter((m) => m.unlocked).length;
  say(
    [
      `${pet.emoji} ${petName()} — day ${days} together · ${personality()}`,
      `Hunger  ${bar(settings.hunger)} ${Math.round(settings.hunger)}%`,
      `Meals ${p.meals} · Pats ${p.pats} · Cuddles ${p.pets}`,
      `Fetches ${p.fetches} · Games ${p.games} · Wins ${p.wins} · Breaks ${p.breaks}`,
      `Milestones ${done}/3 — full dashboard in Settings…`,
    ].join("\n"),
    8000,
  );
}

/**
 * Closing someone's window can lose unsaved work, so it is never automatic:
 * the pet asks first and only acts on a second, explicit confirmation.
 */
async function confirmClose() {
  const target = await invoke("get_foreground_window");
  if (!target) {
    say("Nothing focused to close.");
    return;
  }
  const title = target.window.title.slice(0, 40);
  say(`Close "${title}"?\nClick me to confirm.`, 5000);
  const onConfirm = () => {
    clearTimeout(timeout);
    el.pet.removeEventListener("click", onConfirm, true);
    mission("close", target.window.hwnd);
  };
  el.pet.addEventListener("click", onConfirm, true);
  const timeout = setTimeout(() => {
    el.pet.removeEventListener("click", onConfirm, true);
  }, 5000);
}

// --- placing things (food, toy) ---------------------------------------------
// "Feed"/"Throw" turn the whole overlay clickable for one click so the user can
// point anywhere; the Rust cursor thread honours `set_capture_all`.

let placeTimer = null;
const foodSize = () => SIZE * 0.5;
const ballSize = () => SIZE * 0.36;

function startPlacing(kind) {
  if (state.mode !== "free" || state.dragging || state.placing || games.isActive()) return;
  if (kind === "buddyFood" && !buddy.pet) return;
  state.placing = kind;
  if (kind === "food" || kind === "buddyFood") {
    el.food.textContent = kind === "buddyFood" ? buddy.pet.food : pet.food;
    el.food.style.fontSize = `${foodSize()}px`;
    el.food.classList.remove("eaten");
    el.food.classList.add("placing");
    el.food.hidden = false;
    say("Click anywhere to put the food down.\nRight-click to cancel.", 15_000);
  } else {
    const toy = TOYS[settings.toy] ?? TOYS.ball;
    say(`Click where to throw the ${toy.name.toLowerCase()}.\nRight-click to cancel.`, 15_000);
  }
  invoke("set_capture_all", { enabled: true }).catch(() => {});
  document.addEventListener("pointerdown", onPlaceClick, true);
  placeTimer = setTimeout(cancelPlacing, 15_000);
}

function onPlaceClick(e) {
  if (!state.placing) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.button === 0) placeAt(e.clientX, e.clientY);
  else cancelPlacing();
}

function stopPlacing() {
  clearTimeout(placeTimer);
  document.removeEventListener("pointerdown", onPlaceClick, true);
  const kind = state.placing;
  state.placing = null;
  el.food.classList.remove("placing");
  invoke("set_capture_all", { enabled: false }).catch(() => {});
  return kind;
}

function cancelPlacing() {
  if (!state.placing) return;
  const kind = stopPlacing();
  if (kind === "food" || kind === "buddyFood") el.food.hidden = true;
  hideBubble();
}

function placeAt(x, y) {
  const kind = stopPlacing();
  hideBubble();
  if (kind === "food") placeFood(x, y, false);
  else if (kind === "buddyFood") placeFood(x, y, true);
  else if (kind === "ball") throwBall(x, y);
}

// --- feeding -----------------------------------------------------------------

let hungerSaidAt = 0;

function tickHunger() {
  const nowMs = Date.now();
  const elapsed = Math.max(0, nowMs - settings.hungerAt);
  const before = settings.hunger;
  settings.hunger = hungerAfter(settings.hunger, elapsed, settings.hungerRate);
  settings.buddyHunger = hungerAfter(settings.buddyHunger, elapsed, settings.hungerRate);
  settings.hungerAt = nowMs;
  saveSettings();
  paintHunger();
  // Say something once when crossing into hungry, not every tick.
  const crossed = before < HUNGRY_AT && settings.hunger >= HUNGRY_AT;
  if (crossed && state.mode === "free" && !state.quiet && now() - hungerSaidAt > 60_000) {
    hungerSaidAt = now();
    say(line("hungry"));
  }
}

function paintHunger() {
  const v = clamp(settings.hunger, 0, 100);
  el.hungerFill.style.width = `${100 - v}%`;
  el.hunger.dataset.level = v >= STARVING_AT ? "starving" : v >= HUNGRY_AT ? "hungry" : "ok";
  el.hunger.title = `${petName()}: ${Math.round(100 - v)}% full`;
}

/** Drop the food at (x, y): it lands on whatever ledge is beneath that point. */
function placeFood(x, y, forBuddy) {
  const size = foodSize();
  const floor = groundUnder(x, y);
  state.food = { x: clamp(x - size / 2, 0, overlayW() - size), y: floor - size, forBuddy };
  el.food.style.transform = `translate3d(${state.food.x}px, ${state.food.y}px, 0)`;
  if (forBuddy) buddyEatMission();
  else eatMission();
}

async function eatMission() {
  if (state.mode !== "free" || !state.food) return;
  state.mode = "mission";
  state.perched = false;
  state.antic = null;
  try {
    const food = state.food;
    const size = foodSize();
    const foodCx = food.x + size / 2;
    const fromLeft = footX() <= foodCx;
    const standX = fromLeft ? foodCx - SIZE * 0.78 : foodCx - SIZE * 0.22;
    await moveTo(clamp(standX, 0, overlayW() - SIZE), food.y + size - SIZE);
    face(fromLeft ? 1 : -1);
    setAnim("eat");
    el.food.classList.add("eaten");
    playMunch();
    await wait(1700);
    el.food.hidden = true;
    state.food = null;
    settings.hunger = clamp(settings.hunger - 55, 0, 100);
    settings.hungerAt = Date.now();
    record("meals");
    paintHunger();
    setAnim("happy");
    say(line("eat"));
    await wait(900);
  } finally {
    setAnim("idle");
    state.mode = "free";
  }
}

// --- toys / fetch ------------------------------------------------------------

const ball = {
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  carried: false,
  returnTo: null, // where the user was when they threw it
  fadeTimer: null,
};

function applyToy() {
  const toy = TOYS[settings.toy] ?? TOYS.ball;
  el.ball.textContent = toy.emoji;
}

function throwBall(tx, ty) {
  clearTimeout(ball.fadeTimer);
  applyToy();
  el.ball.classList.remove("fading");
  el.ball.style.fontSize = `${ballSize()}px`;
  el.ball.hidden = false;
  // Launch from the pet toward the click along a lob.
  ball.active = true;
  ball.carried = false;
  ball.x = footX() - ballSize() / 2;
  ball.y = state.y + SIZE * 0.4;
  const dx = tx - ball.x;
  const flight = clamp(Math.abs(dx) / 700, 0.45, 1.1);
  ball.vx = dx / flight;
  ball.vy = ((ty - ballSize() - ball.y) - 0.5 * GRAVITY * flight * flight) / flight;
  ball.returnTo = { x: state.cursor.x, y: state.cursor.y };
  record("fetches");
  playChirp();
  setTimeout(fetchMission, 350);
}

function stepBall(dt) {
  if (!ball.active) return;
  const toy = TOYS[settings.toy] ?? TOYS.ball;
  const size = ballSize();
  if (ball.carried) {
    // Held in front of the pet.
    ball.x = state.x + (state.facing > 0 ? SIZE * 0.72 : SIZE * 0.28 - size);
    ball.y = state.y + SIZE * 0.55;
  } else {
    // Frisbees glide; balls drop.
    ball.vy += GRAVITY * dt * (settings.toy === "frisbee" ? 0.45 : 1);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const floor = groundUnder(ball.x + size / 2, ball.y + size);
    if (ball.y + size >= floor) {
      ball.y = floor - size;
      if (ball.vy > 120) {
        ball.vy = -ball.vy * toy.bounce;
        playBoing();
      } else ball.vy = 0;
      ball.vx *= toy.friction; // rolling friction
    }
    if (ball.x < 0 || ball.x + size > overlayW()) {
      ball.x = clamp(ball.x, 0, overlayW() - size);
      ball.vx = -ball.vx * 0.6;
    }
    if (Math.abs(ball.vx) < 4 && ball.vy === 0) ball.vx = 0;
  }
  el.ball.style.transform = `translate3d(${ball.x}px, ${ball.y}px, 0) rotate(${ball.x * 3}deg)`;
}

async function fetchMission() {
  if (state.mode !== "free" || !ball.active) return;
  state.mode = "mission";
  state.perched = false;
  state.antic = null;
  try {
    // Chase until close; the ball is still rolling, so re-aim each hop.
    for (let i = 0; i < 8 && ball.active; i++) {
      const size = ballSize();
      const bx = ball.x + size / 2;
      const by = ball.y + size;
      const fromLeft = footX() <= bx;
      const standX = fromLeft ? bx - SIZE * 0.72 : bx - SIZE * 0.28;
      await moveTo(clamp(standX, 0, overlayW() - SIZE), groundUnder(bx, by) - SIZE);
      face(fromLeft ? 1 : -1);
      if (Math.abs(footX() - bx) < SIZE * 0.6 && Math.abs(footY() - by) < SIZE * 0.6) break;
      await wait(120);
    }
    ball.carried = true;
    ball.vx = ball.vy = 0;
    say(line("fetch"), 1200);
    // Bring it back to where the user was, or just to the cursor now.
    const to = ball.returnTo ?? state.cursor;
    const homeX = clamp(to.x - SIZE / 2, 0, overlayW() - SIZE);
    await moveTo(homeX, groundUnder(to.x, to.y) - SIZE);
    face(Math.sign(state.cursor.x - footX()) || state.facing);
    ball.carried = false;
    ball.vx = state.facing * 90;
    ball.vy = -220;
    setAnim("happy");
    await wait(900);
  } finally {
    setAnim("idle");
    state.mode = "free";
    ball.fadeTimer = setTimeout(() => {
      el.ball.classList.add("fading");
      setTimeout(() => {
        el.ball.hidden = true;
        ball.active = false;
      }, 700);
    }, 6000);
  }
}

// --- games -------------------------------------------------------------------
// The games module drives the pet directly through this small API and hands
// it back when the game ends.

const games = createGames({
  stage: el.stage,
  setPet(x, y) {
    state.x = x;
    state.y = y;
    state.vx = state.vy = 0;
  },
  repaint: applyTransform,
  getBounds: () => roamBounds(),
  getPet: () => ({ x: state.x, y: state.y, size: SIZE }),
  setAnim,
  setBusy(busy) {
    state.mode = busy ? "game" : "free";
    state.perched = false;
    state.antic = null;
    if (busy) {
      cancelPlacing();
      hideBubble();
    } else {
      state.grounded = false;
    }
  },
  busy: () => state.mode !== "free" || state.dragging || Boolean(state.placing),
  hidden: () => state.hidden,
  say,
  sound: playChirp,
  record: (kind) => record(kind),
});

// --- companion ---------------------------------------------------------------
// A second animal that tags along behind the main pet. It can be fed, patted
// and petted like the first one; its brain is just "walk toward my spot, fall
// onto ledges, copy the mood".

const buddy = { pet: null, x: 0, y: 0, vx: 0, vy: 0, facing: 1, anim: "idle", busy: false, hovering: false };
const buddySize = () => SIZE * 0.85;

function mountBuddy(id) {
  settings.companion = id || "";
  if (!id) {
    buddy.pet = null;
    el.buddy.hidden = true;
    return;
  }
  buddy.pet = getPet(id);
  el.buddy.hidden = false;
  buddy.x = state.x - SIZE * 1.3;
  buddy.y = state.y;
  applyAppearance();
}

function setBuddyAnim(name) {
  if (buddy.anim === name) return;
  buddy.anim = name;
  el.buddy.dataset.state = name;
}

function stepBuddy(dt, t) {
  if (!buddy.pet || state.hidden || buddy.busy) return;
  const size = buddySize();
  const fx = buddy.x + size / 2;
  const fy = buddy.y + size;
  // Its spot: a body-length behind the pet, on the side away from where it faces.
  // If the toy is loose it wants that instead.
  const targetX = ball.active && !ball.carried ? ball.x + ballSize() / 2 + size * 0.7 : footX() - state.facing * SIZE * 1.15;
  const dx = targetX - fx;
  const ground = groundUnder(fx, fy);
  const onGround = fy >= ground - 1 && buddy.vy >= 0;

  if (state.dragging || state.mode === "break" || games.isActive()) {
    buddy.vx *= 0.85;
    if (onGround) setBuddyAnim(state.mode === "break" ? "stretch" : "idle");
  } else if (Math.abs(dx) > 40) {
    const speed = (Math.abs(dx) > 400 ? RUN_SPEED : WALK_SPEED) * speedMul();
    buddy.vx = Math.sign(dx) * speed;
    buddy.facing = Math.sign(dx);
    setBuddyAnim(Math.abs(dx) > 400 ? "run" : "walk");
    const aheadGround = groundUnder(fx + Math.sign(dx) * 26, fy);
    if (onGround && aheadGround < ground - 8 && ground - aheadGround < HOP_REACH) {
      buddy.vy = -Math.sqrt(2 * GRAVITY * (ground - aheadGround + 26));
    }
  } else {
    buddy.vx *= 0.8;
    if (onGround) setBuddyAnim(state.anim === "sleep" ? "sleep" : "idle");
    buddy.facing = Math.sign(footX() - fx) || buddy.facing;
  }

  buddy.vy += GRAVITY * dt;
  buddy.x += buddy.vx * dt;
  buddy.y += buddy.vy * dt;
  const landing = groundUnder(buddy.x + size / 2, buddy.y + size);
  if (buddy.y + size >= landing) {
    buddy.y = landing - size;
    buddy.vy = 0;
  }
  const bounds = roamBounds();
  const kept = constrainPoint({ x: buddy.x, y: buddy.y }, bounds, size, avoidRect(bounds));
  buddy.x = kept.x;
  buddy.y = kept.y;
  paintBuddy();
}

function paintBuddy() {
  el.buddy.style.setProperty("--facing", buddy.facing);
  el.buddy.style.transform = `translate3d(${buddy.x}px, ${buddy.y}px, 0)`;
}

async function buddyEatMission() {
  if (!buddy.pet || !state.food) return;
  buddy.busy = true;
  try {
    const food = state.food;
    const size = foodSize();
    const bsize = buddySize();
    const foodCx = food.x + size / 2;
    const fromLeft = buddy.x + bsize / 2 <= foodCx;
    const tx = clamp(fromLeft ? foodCx - bsize * 0.78 : foodCx - bsize * 0.22, 0, overlayW() - bsize);
    const ty = food.y + size - bsize;
    buddy.facing = fromLeft ? 1 : -1;
    setBuddyAnim("run");
    const sx = buddy.x;
    const sy = buddy.y;
    const ms = clamp((Math.hypot(tx - sx, ty - sy) / (RUN_SPEED * speedMul())) * 1000, 160, 1400);
    await tween(ms, (p) => {
      buddy.x = sx + (tx - sx) * p;
      buddy.y = sy + (ty - sy) * p - Math.sin(Math.PI * p) * 30;
      paintBuddy();
    });
    setBuddyAnim("eat");
    el.food.classList.add("eaten");
    playMunch();
    await wait(1700);
    el.food.hidden = true;
    state.food = null;
    settings.buddyHunger = clamp(settings.buddyHunger - 55, 0, 100);
    record("meals", 1, buddy.pet.id);
    setBuddyAnim("happy");
    say(`${petName(buddy.pet.id)}: ${pick(buddy.pet.lines.eat ?? GENERIC_LINES.eat)}`, 1800);
    await wait(900);
  } finally {
    setBuddyAnim("idle");
    buddy.busy = false;
  }
}

// Pats and petting for the companion, mirroring the main pet.
let buddyPatTimer = null;
let buddyHoverTimer = null;

el.buddy.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!buddy.pet || buddy.busy || games.isActive()) return;
  record("pats", 1, buddy.pet.id);
  setBuddyAnim("happy");
  playChirp();
  say(`${petName(buddy.pet.id)}: ${pick(buddy.pet.lines.click ?? GENERIC_LINES.click)}`, 1500);
  clearTimeout(buddyPatTimer);
  buddyPatTimer = setTimeout(() => setBuddyAnim("idle"), 1300);
});

el.buddy.addEventListener("pointerenter", () => {
  buddy.hovering = true;
  clearTimeout(buddyHoverTimer);
  buddyHoverTimer = setTimeout(buddyPetting, 900);
});

el.buddy.addEventListener("pointerleave", () => {
  buddy.hovering = false;
  clearTimeout(buddyHoverTimer);
});

function buddyPetting() {
  if (!buddy.hovering || !buddy.pet || buddy.busy) return;
  record("pets", 1, buddy.pet.id);
  setBuddyAnim("happy");
  playPurr();
  spawnHearts(3, buddy.x, buddy.y, buddySize());
  clearTimeout(buddyPatTimer);
  buddyPatTimer = setTimeout(() => setBuddyAnim("idle"), 1500);
  buddyHoverTimer = setTimeout(buddyPetting, 2600);
}

el.buddy.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (state.placing || games.isActive()) return;
  openMenu(e.clientX + 8, e.clientY + 8);
});

// --- break reminder ----------------------------------------------------------
// Any interval. Click the pet = "I'm back"; right-click the pet = snooze.
// With work/break cycles on, the break itself is timed and ends on its own.

let breakTimer = null;
let breakDismiss = null;
let breakDueAt = 0; // performance.now() when the next reminder fires
let breakEndsAt = 0; // during a timed break: when it ends
let breakStartedAt = 0;

/** (Re)arm the reminder. `ms` overrides the configured interval (used to snooze). */
function scheduleBreak(ms) {
  clearTimeout(breakTimer);
  breakDueAt = 0;
  if (!settings.breakMins) return;
  const delay = ms ?? settings.breakMins * 60_000;
  breakDueAt = now() + delay;
  breakTimer = setTimeout(startBreak, delay);
}

async function startBreak() {
  breakDueAt = 0;
  if (state.hidden || state.quiet) {
    // Can't nag on screen; use a toast instead and try again next interval.
    if (settings.toasts) {
      invoke("notify", {
        title: "Break time",
        body: `${settings.breakMins} minutes done. Stand up, stretch, look far away.`,
      }).catch(() => {});
    }
    scheduleBreak();
    return;
  }
  // Busy: try again in a minute rather than skipping the break.
  if (state.mode !== "free" || state.dragging) {
    scheduleBreak(60_000);
    return;
  }
  state.mode = "break";
  state.perched = false;
  state.antic = null;
  breakStartedAt = now();
  breakEndsAt = settings.breakCycles ? now() + settings.breakDuration * 60_000 : 0;
  try {
    const b = roamBounds();
    const cx = b.x + b.w / 2 - SIZE / 2;
    const floor = groundUnder(cx + SIZE / 2, b.y + b.h);
    await moveTo(cx, floor - SIZE);
    setAnim("stretch");
    playChirp();
    const tail = settings.breakCycles
      ? `\nBreak: ${settings.breakDuration} min. Click me if you're back early.`
      : "\nClick me when you're back.";
    say(
      `Break time! ${settings.breakMins} minutes done.\nStand up, stretch, look far away.${tail}\nRight-click me to snooze ${settings.breakSnooze} min.`,
      10 * 60_000,
    );
    await new Promise((resolve) => {
      breakDismiss = resolve;
      if (breakEndsAt) setTimeout(() => breakDismiss?.(), breakEndsAt - now());
    });
  } finally {
    breakDismiss = null;
    breakEndsAt = 0;
    if (state.mode === "break") state.mode = "free";
    setAnim("idle");
    if (!breakDueAt) scheduleBreak();
  }
}

function endBreak(byUser) {
  if (state.mode !== "break") return;
  hideBubble();
  const tookIt = now() - breakStartedAt > 45_000;
  if (tookIt) record("breaks");
  breakDismiss?.();
  if (byUser) setTimeout(() => say(line("welcome"), 1600), 250);
}

function snoozeBreak() {
  if (state.mode !== "break") return;
  hideBubble();
  breakDismiss?.();
  scheduleBreak(settings.breakSnooze * 60_000);
  setTimeout(() => say(`Okay, ${settings.breakSnooze} more minutes.`, 1600), 250);
}

/** Small "next break in 12:34" pill above the pet. */
function paintCountdown() {
  if (!settings.showCountdown || !settings.breakMins || state.hidden) {
    el.countdown.hidden = true;
    return;
  }
  let text;
  if (state.mode === "break" && breakEndsAt) text = `break ${formatCountdown(breakEndsAt - now())}`;
  else if (breakDueAt) text = `break in ${formatCountdown(breakDueAt - now())}`;
  else {
    el.countdown.hidden = true;
    return;
  }
  el.countdown.hidden = false;
  if (el.countdown.textContent !== text) el.countdown.textContent = text;
  el.countdown.style.transform = `translate3d(${state.x + SIZE / 2}px, ${state.y - 14}px, 0)`;
}

// --- focus mode ---------------------------------------------------------------
// Fullscreen app in front, or inside quiet hours: hide the pet, or keep it but
// silent and still ("quiet"). Restores itself when the condition clears.

let envTimer = null;

async function pollEnvironment() {
  clearTimeout(envTimer);
  try {
    const env = await invoke("get_environment");
    state.env = { fullscreen: Boolean(env.fullscreen), onBattery: Boolean(env.on_battery) };
  } catch {
    /* keep the last reading */
  }
  updateFocus();
  envTimer = setTimeout(pollEnvironment, lowPowerNow() ? 5000 : 2000);
}

function updateFocus() {
  const active = focusActive(settings, state.env);
  const wantHide = active && settings.focusAction === "hide";
  const wantQuiet = active && settings.focusAction === "quiet";

  if (wantHide !== state.focusHidden) {
    state.focusHidden = wantHide;
    invoke("set_focus_hidden", { hidden: wantHide }).catch((err) => console.error(err));
  }

  if (wantQuiet !== state.quiet) {
    state.quiet = wantQuiet;
    el.stage.classList.toggle("quiet", wantQuiet);
    if (wantQuiet) {
      cancelPlacing();
      hideBubble();
      state.antic = null;
    }
  }
}

// --- shortcuts ----------------------------------------------------------------

async function configureShortcuts() {
  try {
    const bad = await invoke("set_hotkeys", { shortcuts: settings.shortcuts });
    if (bad.length) say(`Couldn't bind: ${bad.join(", ")}. Check Settings › Controls.`, 4000);
  } catch (err) {
    console.error(err);
  }
}

// --- idle antics -------------------------------------------------------------
// Small things the pet does on its own once the cursor has been still a while,
// so it feels alive without being a distraction.

const ANTICS = ["yawn", "stretch", "look", "spin", "wander"];
let anticTimer = null;

function scheduleAntic() {
  clearTimeout(anticTimer);
  const mul = personality() === "playful" ? 0.6 : personality() === "sleepy" ? 1.6 : 1;
  anticTimer = setTimeout(tryAntic, (9_000 + Math.random() * 16_000) * mul);
}

async function tryAntic() {
  const idle = now() - state.lastCursorMove;
  const calm =
    state.mode === "free" &&
    !state.dragging &&
    !state.hidden &&
    !state.quiet &&
    !state.placing &&
    state.grounded &&
    !state.antic &&
    idle > 6_000 &&
    idle < SLEEP_AFTER();
  if (calm) {
    // Standing near the edge of a window: peek over it instead.
    const ledge = ledgeInfo();
    const nearEdge = ledge && Math.min(ledge.toLeft, ledge.toRight) < SIZE * 0.9;
    const sleepyPool = personality() === "sleepy" ? ["yawn", "stretch", "look"] : ANTICS;
    const antic = nearEdge && Math.random() < 0.6 ? "peek" : pick(sleepyPool);
    state.antic = antic;
    if (antic === "peek") {
      face(ledge.toLeft < ledge.toRight ? -1 : 1);
      setAnim("peek");
      await wait(1800);
      if (state.antic === antic) setAnim("idle");
    } else if (antic === "wander") {
      // Don't wander off a window; pick the direction with room.
      let dir = Math.random() < 0.5 ? -1 : 1;
      if (ledge) dir = ledge.toLeft > ledge.toRight ? -1 : 1;
      face(dir);
      state.vx = dir * WALK_SPEED * 0.5 * speedMul();
      setAnim("walk");
      await wait(700 + Math.random() * 900);
      if (state.antic === "wander") {
        state.vx = 0;
        setAnim("idle");
      }
    } else {
      setAnim(antic);
      await wait(antic === "spin" ? 900 : 1500);
      if (state.antic === antic) setAnim("idle");
    }
    if (state.antic === antic) state.antic = null;
  }
  scheduleAntic();
}

// --- ambient behaviour -------------------------------------------------------

function scheduleChatter() {
  // chatter 0 = never, 100 = every ~30 s, 50 = every ~1-2 min
  const pMul = personality() === "playful" ? 0.7 : personality() === "sleepy" ? 1.5 : 1;
  const base = settings.chatter <= 0 ? Infinity : (30_000 + (100 - settings.chatter) * 900) * pMul;
  const delay = base + Math.random() * base * 0.8;
  setTimeout(() => {
    if (
      Number.isFinite(delay) &&
      state.mode === "free" &&
      state.anim !== "sleep" &&
      !state.dragging &&
      !state.hidden &&
      !state.quiet
    ) {
      const buddyHungry = buddy.pet && settings.buddyHunger >= HUNGRY_AT && Math.random() < 0.5;
      const hungry = settings.hunger >= HUNGRY_AT && Math.random() < 0.7;
      const late = isLateNight() && Math.random() < 0.4;
      if (buddyHungry) say(`${petName(buddy.pet.id)} looks hungry too.`);
      else say(hungry ? line("hungry") : late ? timeGreeting() : line("idle"));
    }
    scheduleChatter();
  }, Number.isFinite(delay) ? delay : 60_000);
}

/**
 * Mischief mode only ever minimises, never closes. An autonomous close would
 * risk destroying unsaved work in someone else's app.
 */
function scheduleMischief() {
  const delay = 60_000 + Math.random() * 90_000;
  setTimeout(async () => {
    if (settings.mischief && state.mode === "free" && !state.dragging && !state.hidden && !state.quiet) {
      const candidates = state.windows.filter((w) => !w.minimized && !w.foreground);
      if (candidates.length) {
        const victim = pick(candidates);
        say(line("mischief"), 2200);
        await mission("minimize", victim.hwnd);
      }
    }
    scheduleMischief();
  }, delay);
}

// --- wiring ------------------------------------------------------------------

async function syncScreen() {
  screen = await invoke("get_screen");
}

listen("pet://cursor", ({ payload }) => {
  const x = toCssX(payload.x);
  const y = toCssY(payload.y);
  if (Math.hypot(x - state.cursor.x, y - state.cursor.y) > 1.5) {
    state.lastCursorMove = now();
  }
  state.cursor.x = x;
  state.cursor.y = y;
});

listen("pet://menu", ({ payload }) => {
  const id = String(payload?.id ?? payload);
  const value = payload?.value;
  if (id.startsWith("pet:")) return mountPet(id.slice(4));
  if (id.startsWith("size:")) return setSize(id.slice(5));
  if (id.startsWith("speed:")) return setSpeed(id.slice(6));
  if (id.startsWith("break:")) return setBreak(id.slice(6));
  if (id === "toggle:hidden") {
    state.hidden = Boolean(value);
    // Fade out before Rust hides the window; fade back in after it shows.
    el.stage.classList.toggle("hidden", state.hidden);
    if (state.hidden) {
      cancelPlacing();
      if (games.isActive()) games.cancel();
    }
    return;
  }
  if (id === "toggle:follow") settings.follow = value ?? !settings.follow;
  else if (id === "toggle:mischief") settings.mischief = value ?? !settings.mischief;
  else if (id === "toggle:realclick") settings.realClick = value ?? !settings.realClick;
  else if (id === "act:say") say(line("idle"));
  else if (id === "act:feed") return startPlacing("food");
  else if (id === "act:ball") return startPlacing("ball");
  else if (id === "act:game:jump") return games.start("jump");
  else if (id === "act:game:hide") return games.start("hide");
  else if (id === "act:minimize") return mission("minimize");
  else if (id === "act:close") return confirmClose();
  saveSettings();
});

listen("pet://settings", ({ payload }) => reloadSettings(payload));

// --- task agent narration ------------------------------------------------------
// The Rust agent streams progress; the pet plays it out in its bubble and logs
// finished errands in the journal. The full answer lives in the Tasks window.

let taskAnim = null;

function rememberTask(payload, status) {
  const d = payload.detail ?? {};
  if (!d.task) return;
  const entry = {
    id: String(payload.id ?? Date.now()),
    at: Date.now(),
    task: String(d.task),
    provider: String(d.provider ?? "claude"),
    model: String(d.model ?? ""),
    status,
    answer: status === "done" ? String(payload.text ?? "") : String(payload.text ?? "").slice(0, 400),
  };
  settings.tasks = [...settings.tasks.filter((t) => t.id !== entry.id), entry].slice(-50);
  saveSettings();
  // Tell the Tasks window (and anyone else) that history changed.
  window.__TAURI__.event.emit("pet://settings", { tasks: true }).catch(() => {});
}

listen("pet://task", ({ payload }) => {
  const { kind, text } = payload ?? {};
  const narrate = settings.agent?.narrate !== false && !state.quiet && !state.hidden;
  if (kind === "start") {
    if (narrate) say("On it! Let me look that up…", 3000);
    if (state.mode === "free") {
      state.antic = null;
      setAnim("look");
      taskAnim = setTimeout(() => setAnim("idle"), 1500);
    }
  } else if (kind === "tool") {
    if (narrate) say(text.length > 90 ? text.slice(0, 88) + "…" : text, 2500);
  } else if (kind === "answer") {
    clearTimeout(taskAnim);
    record("tasks");
    rememberTask(payload, "done");
    if (narrate) {
      const first = String(text).split("\n").find((l) => l.trim()) ?? "";
      say(`Done! ${first.length > 140 ? first.slice(0, 138) + "…" : first}\n(Full answer in the Tasks window.)`, 9000);
      setAnim("happy");
      playChirp();
      setTimeout(() => setAnim("idle"), 1300);
    }
  } else if (kind === "error") {
    clearTimeout(taskAnim);
    rememberTask(payload, "error");
    if (narrate) say(`Hmm, that didn't work: ${String(text).slice(0, 120)}`, 6000);
  } else if (kind === "cancelled") {
    clearTimeout(taskAnim);
    rememberTask(payload, "cancelled");
    if (narrate) say("Okay, stopped.", 1500);
  }
});

async function boot() {
  applySize();
  await syncScreen();
  await refreshWindows();
  state.autostart = await invoke("get_autostart").catch(() => false);
  syncTray();
  // Hunger while the app was closed: either catches up (default off) or is skipped.
  if (settings.pauseHungerOffline) {
    settings.hungerAt = Date.now();
    saveSettings();
  }
  mountPet(settings.pet);
  mountBuddy(settings.companion);
  applyToy();
  face(1);
  const b = roamBounds();
  state.x = b.x + b.w * 0.5;
  state.y = b.y + b.h - SIZE - 60;
  state.lastCursorMove = now();

  configureShortcuts();
  invoke("set_low_power", { enabled: settings.lowPower }).catch(console.error);
  pollEnvironment();
  scheduleWindowRefresh();
  setInterval(syncScreen, 5000); // catch monitor hot-plug / resolution changes
  scheduleChatter();
  scheduleMischief();
  scheduleBreak();
  scheduleAntic();
  tickHunger();
  setInterval(tickHunger, 30_000);
  scheduleFrame();
}

// Debug hook: lets devtools (or a CDP script) poke at live state.
window.__pet = {
  state,
  get settings() {
    return settings;
  },
  ball,
  buddy,
  games,
  say,
  startPlacing,
  mission,
  startBreak,
  updateFocus,
  reloadSettings,
};

boot();
