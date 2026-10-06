import test from "node:test";
import assert from "node:assert/strict";
import { publicShareUrl, shareContent } from "../src/sharing.js";
import { makeEvent } from "../src/core.js";
const settings = {
  product: {
    id: "private-brand",
    name: "共有しない銘柄",
    packPrice: 620,
    count: 20,
  },
  tone: "praise",
  freeMinutes: 5,
};
const now = new Date(2026, 9, 7, 12);
const events = [
  makeEvent(
    "saved",
    settings,
    { lifeMinutesPerStick: 20 },
    new Date(2026, 9, 6, 12),
  ),
  makeEvent("saved", settings, { lifeMinutesPerStick: 20 }, now),
  makeEvent("smoked", settings, {}, now),
];
test("published app URL retains repo path and removes tracking query/hash", () => {
  assert.equal(
    publicShareUrl(
      "",
      "https://user.github.io/yani-wars/?product=private#settings",
    ),
    "https://user.github.io/yani-wars/",
  );
  assert.equal(
    publicShareUrl(
      "https://app.example.org/index.html?secret=x#x",
      "http://localhost:4173/",
    ),
    "https://app.example.org/",
  );
});
test("local previews, private networks, invalid and credential URLs are never shared", () => {
  for (const url of [
    "http://localhost:4173/",
    "https://localhost/",
    "https://127.0.0.1/",
    "https://10.0.0.1/",
    "https://192.168.1.10/",
    "https://172.20.0.2/",
    "https://100.64.0.1/",
    "https://preview.local/",
    "https://[::1]/",
    "file:///app",
    "javascript:alert(1)",
    "https://user:password@example.org/",
  ])
    assert.equal(publicShareUrl(url, "https://valid.example.org/"), null, url);
});
test("today and cumulative caption/amounts use the same period", () => {
  const today = shareContent(events, "today", "https://app.example.org/", now),
    all = shareContent(events, "all", "https://app.example.org/", now);
  assert.equal(today.stats.count, 1);
  assert.equal(today.stats.money, 31);
  assert.equal(all.stats.count, 2);
  assert.equal(all.stats.money, 62);
  assert.match(today.caption, /今日1本/);
  assert.match(all.caption, /累計2本/);
  assert.match(all.caption, /寿命換算 40分/);
  assert.match(all.caption, /自由時間 10分/);
});
test("shared content contains no brand, time, event IDs or extra user data", () => {
  const content = shareContent(events, "all", "https://app.example.org/", now);
  const shared = JSON.stringify(content);
  for (const secret of [
    settings.product.id,
    settings.product.name,
    events[0].id,
    events[0].at,
  ])
    assert.ok(!shared.includes(secret));
  assert.deepEqual(Object.keys(content.data).sort(), ["text", "title", "url"]);
});
test("X composer contains encoded text and a clean URL", () => {
  const content = shareContent(
      events,
      "all",
      "https://app.example.org/yani/",
      now,
    ),
    intent = new URL(content.intent);
  assert.equal(intent.origin, "https://twitter.com");
  assert.equal(intent.pathname, "/intent/tweet");
  assert.equal(intent.searchParams.get("text"), content.text);
  assert.equal(intent.searchParams.get("url"), "https://app.example.org/yani/");
});
test("before publication, image/caption sharing never includes a fake or local URL", () => {
  const content = shareContent(events, "today", null, now);
  assert.equal(content.intent, null);
  assert.equal(content.data.url, undefined);
  assert.equal(content.caption, content.text);
  assert.ok(!content.caption.includes("localhost"));
});
