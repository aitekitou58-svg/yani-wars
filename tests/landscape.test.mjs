import test from "node:test";
import assert from "node:assert/strict";
import { recovery, palette } from "../src/core.js";
import { vegetation, landscapeSvg, plantGrowth } from "../src/landscape.js";
import { worldDays, WORLD_TIMELINE, WORLD_RULES } from "../src/world.js";
test("twenty saved sticks is one visual day; medical milestones interpolate continuously", () => {
  assert.equal(worldDays(20), 1);
  assert.equal(worldDays(600), 30);
  assert.equal(worldDays(5400), 270);
  for (const anchor of WORLD_TIMELINE)
    assert.ok(
      Math.abs(
        recovery(anchor.days * WORLD_RULES.sticksPerDay) - anchor.color,
      ) < 1e-10,
    );
  for (const anchor of WORLD_TIMELINE.slice(1)) {
    const n = anchor.days * 20;
    assert.ok(Math.abs(recovery(n + 0.001) - recovery(n - 0.001)) < 0.001);
  }
});
test("color clears sooner without completing or regressing the world", () => {
  assert.ok(recovery(3) > 0.04);
  assert.equal(recovery(20), 0.22);
  assert.ok(recovery(60) >= 0.48);
  assert.ok(recovery(100) < 1);
  assert.ok(recovery(1000) > recovery(100));
  assert.equal(recovery(-1), 0);
  assert.notDeepEqual(palette(3), palette(0));
});
test("trees and flowers grow continuously at fixed positions and never disappear", () => {
  const base = vegetation(0);
  assert.ok(base.trees.every((t) => t.growth === 0));
  assert.ok(vegetation(600).trees.filter(t => t.growth > .18).length >= 6);
  const forest = vegetation(5400).trees;
  assert.ok(Math.max(...forest.map(t => t.height)) > Math.min(...forest.map(t => t.height)) * 2.5);
  assert.ok(vegetation(5400).flowers.filter(t => t.x > 245 && t.x < 330).length >= 65);
  assert.ok(vegetation(620).trees.some((t) => t.growth > 0));
  assert.ok(vegetation(600).flowers.every((t) => t.growth === 0));
  assert.ok(vegetation(620).flowers.some((t) => t.growth > 0));
  let previous = base;
  for (const n of [1, 3, 10, 20, 50, 100, 600, 1800, 5400, 10000]) {
    const next = vegetation(n);
    for (const kind of ["trees", "flowers", "tufts"])
      next[kind].forEach((p, i) => {
        assert.ok(
          p.growth >= previous[kind][i].growth && p.growth < 1 + Number.EPSILON,
        );
        assert.equal(p.x, previous[kind][i].x);
        assert.equal(p.y, previous[kind][i].y);
      });
    previous = next;
  }
  assert.ok(vegetation(5400).trees.filter((t) => t.growth > 0.15).length >= 45);
  assert.ok(
    vegetation(5400).flowers.filter((t) => t.growth > 0.15).length >= 240,
  );
  assert.ok(plantGrowth(20.01, 0, 16) - plantGrowth(20, 0, 16) < 0.001);
});
test("landscape is offline SVG and shared images use the same plant growth", () => {
  const normal = landscapeSvg(20),
    compact = landscapeSvg(20, { compact: true });
  assert.ok(
    normal.includes('data-plant="tree"') &&
      normal.includes('data-plant="flower"'),
  );
  assert.equal(
    (normal.match(/data-plant=/g) || []).length,
    (compact.match(/data-plant=/g) || []).length,
  );
  assert.ok(!normal.includes("<script") && !normal.includes("href="));
});

test("mature flower fields surround a blue stream with fish and reduced-motion support", () => {
  const scene = landscapeSvg(5400);
  const young = landscapeSvg(600);
  assert.ok(scene.includes('data-animal="fish" data-growth="0.9502"'));
  assert.ok(young.includes('data-animal="fish" data-growth="0"'));
  assert.ok(scene.includes(palette(5400).water));
  assert.ok(scene.includes("prefers-reduced-motion:reduce"));
  assert.ok(!scene.includes('id="world-water-600-full"'));
  const flowers = vegetation(5400).flowers;
  assert.ok(flowers.some(p => p.y < 325) && flowers.some(p => p.y > 410));
  assert.ok(flowers.every(p => p.x < 305 + (420 - p.y) * .65 - 9 || p.x > 375 + (420 - p.y) * .23 + 9));
});
