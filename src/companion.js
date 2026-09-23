// The companion chrome uses the existing task agent and approval window.
export const COMPOSE_REQUEST = "pocketpet:compose-request";

export function taskView(previous, event) {
  const { kind, id, text = "", detail } = event ?? {};
  if (kind === "start") return { id, title: detail?.task || (previous?.id === id ? previous.title : "Your task"), phase: "starting", text: "Starting your task" };
  if (!previous || (id && id !== previous.id && kind !== "killed")) return previous;
  if (["completed", "error", "idle"].includes(previous.phase) && kind !== "killed") return previous;
  if (kind === "answer") return { ...previous, title: detail?.task || previous.title, phase: "completed", text: String(text) };
  if (kind === "error") return { ...previous, phase: "error", text: String(text) };
  if (kind === "cancelled" || kind === "killed") return { ...previous, phase: "idle", text: "Task stopped" };
  if (kind === "confirm" || kind === "ask") return { ...previous, phase: "waiting", text: "Needs your attention — open task" };
  if (["tool", "note", "plan", "delta", "step", "result"].includes(kind)) return { ...previous, phase: "thinking", text: "Thinking" };
  return previous;
}

export const ICONS = {
  compose: '<path d="M11 4H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-5"/><path d="m10 14 1-4L19 2a2 2 0 0 1 3 3l-8 8-4 1Z"/>',
  voice: '<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 10v4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export function createCompanion({ invoke, listen, getPetElement, getQuiet, onError }) {
  const root = document.getElementById("companion");
  const controls = document.getElementById("companion-controls");
  const pill = document.getElementById("companion-task");
  let view = null;
  let collapsed = false;
  let startingTimer = 0;
  const open = async (mode) => {
    try {
      if (mode) localStorage.setItem(COMPOSE_REQUEST, JSON.stringify({ mode, at: Date.now() }));
      await invoke("open_tasks");
      // Existing windows consume on focus or this event; new ones consume at boot.
      if (mode) await window.__TAURI__.event.emit("pet://compose", {});
    } catch (error) {
      localStorage.removeItem(COMPOSE_REQUEST);
      onError(`Couldn't open tasks: ${String(error).slice(0, 90)}`);
    }
  };
  for (const [name, label, action] of [
    ["compose", "Start a new chat", () => open("chat")],
    ["voice", "Voice input", () => open("voice")],
    ["chevron", "Collapse task status", () => {
      collapsed = !collapsed;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", collapsed ? "Expand task status" : "Collapse task status");
      toggle.classList.toggle("collapsed", collapsed);
      paint();
    }],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon(name);
    button.addEventListener("click", action);
    controls.append(button);
  }
  const toggle = controls.lastElementChild;
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-controls", "companion-task");
  pill.addEventListener("click", () => open());
  function paint() {
    pill.hidden = !view || collapsed;
    if (!view) return;
    pill.dataset.phase = view.phase;
    document.getElementById("companion-title").textContent = view.title;
    document.getElementById("companion-summary").textContent = view.text;
    getPetElement().dataset.taskState = view.phase;
  }
  listen("pet://companion-start", ({ payload }) => {
    view = { id: payload.id, title: payload.task, phase: "starting", text: "Starting your task" };
    collapsed = false;
    toggle.classList.remove("collapsed");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Collapse task status");
    paint();
  });
  listen("pet://task", ({ payload }) => {
    view = taskView(view, payload);
    paint();
    if (payload?.kind === "start") {
      clearTimeout(startingTimer);
      const id = payload.id;
      startingTimer = setTimeout(() => {
        if (view?.id === id && view.phase === "starting") { view = { ...view, phase: "thinking", text: "Thinking" }; paint(); }
      }, 1000);
    }
  });
  return {
    position() {
      root.hidden = getQuiet();
      if (root.hidden) return;
      const pet = getPetElement().getBoundingClientRect();
      const width = root.offsetWidth;
      const height = root.offsetHeight;
      const left = Math.max(8, Math.min(innerWidth - width - 8, pet.left + pet.width / 2 - width / 2));
      const below = pet.bottom + 9;
      const top = below + height <= innerHeight - 8 ? below : Math.max(8, pet.top - height - 10);
      root.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    },
    regions() { return root.hidden ? [] : [controls, ...(!pill.hidden ? [pill] : [])]; },
  };
}
