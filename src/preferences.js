// Shared, validated settings for the overlay, the control room, and backups.
// This module has no DOM dependency, so migrations and backup validation can be tested.
export const STORAGE_KEY = "pocketpet";
export const BUILTIN_IDS = ["droplet", "cat", "duck", "panda", "penguin"];
export const ACTIVITY_KEYS = ["meals", "pats", "pets", "fetches", "games", "wins", "breaks", "tasks"];
export const AGENT_PROVIDERS = ["claude", "openai", "groq", "gemini", "deepseek", "ollama", "custom"];
export const MAX_TASK_HISTORY = 50;
export const DEFAULTS = {
  pet: "droplet", companion: "", size: "medium", speed: "normal",
  follow: true, mischief: false, realClick: false, sound: true, toasts: true,
  volume: 60, chatter: 50, hungerRate: 100, hunger: 20, buddyHunger: 20, hungerAt: Date.now(),
  customImage: null, customPets: [], petNames: {}, personalities: {}, colors: {}, accessories: {}, profiles: {},
  stats: { meals: 0, pats: 0, pets: 0, fetches: 0, games: 0, wins: 0, breaks: 0, firstRun: Date.now() },
  focusFullscreen: true, focusAction: "quiet", quietHours: false, quietStart: "09:00", quietEnd: "17:00",
  monitor: "all", roamMargin: 16, roamBottomOnly: false,
  avoidArea: { enabled: false, x: 35, y: 10, w: 30, h: 45 },
  breakMins: 0, breakDuration: 5, breakSnooze: 5, breakCycles: false, showCountdown: true,
  pauseHungerOffline: true, showHunger: true, toy: "ball", speechSize: 14, speechDuration: 100, lowPower: false,
  shortcuts: {
    toggle: "Ctrl+Alt+P", feed: "Ctrl+Alt+F", play: "Ctrl+Alt+B", settings: "Ctrl+Alt+S", tasks: "Ctrl+Alt+T",
    kill: "Ctrl+Alt+X", voice: "Ctrl+Alt+V", clip: "Ctrl+Alt+D",
  },
  /** Task agent: which provider/model to use. Keys are NOT here (Credential Manager). */
  agent: {
    provider: "claude", models: {}, baseUrls: {}, maxTurns: 24, narrate: true,
    browser: true, allowedSites: [], dailyCapUsd: 2, speak: false, voice: true,
    spend: { date: "", usd: 0 },
    purchaseCap: 0, digestModel: "", stream: true, siteRules: {}, voiceEngine: "windows",
    schedules: [], updateCheck: true, lastUpdateCheck: 0,
  },
  /** Recent tasks, newest last. */
  tasks: [],
};

