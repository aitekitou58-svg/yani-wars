import { worldRecovery } from "./world.js";
export const dayKey = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const initialState = () => ({
  version: 1,
  revision: 0,
  settings: null,
  events: [],
});
export function validState(s) {
  return (
    !!s &&
    s.version === 1 &&
    Number.isSafeInteger(s.revision) &&
    s.revision >= 0 &&
    (s.settings === null ||
      (typeof s.settings.product?.id === "string" &&
        typeof s.settings.product?.name === "string" &&
        Number.isFinite(s.settings.product?.packPrice) &&
        s.settings.product.packPrice > 0 &&
        Number.isInteger(s.settings.product?.count) &&
        s.settings.product.count > 0 &&
        ["praise", "tease"].includes(s.settings.tone) &&
        Number.isFinite(s.settings.freeMinutes) &&
        s.settings.freeMinutes > 0)) &&
    Array.isArray(s.events) &&
    s.events.every(
      (e) =>
        typeof e.id === "string" &&
        ["saved", "smoked"].includes(e.type) &&
        Number.isFinite(Date.parse(e.at)) &&
        typeof e.day === "string" &&
        (e.type === "smoked" ||
          ["unitPrice", "lifeMinutes", "freeMinutes"].every(
            (k) => Number.isFinite(e[k]) && e[k] >= 0,
          )),
    ) &&
    new Set(s.events.map((e) => e.id)).size === s.events.length
  );
}
export function priceAt(product, now = new Date()) {
  const today = dayKey(now);
  const applicable = (product.prices || [])
    .filter((p) => !p.effectiveFrom || p.effectiveFrom <= today)
    .sort((a, b) =>
      (a.effectiveFrom || "").localeCompare(b.effectiveFrom || ""),
    );
  const p = applicable.at(-1);
  if (!p && product.effectiveFrom && product.effectiveFrom > today)
    throw Error("この商品の価格はまだ適用前です");
  return (p || product).packPrice / (p || product).count;
}
export function makeEvent(type, settings, config, now = new Date()) {
  return {
    id: crypto.randomUUID(),
    type,
    at: now.toISOString(),
    day: dayKey(now),
    hour: now.getHours(),
    ...(type === "saved"
      ? {
          productId: settings.product.id,
          unitPrice: priceAt(settings.product, now),
          lifeMinutes: config.lifeMinutesPerStick,
          freeMinutes: settings.freeMinutes,
        }
      : {}),
  };
}
export function totals(events, period = "all", now = new Date()) {
  const today = dayKey(now);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = dayKey(monday);
  return events
    .filter(
      (e) =>
        e.type === "saved" &&
        (period === "all" ||
          (period === "today"
            ? e.day === today
            : e.day >= start && e.day <= today)),
    )
    .reduce(
      (a, e) => ({
        count: a.count + 1,
        money: a.money + e.unitPrice,
        life: a.life + e.lifeMinutes,
        free: a.free + e.freeMinutes,
      }),
      { count: 0, money: 0, life: 0, free: 0 },
    );
}
export function recovery(n) {
  return worldRecovery(n);
}
const mix = (a, b, t) => Math.round(a + (b - a) * t);
export function palette(n) {
  const t = recovery(n);
  const rgb = (a, b, amount = t) => `rgb(${a.map((v, i) => mix(v, b[i], amount)).join(",")})`;
  return {
    progress: t,
    bg: rgb([207, 197, 160], [248, 250, 243]),
    ink: rgb([48, 48, 32], [26, 58, 44]),
    green: rgb([83, 85, 49], [34, 108, 70]),
    hill: rgb([140, 137, 94], [135, 179, 135]),
    water: rgb([155, 150, 109], [49, 161, 206], t * t),
    waterLight: rgb([183, 177, 139], [151, 224, 240], t * t),
    sky: rgb([189, 178, 136], [219, 239, 221]),
    leaf: rgb([106, 121, 66], [51, 124, 78]),
    leafLight: rgb([142, 151, 91], [120, 169, 98]),
    bark: rgb([88, 76, 49], [89, 105, 68]),
    flower: rgb([190, 155, 94], [245, 231, 183]),
    blush: rgb([174, 146, 113], [215, 154, 132]),
  };
}
export function duration(n) {
  return n >= 60
    ? `${Math.floor(n / 60)}時間${Math.round(n % 60) ? `${Math.round(n % 60)}分` : ""}`
    : `${Math.round(n)}分`;
}
export function craving(events, now = new Date()) {
  const past = events.filter((e) => Date.parse(e.at) <= +now);
  if (!past.length) return false;
  const last = [...past].sort((a,b) => Date.parse(b.at)-Date.parse(a.at)).find((e) => e.type === "smoked");
  const gap = last ? (+now - Date.parse(last.at)) / 60000 : Infinity;
  if (past.length < 12) return gap >= 55 && gap <= 100;
  const recent = [...past].sort((a,b) => Date.parse(a.at)-Date.parse(b.at)).slice(-120);
  const hour = now.getHours();
  const same = recent.filter(
    (e) => Math.min(Math.abs((e.hour ?? new Date(e.at).getHours()) - hour), 24 - Math.abs((e.hour ?? new Date(e.at).getHours()) - hour)) <= 1,
  );
  const weekday = same.filter((e) => new Date(e.at).getDay() === now.getDay());
  const intervals = past
    .filter((e) => e.type === "smoked")
    .map((e) => Date.parse(e.at))
    .sort((a, b) => a - b)
    .map((t, i, a) => (i ? (t - a[i - 1]) / 60000 : 0))
    .filter((x) => x >= 15 && x < 480)
    .sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)] || 80;
  return (
    (same.length / recent.length) * 0.6 +
      (weekday.length / recent.length) * 0.2 +
      (gap >= median * 0.75 && gap <= median * 1.3 ? 0.35 : 0) >
    0.43
  );
}
