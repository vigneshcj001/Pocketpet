// Pure behavior rules shared by the overlay and its regression checks.
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function inQuietHours(start, end, date = new Date()) {
  const minutes = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  };
  const from = minutes(start), to = minutes(end);
  const current = date.getHours() * 60 + date.getMinutes();
  if (from === to) return false;
  return from < to ? current >= from && current < to : current >= from || current < to;
}

export function focusActive(settings, environment, date = new Date()) {
  return Boolean((settings.focusFullscreen && environment.fullscreen) ||
    (settings.quietHours && inQuietHours(settings.quietStart, settings.quietEnd, date)));
}

export function hungerAfter(hunger, elapsedMs, rate, paused = false) {
  return clamp(hunger + (paused ? 0 : Math.max(0, elapsedMs) / 60000 * (100 / 150) * rate / 100), 0, 100);
}

export function nearestMonitor(monitors, point) {
  if (!monitors.length) return { x: 0, y: 0, w: 1920, h: 1080 };
  const distance = (r) => Math.hypot(point.x - clamp(point.x, r.x, r.x + r.w), point.y - clamp(point.y, r.y, r.y + r.h));
  return monitors.reduce((best, item) => distance(item) < distance(best) ? item : best);
}

export function insetBounds(rect, margin, size, bottomOnly = false) {
  const inset = Math.min(margin, Math.max(0, (Math.min(rect.w, rect.h) - size) / 2));
  const result = { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 };
  if (bottomOnly) {
    const height = Math.min(result.h, Math.max(size * 2.5, 180));
    result.y += result.h - height;
    result.h = height;
  }
  return result;
}

export function exclusionRect(bounds, area) {
  if (!area?.enabled) return null;
  return { x: bounds.x + bounds.w * area.x / 100, y: bounds.y + bounds.h * area.y / 100,
    w: bounds.w * Math.min(area.w, 100 - area.x) / 100, h: bounds.h * Math.min(area.h, 100 - area.y) / 100 };
}

export function constrainPoint(point, bounds, size, excluded = null) {
  const maxX = Math.max(bounds.x, bounds.x + bounds.w - size);
  const maxY = Math.max(bounds.y, bounds.y + bounds.h - size);
  const result = { x: clamp(point.x, bounds.x, maxX), y: clamp(point.y, bounds.y, maxY) };
  if (!excluded || result.x + size <= excluded.x || result.x >= excluded.x + excluded.w ||
      result.y + size <= excluded.y || result.y >= excluded.y + excluded.h) return result;
  const options = [
    { x: excluded.x - size, y: result.y }, { x: excluded.x + excluded.w, y: result.y },
    { x: result.x, y: excluded.y - size }, { x: result.x, y: excluded.y + excluded.h },
  ].filter(p => p.x >= bounds.x && p.x <= maxX && p.y >= bounds.y && p.y <= maxY);
  // An exclusion covering the whole area cannot have a valid placement. The
  // caller can hide the pet; this result still stays within a real monitor.
  return options.sort((a, b) => Math.hypot(a.x - result.x, a.y - result.y) - Math.hypot(b.x - result.x, b.y - result.y))[0] ?? result;
}

export function formatCountdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
