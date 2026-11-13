export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function scheduleDue(schedule, now = new Date()) {
  if (!schedule?.enabled || schedule.lastRun === localDay(now)) return false;
  const day = now.getDay();
  if (schedule.days === "weekdays" && (day === 0 || day === 6)) return false;
  if (schedule.days === "weekends" && day !== 0 && day !== 6) return false;
  const [hours, minutes] = String(schedule.time).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  const dueAt = hours * 60 + minutes;
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < dueAt) return false;
  return schedule.catchUp === "run" || current < dueAt + 10;
}

/**
 * Model spend recorded for the user's local "today". The daily cap resets at
 * local midnight, like schedules; a record from another day counts as zero.
 */
export function spentOn(spend, now = new Date()) {
  return spend?.date === localDay(now) ? Number(spend.usd) || 0 : 0;
}
