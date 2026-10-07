// No network or storage access: both kinds of events describe a possible craving.
import { dayKey } from './core.js';
export function periodEvents(events, period = 'all', now = new Date()) {
  const today = dayKey(now), monday = new Date(now);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const start = dayKey(monday);
  return events.filter(e => ['saved', 'smoked'].includes(e.type) && Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= +now &&
    (period === 'all' || (period === 'today' ? e.day === today : e.day >= start && e.day <= today)));
}
export function hourlyPattern(events, period = 'all', now = new Date()) {
  const selected = periodEvents(events, period, now);
  const hours = Array(24).fill(0);
  for (const e of selected) hours[Number.isInteger(e.hour) && e.hour >= 0 && e.hour < 24 ? e.hour : new Date(e.at).getHours()]++;
  const days = new Set(selected.map(e => e.day)).size;
  // A three-hour rolling window includes midnight; ties are explicitly uncertain.
  const windows = hours.map((_, h) => hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24]);
  const max = Math.max(...windows), starts = windows.flatMap((n, h) => n === max ? [h] : []);
  const enough = selected.length >= 8 && (period === 'today' || days >= 3);
  let peak = null;
  if (enough && max >= 4 && max / selected.length >= .3) {
    // Prefer the window whose central hour is strongest; don't invent a winner among separate peaks.
    const central = Math.max(...starts.map(h => hours[(h + 1) % 24]));
    const best = starts.filter(h => hours[(h + 1) % 24] === central);
    if (best.length === 1) peak = { start: best[0], end: (best[0] + 3) % 24, count: max };
  }
  return { hours, total: selected.length, days, peak, summary: !enough ? 'もう少し記録すると傾向が見えてきます' : peak ? `${peak.start}時〜${peak.end === 0 ? 24 : peak.end}時ごろ${peak.end > 0 && peak.end < peak.start ? '（翌日）' : ''}` : 'いくつかの時間に分かれています' };
}
