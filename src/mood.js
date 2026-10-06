/** Pet mood and friendship stage come from saved interaction history and hunger. */
export function petMood(profile, hunger = 0) {
  const interactions = ["meals", "pats", "pets", "fetches", "games"].reduce((sum, key) => sum + Math.max(0, Number(profile?.[key]) || 0), 0);
  const level = interactions >= 25 ? 3 : interactions >= 5 ? 2 : 1;
  const mood = hunger >= 90 ? "famished" : hunger >= 70 ? "hungry" : interactions >= 25 ? "devoted" : interactions >= 5 ? "friendly" : "curious";
  return { level, mood, interactions };
}
