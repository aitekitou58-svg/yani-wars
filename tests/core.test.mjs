import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  validState,
  makeEvent,
  totals,
  recovery,
  palette,
  priceAt,
  dayKey,
  craving,
} from "../src/core.js";
const product = {
  id: "test",
  name: "Test",
  packPrice: 620,
  count: 20,
  prices: [
    { packPrice: 600, count: 20, effectiveFrom: "2025-01-01" },
    { packPrice: 620, count: 20, effectiveFrom: "2026-10-01" },
  ],
};
const settings = { product, tone: "praise", freeMinutes: 5 };
const config = { lifeMinutesPerStick: 20 };
test("first state and malformed data validation", () => {
  assert.ok(validState(initialState()));
  assert.equal(validState({ ...initialState(), events: [{}] }), false);
  assert.equal(validState({ ...initialState(), settings: {} }), false);
});
test("unit price is snapshotted across a price change", () => {
  const before = makeEvent(
    "saved",
    settings,
    config,
    new Date("2026-09-30T12:00:00"),
  );
  const after = makeEvent(
    "saved",
    settings,
    config,
    new Date("2026-10-01T12:00:00"),
  );
  const events = [
    ...Array.from({ length: 100 }, () => ({
      ...before,
      id: crypto.randomUUID(),
    })),
    ...Array.from({ length: 100 }, () => ({
      ...after,
      id: crypto.randomUUID(),
    })),
  ];
  assert.equal(totals(events).money, 6100);
  assert.equal(totals(events).life, 4000);
  assert.equal(totals(events).free, 1000);
});
test("smoking does not reduce achievements or world color", () => {
  const a = makeEvent("saved", settings, config);
  const b = makeEvent("smoked", settings, config);
  assert.deepEqual(totals([a]), totals([a, b]));
  assert.equal(recovery(totals([a]).count), recovery(totals([a, b]).count));
});
test("changed time settings do not recalculate previous entries", () => {
  const a = makeEvent("saved", settings, config);
  const b = makeEvent("saved", { ...settings, freeMinutes: 7 }, config);
  assert.equal(totals([a, b]).free, 12);
});
test("local midnight respects recorded day; week begins Monday", () => {
  const a = makeEvent("saved", settings, config, new Date(2026, 9, 4, 23, 59));
  const b = makeEvent("saved", settings, config, new Date(2026, 9, 5, 0, 1));
  assert.equal(totals([a, b], "today", new Date(2026, 9, 5, 12)).count, 1);
  assert.equal(totals([a, b], "week", new Date(2026, 9, 5, 12)).count, 1);
  assert.equal(dayKey(new Date(2026, 9, 5)), "2026-10-05");
});
test("recovery continuously increases past 1000 successes", () => {
  let last = -1;
  for (let n = 0; n < 10000; n++) {
    const p = recovery(n);
    assert.ok(p > last && p < 1);
    last = p;
  }
  assert.ok(recovery(500) > 0.8);
  assert.notDeepEqual(palette(0), palette(500));
});
test("startup prompting is restrained with sparse history", () => {
  assert.equal(craving([]), false);
  const now = new Date("2026-10-07T12:00:00Z");
  const e = makeEvent("smoked", settings, config, new Date(+now - 70 * 60000));
  assert.equal(craving([e], now), true);
  assert.equal(craving([e], new Date(+now + 100 * 60000)), false);
});
test("future price is not applied early", () => {
  assert.equal(priceAt(product, new Date("2026-09-30T12:00:00")), 30);
  assert.equal(priceAt(product, new Date("2026-10-01T12:00:00")), 31);
  assert.throws(() =>
    priceAt({ ...product, prices: [], effectiveFrom: "2030-01-01" }),
  );
});