const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const number = (value, fallback, min, max) => typeof value !== "boolean" && value !== "" && Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Number(value))) : fallback;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
const shortText = (value, max = 40) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const time = (value, fallback) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
export const ACCESSORY_SLOTS = ["hat", "face", "neck", "back", "paw"];
export const MAX_ACCESSORIES = 4;
const HEX = /^#[0-9a-f]{6}$/i;
/** Legacy hue slider value → a hex colour of that hue. */
const hueToHex = (h) => {
  const f = (n) => { const k = (n + h / 30) % 12; const c = 0.55 - 0.75 * 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const LEGACY_ACCESSORY = { bow: { emoji: "🎀", slot: "neck" }, star: { emoji: "⭐", slot: "hat" }, crown: { emoji: "👑", slot: "hat" } };
export function normalizeAccessory(value) {
  const raw = object(value);
  const emoji = shortText(raw.emoji, 8);
  if (!emoji) return null;
  return {
    emoji,
    slot: choice(raw.slot, ACCESSORY_SLOTS, "hat"),
    size: number(raw.size, 1, 0.5, 1.8),
    x: number(raw.x, 0, -50, 50),
    y: number(raw.y, 0, -50, 50),
  };
}
export function normalizeAccessories(value) {
  if (typeof value === "string") return value in LEGACY_ACCESSORY ? [normalizeAccessory({ ...LEGACY_ACCESSORY[value], size: 1 })] : [];
  return (Array.isArray(value) ? value : []).map(normalizeAccessory).filter(Boolean).slice(0, MAX_ACCESSORIES);
}
export const validImage = (value) => typeof value === "string" && value.length <= 1_800_000 && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

export function normalizeProfile(value, now = Date.now()) {
  const raw = object(value);
  const profile = { firstRun: number(raw.firstRun, now, 1, now), journal: [] };
  for (const key of ACTIVITY_KEYS) profile[key] = Math.floor(number(raw[key], 0, 0, 1_000_000_000));
  profile.journal = (Array.isArray(raw.journal) ? raw.journal : []).slice(-40).map((entry) => ({
    at: number(object(entry).at, now, 1, now), text: shortText(object(entry).text, 160),
  })).filter((entry) => entry.text);
  return profile;
}

export function normalizeSettings(input) {
  const raw = object(input);
  const next = structuredClone(DEFAULTS);
  for (const key of ["follow", "mischief", "realClick", "sound", "toasts", "focusFullscreen", "quietHours", "roamBottomOnly", "breakCycles", "showCountdown", "pauseHungerOffline", "showHunger", "lowPower"])
    if (typeof raw[key] === "boolean") next[key] = raw[key];
  for (const [key, min, max] of [["volume", 0, 100], ["chatter", 0, 100], ["hungerRate", 0, 200], ["hunger", 0, 100], ["buddyHunger", 0, 100], ["hungerAt", 1, Date.now()], ["roamMargin", 0, 200], ["breakMins", 0, 240], ["breakDuration", 1, 60], ["breakSnooze", 1, 60], ["speechSize", 12, 24], ["speechDuration", 50, 300]])
    next[key] = number(raw[key], next[key], min, max);
  for (const key of ["breakMins", "breakDuration", "breakSnooze", "roamMargin", "speechSize"]) next[key] = Math.round(next[key]);
  next.size = choice(raw.size, ["small", "medium", "large"], next.size);
  next.speed = choice(raw.speed, ["slow", "normal", "fast"], next.speed);
  next.toy = choice(raw.toy, ["ball", "yarn", "frisbee"], next.toy);
  next.focusAction = choice(raw.focusAction, ["quiet", "hide"], next.focusAction);
  next.quietStart = time(raw.quietStart, next.quietStart);
  next.quietEnd = time(raw.quietEnd, next.quietEnd);
  next.monitor = raw.monitor === "all" || /^(0|[1-9]\d{0,2})$/.test(String(raw.monitor)) ? String(raw.monitor) : "all";
  const area = object(raw.avoidArea);
  next.avoidArea = {
    enabled: typeof area.enabled === "boolean" ? area.enabled : false,
    x: number(area.x, 35, 0, 95), y: number(area.y, 10, 0, 95),
    w: number(area.w, 30, 5, 100), h: number(area.h, 45, 5, 100),
  };
  next.avoidArea.w = Math.min(next.avoidArea.w, 100 - next.avoidArea.x);
  next.avoidArea.h = Math.min(next.avoidArea.h, 100 - next.avoidArea.y);
  const seen = new Set();
  for (const entry of (Array.isArray(raw.customPets) ? raw.customPets : []).slice(0, 12)) {
    const custom = object(entry);
    if (!/^custom:[a-zA-Z0-9_-]{1,64}$/.test(custom.id) || seen.has(custom.id) || !validImage(custom.image)) continue;
    seen.add(custom.id);
    next.customPets.push({ id: custom.id, name: shortText(custom.name) || "My pet", image: custom.image });
  }
  // Preserve the old single-image pet and its identity when upgrading existing settings.
  const legacy = validImage(raw.customImage) ? raw.customImage : null;
  if (legacy && !seen.has("custom:legacy") && next.customPets.length < 12) {
    next.customPets.push({ id: "custom:legacy", name: "Custom pet", image: legacy });
  }
  // The legacy field is consumed once. Keeping it would resurrect a removed
  // custom:legacy pet and retain a second copy of its image in localStorage.
  next.customImage = null;
  const ids = [...BUILTIN_IDS, ...next.customPets.map((pet) => pet.id)];
  next.pet = choice(raw.pet === "custom" ? "custom:legacy" : raw.pet, ids, "droplet");
  next.companion = choice(raw.companion === "custom" ? "custom:legacy" : raw.companion, ["", ...ids], "");
  next.stats = normalizeProfile(raw.stats);
  const profiles = object(raw.profiles);
  for (const id of ids) {
    const profile = profiles[id] ?? (id === "custom:legacy" ? profiles.custom : undefined);
    // A pre-dashboard install has only global counters; migrate those to its active pet once.
    next.profiles[id] = normalizeProfile(profile ?? (Object.keys(profiles).length === 0 && id === next.pet ? raw.stats : undefined));
    const name = shortText(object(raw.petNames)[id]);
    if (name) next.petNames[id] = name;
    next.personalities[id] = choice(object(raw.personalities)[id], ["playful", "calm", "sleepy"], "calm");
    const color = object(raw.colors)[id];
    next.colors[id] = typeof color === "string" && HEX.test(color) ? color.toLowerCase()
      : typeof color === "number" && color > 0 && color <= 360 ? hueToHex(color) : "";
    next.accessories[id] = normalizeAccessories(object(raw.accessories)[id]);
  }
  for (const key of Object.keys(next.shortcuts)) {
    const value = object(raw.shortcuts)[key];
    if (typeof value === "string") next.shortcuts[key] = shortText(value, 80);
  }
  const agent = object(raw.agent);
  next.agent.provider = choice(agent.provider, AGENT_PROVIDERS, "claude");
  next.agent.maxTurns = Math.round(number(agent.maxTurns, 24, 4, 60));
  next.agent.narrate = typeof agent.narrate === "boolean" ? agent.narrate : true;
  next.agent.browser = typeof agent.browser === "boolean" ? agent.browser : true;
  next.agent.speak = typeof agent.speak === "boolean" ? agent.speak : false;
  next.agent.voice = typeof agent.voice === "boolean" ? agent.voice : true;
  next.agent.dailyCapUsd = number(agent.dailyCapUsd, 2, 0, 1000);
  next.agent.allowedSites = (Array.isArray(agent.allowedSites) ? agent.allowedSites : [])
    .map((s) => shortText(s, 120).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((s) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s))
    .slice(0, 100);
  const spend = object(agent.spend);
  next.agent.spend = { date: shortText(spend.date, 10), usd: number(spend.usd, 0, 0, 1e6) };
  next.agent.purchaseCap = number(agent.purchaseCap, 0, 0, 1e7);
  next.agent.digestModel = shortText(agent.digestModel, 120);
  next.agent.stream = typeof agent.stream === "boolean" ? agent.stream : true;
  next.agent.voiceEngine = choice(agent.voiceEngine, ["windows", "whisper"], "windows");
  next.agent.updateCheck = typeof agent.updateCheck === "boolean" ? agent.updateCheck : true;
  next.agent.lastUpdateCheck = number(agent.lastUpdateCheck, 0, 0, Date.now());
  for (const [domain, rule] of Object.entries(object(agent.siteRules)).slice(0, 200)) {
    const d = shortText(domain, 120).toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && ["allow", "ask", "never"].includes(rule)) next.agent.siteRules[d] = rule;
  }
  next.agent.schedules = (Array.isArray(agent.schedules) ? agent.schedules : []).slice(0, 20).map((raw) => {
    const s = object(raw);
    return {
      id: shortText(s.id, 40) || Math.random().toString(36).slice(2, 10),
      task: shortText(s.task, 600),
      time: time(s.time, "09:00"),
      days: choice(s.days, ["daily", "weekdays", "weekends"], "daily"),
      enabled: typeof s.enabled === "boolean" ? s.enabled : true,
      lastRun: shortText(s.lastRun, 10),
    };
  }).filter((s) => s.task);
  for (const id of AGENT_PROVIDERS) {
    const model = shortText(object(agent.models)[id], 120);
    if (model) next.agent.models[id] = model;
    const url = shortText(object(agent.baseUrls)[id], 300);
    if (/^https?:\/\//.test(url)) next.agent.baseUrls[id] = url;
  }
  next.tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).slice(-MAX_TASK_HISTORY).map((t) => {
    const task = object(t);
    return {
      id: shortText(task.id, 40) || String(Date.now()),
      at: number(task.at, Date.now(), 1, Date.now()),
      task: shortText(task.task, 600),
      provider: choice(task.provider, AGENT_PROVIDERS, "claude"),
      model: shortText(task.model, 120),
      status: choice(task.status, ["done", "error", "cancelled"], "done"),
      answer: typeof task.answer === "string" ? task.answer.slice(0, 8000) : "",
    };
  }).filter((t) => t.task);
  return next;
}

export function readSettings() {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")); }
  catch { return normalizeSettings({}); }
}

export function writeSettings(patch) {
  const previous = readSettings();
  const raw = { ...previous, ...object(patch) };
  for (const key of ["petNames", "personalities", "colors", "accessories", "profiles", "stats", "shortcuts", "avoidArea"])
    if (patch?.[key]) raw[key] = { ...previous[key], ...object(patch[key]) };
  if (patch?.agent) {
    const a = object(patch.agent);
    raw.agent = {
      ...previous.agent,
      ...a,
      models: { ...previous.agent.models, ...object(a.models) },
      baseUrls: { ...previous.agent.baseUrls, ...object(a.baseUrls) },
      siteRules: a.siteRules === null ? {} : { ...previous.agent.siteRules, ...object(a.siteRules) },
    };
  }
  const next = normalizeSettings(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function profileFor(settings, id) {
  return normalizeProfile(settings?.profiles?.[id]);
}

export function milestonesFor(profile) {
  const p = normalizeProfile(profile);
  const interactions = p.meals + p.pats + p.pets + p.fetches + p.games;
  const play = p.games + p.fetches;
  return [
    { id: "bow", label: "Making friends", description: "5 meals, pats, cuddles or games", value: interactions, goal: 5, unlocked: interactions >= 5 },
    { id: "star", label: "Playtime star", description: "10 games or fetches", value: play, goal: 10, unlocked: play >= 10 },
    { id: "crown", label: "Best friends", description: "25 meals, pats, cuddles or games", value: interactions, goal: 25, unlocked: interactions >= 25 },
  ];
}

export function recordActivity(id, kind, amount = 1) {
  const settings = readSettings();
  if (!ACTIVITY_KEYS.includes(kind) || !settings.profiles[id]) return settings;
  const increment = Math.floor(number(amount, 1, 0, 10_000));
  if (!increment) return settings;
  const profile = profileFor(settings, id);
  profile[kind] += increment;
  const labels = { meals: "Enjoyed a meal", pats: "Got a friendly pat", pets: "Had a cuddle", fetches: "Played fetch", games: "Played a game", wins: "Won a challenge", breaks: "Took a break together", tasks: "Ran an errand on the web" };
  profile.journal.push({ at: Date.now(), text: labels[kind] + (increment > 1 ? ` ×${increment}` : "") });
  profile.journal = profile.journal.slice(-40);
  return writeSettings({ profiles: { [id]: profile }, stats: { [kind]: settings.stats[kind] + increment } });
}

/** A few prize accessories become available as a pet's friendship grows. */
export function accessoryUnlocked(settings, id, accessory) {
  const reward = { "🎀": "bow", "⭐": "star", "👑": "crown" }[accessory];
  if (!reward) return true;
  return milestonesFor(profileFor(settings, id)).some((m) => m.id === reward && m.unlocked);
}

export function parseBackup(value) {
  if (!value || value.app !== "PocketPet" || value.version !== 1 || !value.settings || typeof value.settings !== "object" || Array.isArray(value.settings))
    throw new Error("Choose a PocketPet backup with version 1.");
  const raw = value.settings;
  if (raw.customPets != null && (!Array.isArray(raw.customPets) || raw.customPets.length > 12))
    throw new Error("This backup has an invalid custom pet library.");
  for (const pet of raw.customPets ?? [])
    if (!pet || !/^custom:[a-zA-Z0-9_-]{1,64}$/.test(pet.id) || !validImage(pet.image))
      throw new Error("This backup contains an invalid pet image.");
  return normalizeSettings(raw);
}
