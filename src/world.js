// Visual progression inspired by cessation timelines, not a measure of health.
// Only cumulative saved sticks are used, so smoking never reverses progress.
export const WORLD_RULES = Object.freeze({
  sticksPerDay: 20,
  daysPerMonth: 30,
});
export const WORLD_TIMELINE = Object.freeze([
  { days: 0, color: 0 },
  { days: 20 / 1440, color: 0.02 },
  { days: 8 / 24, color: 0.1 },
  { days: 1, color: 0.22 },
  { days: 2, color: 0.36 },
  { days: 3, color: 0.48 },
  { days: 14, color: 0.82 },
  { days: 25, color: 0.92 },
  { days: 30, color: 0.93 },
  { days: 90, color: 0.96 },
  { days: 270, color: 0.985 },
]);
export const worldDays = (n) =>
  Math.max(0, Number.isFinite(n) ? n : 0) / WORLD_RULES.sticksPerDay;
export function worldRecovery(n) {
  const days = worldDays(n);
  for (let i = 1; i < WORLD_TIMELINE.length; i++) {
    const end = WORLD_TIMELINE[i],
      start = WORLD_TIMELINE[i - 1];
    if (days <= end.days) {
      const t = (days - start.days) / (end.days - start.days),
        smooth = t * t * (3 - 2 * t);
      return start.color + (end.color - start.color) * smooth;
    }
  }
  // Always leave some room for more light, even after nine months equivalent.
  return 0.985 + (0.015 * (days - 270)) / (days - 270 + 365);
}
