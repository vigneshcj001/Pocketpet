import { inQuietHours } from "./behavior.js";

/** Foreground application rules override quiet hours; fullscreen protection wins. */
export function effectivePetMode(settings, environment, date = new Date()) {
  if (settings.focusFullscreen && environment.fullscreen) return settings.focusAction;
  const app = String(environment.activeApp || "").toLowerCase();
  const rule = settings.appProfiles?.find((item) => item.app === app);
  if (rule) return rule.mode;
  if (settings.quietHours && inQuietHours(settings.quietStart, settings.quietEnd, date)) return settings.focusAction;
  return "playful";
}
