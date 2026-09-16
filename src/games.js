/** Toys share the existing throw/fetch interaction. Physics values are multipliers. */
export const TOYS = Object.freeze({
  ball: Object.freeze({ name: "Ball", emoji: "⚽", bounce: 0.45, friction: 0.96 }),
  yarn: Object.freeze({ name: "Yarn", emoji: "🧶", bounce: 0.25, friction: 0.91 }),
  frisbee: Object.freeze({ name: "Frisbee", emoji: "🥏", bounce: 0.16, friction: 0.985 }),
});

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const smooth = (n) => n * n * (3 - 2 * n);
const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Small games that borrow the real pet. The owner drives tick(dt), in seconds,
 * while setBusy(true) suspends its normal movement. No independent timers or
 * animation loops survive cancellation. All coordinates are overlay CSS pixels.
 */
export function createGames(api) {
  let game = null;

  function node(tag, className, text) {
    const result = document.createElement(tag);
    result.className = className;
    if (text != null) result.textContent = text;
    return result;
  }

  function place(element, x, y, w, h) {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    if (w != null) element.style.width = `${w}px`;
    if (h != null) element.style.height = `${h}px`;
  }

  function petAt(x, y) {
    api.setPet(x, y);
    api.repaint();
  }

  function restore(g) {
    document.removeEventListener("keydown", onKey, true);
    g.root.remove();
    api.stage.classList.remove("pet-games-active");
    // A monitor might have been disconnected during a game.
    const b = api.getBounds();
    const size = api.getPet().size;
    petAt(
      clamp(g.origin.x, b.x, Math.max(b.x, b.x + b.w - size)),
      clamp(g.origin.y, b.y, Math.max(b.y, b.y + b.h - size)),
    );
    api.setAnim("idle");
    api.setBusy(false);
  }

  function cancel() {
    if (!game) return;
    const previous = game;
    game = null;
    restore(previous);
  }

  function finish(message, won) {
    if (!game || game.phase === "ending") return;
    if (won) api.record("wins");
    game.phase = "ending";
    game.remaining = 1.3;
    game.status.textContent = message;
    api.setAnim(won ? "happy" : "idle");
    api.say(message, 3600);
    if (won) api.sound();
  }

  function start(kind = "jump") {
    const id = ["hide", "hide-and-seek", "hideAndSeek", "hideSeek"].includes(kind) ? "hide" : "jump";
    if (game) cancel();
    if (api.busy() || api.hidden()) {
      api.say("Let's play when I'm back and ready.", 2200);
      return false;
    }
    const bounds = api.getBounds();
    const origin = { ...api.getPet() };
    if (bounds.w < Math.max(320, origin.size * 3 + 64) || bounds.h < origin.size + 200) {
      api.say("I need a little more screen space for this game.", 2600);
      return false;
    }
    const arena = {
      x: bounds.x + 16,
      y: bounds.y + bounds.h - Math.min(290, bounds.h - 144) - 20,
      w: Math.min(840, bounds.w - 32),
      h: Math.min(290, bounds.h - 144),
    };
    arena.x = bounds.x + (bounds.w - arena.w) / 2;

    const root = node("div", "pet-game");
    const panel = node("section", "pet-game-panel");
    panel.setAttribute("aria-label", id === "jump" ? "Obstacle jump game" : "Hide and seek game");
    const title = node("h2", "pet-game-title", id === "jump" ? "🐾 Obstacle jump" : "📦 Hide & seek");
    const help = node("p", "pet-game-help", id === "jump"
      ? "Clear 5 obstacles. Press Space or click Jump before each hurdle."
      : "Watch your pet, follow the boxes, then choose where it is hiding.");
    const status = node("p", "pet-game-status", id === "jump" ? "Get ready…" : "Watch where I hide…");
    status.setAttribute("aria-live", "polite");
    const controls = node("div", "pet-game-controls");
    const close = node("button", "pet-game-cancel", "End game · Esc");
    close.type = "button";
    close.addEventListener("click", () => cancel());
    const jumpButton = id === "jump" ? node("button", "pet-game-jump", "Jump · Space") : null;
    if (jumpButton) {
      jumpButton.type = "button";
      jumpButton.addEventListener("click", () => jump());
      controls.append(jumpButton);
    }
    controls.append(close);
    panel.append(title, help, status, controls);
    const panelWidth = Math.min(480, bounds.w - 32);
    place(panel, bounds.x + (bounds.w - panelWidth) / 2, bounds.y + 16, panelWidth);

    const field = node("div", `pet-game-arena pet-game-arena-${id}`);
    place(field, arena.x, arena.y, arena.w, arena.h);
    if (id === "jump") {
      field.setAttribute("role", "button");
      field.setAttribute("aria-label", "Jump over the obstacle");
      field.tabIndex = 0;
      field.addEventListener("click", () => jump());
    }
    const floor = node("div", "pet-game-floor");
    field.append(floor);
    root.append(field, panel);
    // Game controls should never start a pet drag or trigger page-level actions.
    root.addEventListener("pointerdown", (event) => event.stopPropagation());
    root.addEventListener("click", (event) => event.stopPropagation());
    root.addEventListener("contextmenu", (event) => event.preventDefault());
    api.stage.append(root);
    api.stage.classList.add("pet-games-active");
    game = {
      id, root, panel, field, help, status, arena, origin, bounds,
      size: origin.size, phase: "ready", remaining: 1.8, score: 0,
    };
    api.setBusy(true);
    api.record("games");
    document.addEventListener("keydown", onKey, true);
    if (id === "jump") setupJump();
    else setupHide();
    return true;
  }

  function setupJump() {
    const g = game;
    const obstacle = node("div", "pet-game-obstacle", "🪵");
    obstacle.setAttribute("aria-hidden", "true");
    g.root.append(obstacle);
    g.obstacleNode = obstacle;
    g.floorY = g.arena.y + g.arena.h - 20;
    g.gravity = 1600;
    g.speed = clamp(g.arena.w * 0.32, 150, 250);
    g.vy = 0;
    g.jumpHeight = Math.min(115, g.arena.h - g.size - 20);
    nextLap();
    api.setAnim("idle");
  }

  function nextLap() {
    const g = game;
    g.x = g.arena.x + 12;
    g.y = g.floorY - g.size;
    g.vy = 0;
    g.cleared = false;
    const width = clamp(g.size * 0.38, 22, 38);
    const height = clamp(g.size * 0.32 + g.score * 2, 22, 40);
    g.obstacle = {
      x: g.arena.x + g.arena.w * (0.54 + Math.random() * 0.12),
      y: g.floorY - height,
      w: width,
      h: height,
    };
    place(g.obstacleNode, g.obstacle.x, g.obstacle.y, width, height);
    petAt(g.x, g.y);
  }

  function jump() {
    const g = game;
    if (!g || g.id !== "jump" || g.phase !== "running") return;
    if (g.y >= g.floorY - g.size - 0.5 && g.vy >= 0) {
      g.vy = -Math.sqrt(2 * g.gravity * g.jumpHeight);
      api.sound();
    }
  }

  function tickJump(dt) {
    const g = game;
    if (g.phase === "ready") {
      g.remaining -= dt;
      if (g.remaining <= 0) {
        g.phase = "running";
        g.status.textContent = "Go! Obstacles cleared: 0 / 5";
        api.setAnim("run");
      }
      return;
    }
    g.x += g.speed * dt;
    g.vy += g.gravity * dt;
    g.y = Math.min(g.floorY - g.size, g.y + g.vy * dt);
    if (g.y >= g.floorY - g.size) g.vy = 0;
    petAt(g.x, g.y);
    const body = { x: g.x + g.size * 0.2, y: g.y + g.size * 0.2, w: g.size * 0.6, h: g.size * 0.76 };
    if (intersects(body, g.obstacle)) {
      finish(`Oops! ${g.score} / 5 cleared. Let's try again soon.`, false);
      return;
    }
    if (!g.cleared && body.x > g.obstacle.x + g.obstacle.w) {
      g.cleared = true;
      g.score += 1;
      g.status.textContent = `Obstacles cleared: ${g.score} / 5`;
      if (g.score === 5) {
        finish("Five perfect jumps! Challenge complete. 🏆", true);
        return;
      }
    }
    if (g.x + g.size >= g.arena.x + g.arena.w - 12) nextLap();
  }

  function setupHide() {
    const g = game;
    g.round = 0;
    g.boxSize = g.size + 22;
    g.boxY = g.arena.y + g.arena.h - g.boxSize - 36;
    g.slots = [0, 1, 2].map((i) => g.arena.x + g.arena.w * ((i + 0.5) / 3) - g.boxSize / 2);
    g.boxes = [0, 1, 2].map((id) => {
      const box = node("button", "pet-game-box", "?");
      box.type = "button";
      box.disabled = true;
      box.setAttribute("aria-label", "Moving box");
      box.addEventListener("click", () => chooseBox(id));
      g.root.append(box);
      return { id, node: box, slot: id, x: g.slots[id], y: g.boxY };
    });
    nextHideRound();
  }

  function drawBoxes() {
    const g = game;
    for (const box of g.boxes) place(box.node, box.x, box.y, g.boxSize, g.boxSize);
    const hidingBox = g.boxes[g.hiding];
    petAt(hidingBox.x + (g.boxSize - g.size) / 2, hidingBox.y + g.boxSize - g.size - 4);
  }

  function nextHideRound() {
    const g = game;
    g.round += 1;
    g.hiding = Math.floor(Math.random() * 3);
    g.phase = "peek";
    g.remaining = 1.3;
    g.swapsLeft = 2 + g.round;
    for (const box of g.boxes) {
      box.node.classList.remove("pet-game-box-open", "pet-game-box-wrong", "pet-game-box-correct");
      box.node.disabled = true;
      box.node.textContent = "?";
      box.node.setAttribute("aria-label", "Moving box");
      box.y = g.boxY;
    }
    g.boxes[g.hiding].node.classList.add("pet-game-box-open");
    g.boxes[g.hiding].node.textContent = "Here I am!";
    g.status.textContent = `Round ${g.round} / 5 · Found ${g.score} · Watch where I hide…`;
    api.setAnim("idle");
    drawBoxes();
  }

  function beginSwap() {
    const g = game;
    const first = Math.floor(Math.random() * 3);
    const second = (first + 1 + Math.floor(Math.random() * 2)) % 3;
    g.swap = { first, second, from: g.boxes[first].x, to: g.boxes[second].x, elapsed: 0 };
    g.phase = "shuffle";
  }

  function chooseBox(id) {
    const g = game;
    if (!g || g.id !== "hide" || g.phase !== "choose") return;
    const correct = id === g.hiding;
    if (correct) {
      g.score += 1;
      api.sound();
    } else g.boxes[id].node.classList.add("pet-game-box-wrong");
    for (const box of g.boxes) box.node.disabled = true;
    g.boxes[g.hiding].node.classList.add("pet-game-box-open", "pet-game-box-correct");
    g.boxes[g.hiding].node.textContent = correct ? "Found me!" : "Over here!";
    g.status.textContent = `${correct ? "Found me!" : "I was over here!"} · ${g.score} / ${g.round} found`;
    g.phase = "reveal";
    g.remaining = 1.4;
    api.setAnim(correct ? "happy" : "idle");
  }

  function tickHide(dt) {
    const g = game;
    if (g.phase === "choose") return;
    if (g.phase === "shuffle") {
      const swap = g.swap;
      swap.elapsed += dt;
      const t = clamp(swap.elapsed / Math.max(0.48, 0.85 - g.round * 0.06), 0, 1);
      const progress = smooth(t);
      const a = g.boxes[swap.first];
      const b = g.boxes[swap.second];
      a.x = swap.from + (swap.to - swap.from) * progress;
      b.x = swap.to + (swap.from - swap.to) * progress;
      a.y = g.boxY - Math.sin(t * Math.PI) * 30;
      b.y = g.boxY + Math.sin(t * Math.PI) * 14;
      drawBoxes();
      if (t >= 1) {
        [a.slot, b.slot] = [b.slot, a.slot];
        g.swapsLeft -= 1;
        g.phase = "between";
        g.remaining = 0.22;
      }
      return;
    }
    g.remaining -= dt;
    if (g.remaining > 0) return;
    if (g.phase === "peek") {
      const box = g.boxes[g.hiding].node;
      box.classList.remove("pet-game-box-open");
      box.textContent = "?";
      g.phase = "covered";
      g.remaining = 0.45;
      g.status.textContent = `Round ${g.round} / 5 · Follow my box…`;
    } else if (g.phase === "covered" || (g.phase === "between" && g.swapsLeft > 0)) {
      beginSwap();
    } else if (g.phase === "between") {
      g.phase = "choose";
      g.status.textContent = `Where am I? Click a box or press 1, 2, or 3. · Found ${g.score}`;
      for (const box of g.boxes) {
        box.node.disabled = false;
        box.node.textContent = String(box.slot + 1);
        box.node.setAttribute("aria-label", `Choose box ${box.slot + 1}`);
      }
    } else if (g.phase === "reveal") {
      if (g.round === 5) finish(`You found me ${g.score} / 5 times!${g.score >= 3 ? " Challenge complete. 🏆" : " Let's play again soon."}`, g.score >= 3);
      else nextHideRound();
    }
  }

  function onKey(event) {
    if (!game || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
    } else if (game.id === "jump" && (event.code === "Space" || event.key === "ArrowUp")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) jump();
    } else if (game.id === "hide" && /^[123]$/.test(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const box = game.boxes.find((item) => item.slot === Number(event.key) - 1);
      if (box) chooseBox(box.id);
    }
  }

  function tick(dt) {
    if (!game) return;
    const current = api.getBounds();
    if (api.hidden() || ["x", "y", "w", "h"].some((key) => Math.abs(current[key] - game.bounds[key]) > 2)) {
      cancel();
      return;
    }
    const step = clamp(Number(dt) || 0, 0, 0.05);
    if (game.phase === "ending") {
      game.remaining -= step;
      if (game.remaining <= 0) cancel();
    } else if (game.id === "jump") tickJump(step);
    else tickHide(step);
  }

  function hitRegions() {
    if (!game) return [];
    const elements = [game.panel, game.field];
    if (game.boxes) elements.push(...game.boxes.map((box) => box.node));
    return elements.map((element) => element.getBoundingClientRect());
  }

  function onPetClick() {
    if (!game) return false;
    if (game.id === "jump") jump();
    return true;
  }

  return { start, cancel, isActive: () => game != null, onPetClick, tick, hitRegions };
}
