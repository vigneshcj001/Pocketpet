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
  if (kind === "confirm" || kind === "ask") return { ...previous, phase: "waiting", text: kind === "confirm" ? "Approval needed. Open Details." : "Needs your reply. Open Details." };
  // Incidental narration must not dismiss a still-pending approval.
  if (previous.phase === "waiting" && ["note", "plan", "delta", "step"].includes(kind)) return previous;
  if (["tool", "note", "plan", "delta", "step", "result"].includes(kind)) return { ...previous, phase: "thinking", text: "Thinking" };
  return previous;
}

export const ICONS = {
  compose: '<path d="M11 4H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-5"/><path d="m10 14 1-4L19 2a2 2 0 0 1 3 3l-8 8-4 1Z"/>',
  voice: '<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 10v4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  details: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export function createCompanion({ invoke, listen, getPetElement, getQuiet, onError, onChat }) {
  const root = document.getElementById("companion");
  const launcher = document.getElementById("companion-launcher");
  const panel = document.getElementById("companion-panel");
  const controls = document.getElementById("companion-controls");
  const pill = document.getElementById("companion-task");
  const badge = document.getElementById("companion-badge");
  const status = document.getElementById("companion-status");
  let view = null;
  let controlsOpen = false;
  let acknowledged = null;
  let startingTimer = 0;
  const terminalKey = () => view && ["completed", "error"].includes(view.phase) ? `${view.id}:${view.phase}` : null;
  function acknowledgeTerminal() {
    const key = terminalKey();
    if (key) acknowledged = key;
  }
  const open = async (mode) => {
    const viewed = terminalKey();
    try {
      if (mode) localStorage.setItem(COMPOSE_REQUEST, JSON.stringify({ mode, at: Date.now() }));
      await invoke("open_tasks");
      // Existing windows consume on focus or this event; new ones consume at boot.
      if (mode) await window.__TAURI__.event.emit("pet://compose", {});
      if (!mode && viewed && viewed === terminalKey()) {
        acknowledged = viewed;
        paint();
      }
    } catch (error) {
      localStorage.removeItem(COMPOSE_REQUEST);
      onError(`Couldn't open tasks: ${String(error).slice(0, 90)}`);
    }
  };
  for (const [name, label, description, action] of [
    ["compose", "Chat", "Start a new chat", () => { controlsOpen = false; paint(); onChat(); }],
    ["voice", "Voice", "Use voice input", () => open("voice")],
    ["details", "Details", "Open task details", () => open()],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = description;
    button.setAttribute("aria-label", description);
    button.innerHTML = icon(name);
    const caption = document.createElement("span");
    caption.textContent = label;
    button.append(caption);
    button.addEventListener("click", action);
    controls.append(button);
  }
  const details = controls.lastElementChild;
  details.hidden = true;
  pill.addEventListener("click", () => open());
  launcher.addEventListener("click", () => {
    controlsOpen = !controlsOpen;
    paint();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !controlsOpen) return;
    controlsOpen = false;
    paint();
    launcher.focus();
    event.stopPropagation();
  });
  function paint() {
    panel.hidden = !controlsOpen;
    launcher.setAttribute("aria-expanded", String(controlsOpen));
    pill.hidden = !controlsOpen || !view;
    details.hidden = !view;
    if (controlsOpen && !getQuiet()) acknowledgeTerminal();
    const attention = view?.phase === "waiting" ? "waiting"
      : terminalKey() && acknowledged !== terminalKey() ? view.phase : null;
    const attentionLabel = attention === "waiting" ? "Task needs your attention"
      : attention === "completed" ? "Task completed" : attention === "error" ? "Task needs help" : "";
    badge.hidden = !attention;
    badge.dataset.phase = attention ?? "";
    badge.textContent = attention === "completed" ? "✓" : "!";
    status.textContent = attentionLabel;
    const action = controlsOpen ? "Hide companion controls" : "Show companion controls";
    launcher.title = attentionLabel ? `${action}. ${attentionLabel}.` : action;
    launcher.setAttribute("aria-label", launcher.title);
    if (!view) return;
    pill.dataset.phase = view.phase;
    document.getElementById("companion-title").textContent = view.title;
    document.getElementById("companion-summary").textContent = view.text;
    getPetElement().dataset.taskState = view.phase;
  }
  listen("pet://companion-start", ({ payload }) => {
    view = { id: payload.id, title: payload.task, phase: "starting", text: "Starting your task" };
    acknowledged = null;
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
  listen("pet://task-viewed", ({ payload }) => {
    if (payload?.id !== view?.id || payload?.phase !== view?.phase) return;
    acknowledgeTerminal();
    paint();
  });
  paint();
  return {
    position() {
      root.hidden = getQuiet();
      if (root.hidden) return;
      if (controlsOpen && terminalKey() && acknowledged !== terminalKey()) paint();
      const pet = getPetElement().getBoundingClientRect();
      const width = root.offsetWidth;
      const height = root.offsetHeight;
      const left = Math.max(8, Math.min(innerWidth - width - 8, pet.left + pet.width / 2 - width / 2));
      const below = pet.bottom + 9;
      const top = below + height <= innerHeight - 8 ? below : Math.max(8, pet.top - height - 10);
      root.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
      if (!panel.hidden) {
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        const panelLeft = Math.max(8, Math.min(innerWidth - panelWidth - 8, pet.left + pet.width / 2 - panelWidth / 2));
        const panelBelow = top + height + 8;
        const panelTop = panelBelow + panelHeight <= innerHeight - 8
          ? panelBelow
          : Math.max(8, Math.min(top, pet.top) - panelHeight - 8);
        panel.style.left = `${Math.round(panelLeft - left)}px`;
        panel.style.top = `${Math.round(panelTop - top)}px`;
      }
    },
    close() {
      if (!controlsOpen) return;
      controlsOpen = false;
      paint();
    },
    regions() { return root.hidden ? [] : [launcher, ...(!panel.hidden ? [controls, ...(!pill.hidden ? [pill] : [])] : [])]; },
  };
}
