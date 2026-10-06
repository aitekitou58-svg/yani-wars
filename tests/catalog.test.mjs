import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseJT,
  mergeCatalog,
  parseMOFLinks,
  SOURCES,
} from "../scripts/update-products.mjs";
import { integrateMOF, searchAliases } from "../scripts/backfill-mof.mjs";
const source = SOURCES[0];
const row = (name = "銘柄", price = "580", count = "20") =>
  `<tr><td>${name}</td><td>1977年6月1日</td><td>10mg</td><td>0.8mg</td><td>${count}本</td><td>${price}円</td></tr>`;
const html = `<table><tr><th>商品名</th><th>本数</th><th>価格</th></tr>${row("A")}${row("B")}${row("C")}</table>`;
test("JT price table preserves unknown price effective date", () => {
  const rows = parseJT(html, source, "2026-10-07");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].unitPrice, 29);
  assert.equal(rows[0].effectiveFrom, null);
});
test("malformed / partial tables fail closed", () => {
  assert.throws(() =>
    parseJT("<html>Access Denied</html>", source, "2026-10-07"),
  );
  assert.throws(() =>
    parseJT(html.replace("20本", "本数不明"), source, "2026-10-07"),
  );
});
test("no changes means no timestamp or version churn; missing product is not discontinued", () => {
  const products = parseJT(html, source, "2026-10-07");
  const master = { version: 1, checkedAt: "2026-10-07", products };
  const next = mergeCatalog(master, products.slice(0, 2), "2026-10-08");
  assert.equal(next.changed, false);
  assert.deepEqual(next.master, master);
});
test("unverified price revision is rejected; dated revision appends history", () => {
  const products = parseJT(html, source, "2026-10-07");
  const master = { version: 1, products };
  assert.throws(() =>
    mergeCatalog(master, [{ ...products[0], packPrice: 620 }], "2026-10-08"),
  );
  const result = mergeCatalog(
    master,
    [
      {
        ...products[0],
        packPrice: 620,
        unitPrice: 31,
        effectiveFrom: "2026-10-08",
      },
    ],
    "2026-10-08",
  );
  assert.equal(result.master.products[0].prices.length, 2);
  assert.equal(master.products[0].packPrice, 580);
});
test("future revision never overwrites current price", () => {
  const products = parseJT(html, source, "2026-10-07");
  const result = mergeCatalog(
    { version: 1, products },
    [{ ...products[0], packPrice: 620, effectiveFrom: "2027-01-01" }],
    "2026-10-07",
  );
  assert.equal(result.master.products[0].packPrice, 580);
  assert.equal(result.master.products[0].prices.length, 2);
});
test("MOF only parses approved-domain PDF links", () => {
  assert.equal(
    parseMOFLinks('<a href="20260826_kouriteikahenkou.pdf">PDF</a>').length,
    1,
  );
  assert.throws(() =>
    parseMOFLinks('<a href="https://example.org/20260826.pdf">PDF</a>'),
  );
});
test("shipped catalog has source, consistent price, unique identity and all requested categories", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../public/data/products.json", import.meta.url)),
  );
  assert.equal(
    new Set(catalog.products.map((p) => p.id)).size,
    catalog.products.length,
  );
  for (const p of catalog.products) {
    assert.equal(p.unitPrice, p.packPrice / p.count);
    assert.ok(p.sources.length);
    assert.ok(p.verifiedAt);
  }
  for (const category of ["紙巻き", "Ploom", "IQOS", "glo", "その他加熱式"])
    assert.ok(catalog.products.some((p) => p.category === category));
  assert.equal(
    catalog.products.find((p) => p.name === "テリア・レギュラー").packPrice,
    640,
  );
});
test("MOF backfill is idempotent across days and unknown manufacturer stays unknown", () => {
  const rows = [
    {
      name: "海外・サンプル",
      type: "紙巻き",
      packPrice: 700,
      count: 20,
      effectiveFrom: "2026-01-01",
      approvedAt: "2025-12-01",
      source: "https://www.mof.go.jp/example.pdf",
      countries: ["ドイツ"],
    },
  ];
  const initial = { version: 1, products: [] };
  const first = integrateMOF(initial, rows, "2026-10-07");
  const next = integrateMOF(first, rows, "2026-10-08");
  assert.deepEqual(next, first);
  assert.equal(first.products[0].status, "approved");
  assert.equal(first.products[0].importer, null);
});
test("MOF dated future price is retained without altering present price", () => {
  const current = {
    name: "テスト",
    type: "紙巻き",
    packPrice: 600,
    count: 20,
    effectiveFrom: "2026-01-01",
    approvedAt: "2025-12-01",
    source: "https://www.mof.go.jp/old.pdf",
    countries: ["日本"],
  };
  const first = integrateMOF(
    { version: 1, products: [] },
    [current],
    "2026-10-07",
  );
  const next = integrateMOF(
    first,
    [
      {
        ...current,
        packPrice: 650,
        effectiveFrom: "2027-01-01",
        approvedAt: "2026-10-01",
      },
    ],
    "2026-10-07",
  );
  assert.equal(next.products[0].packPrice, 600);
  assert.equal(next.products[0].prices.length, 2);
});
test("English aliases match common imported katakana brands", () => {
  assert.ok(searchAliases("マールボロ・ボックス").includes("Marlboro"));
  assert.ok(searchAliases("ブラックデビル").includes("BLACK DEVIL"));
});
