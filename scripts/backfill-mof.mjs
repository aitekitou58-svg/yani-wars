import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const INDEX = "https://www.mof.go.jp/policy/tab_salt/topics/kouriteika.html";
const key = (name) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・･'’]/g, "");
const aliases = [
  ["メビウス", "MEVIUS", "マイルドセブン"],
  ["セブンスター", "SEVEN STARS"],
  ["ピース", "PEACE"],
  ["テリア", "TEREA", "IQOS", "アイコス"],
  ["センティア", "SENTIA", "IQOS", "アイコス"],
  ["ミックス", "MIIX", "lil HYBRID"],
  ["マールボロ", "Marlboro", "マルボロ"],
  ["キャメル", "CAMEL"],
  ["ケント", "KENT"],
  ["ラッキー", "LUCKY STRIKE", "ラッキーストライク"],
  ["パーラメント", "PARLIAMENT"],
  ["ウィンストン", "WINSTON"],
  ["ダビドフ", "DAVIDOFF"],
  ["ガラム", "GUDANG GARAM"],
  ["ジタン", "GITANES"],
  ["ゴロワーズ", "GAULOISES"],
  ["アメリカンスピリット", "AMERICAN SPIRIT", "アメスピ"],
  ["ブラックデビル", "BLACK DEVIL"],
  ["ブラック・デビル", "BLACK DEVIL"],
  ["ソブラニー", "SOBRANIE"],
  ["クール", "KOOL"],
  ["バージニア", "VIRGINIA"],
  ["ボヘーム", "BOHEM"],
  ["ヒーツ", "HEETS", "IQOS"],
  ["エボ", "EVO", "Ploom", "プルーム"],
  ["プルーム", "Ploom"],
  ["glo", "グロー"],
  ["ヴァルト", "VIRTO"],
  ["ネオ", "NEO"],
  ["ハイライト", "hi-lite"],
  ["ホープ", "HOPE"],
];
export function searchAliases(name) {
  return [
    ...new Set([
      name.normalize("NFKC"),
      ...aliases.filter((a) => key(name).includes(key(a[0]))).flat(),
    ]),
  ];
}
function category(row) {
  if (row.type === "紙巻き") return "紙巻き";
  if (/テリア|センティア|ヒーツ/.test(row.name)) return "IQOS";
  if (/プルーム/.test(row.name)) return "Ploom";
  if (/glo|グロー|ヴァルト/i.test(row.name)) return "glo";
  return "その他加熱式";
}
export function integrateMOF(master, rows, today) {
  const next = structuredClone(master);
  const lookup = new Map(next.products.map((p, i) => [key(p.name), i]));
  for (const row of rows.sort((a, b) =>
    (a.approvedAt || "").localeCompare(b.approvedAt || ""),
  )) {
    if (
      !["紙巻き", "加熱式"].includes(row.type) ||
      !row.count ||
      row.packPrice <= 0
    )
      continue;
    const identity = key(row.name);
    let i = lookup.get(identity);
    let existing = i === undefined ? null : next.products[i];
    const price = {
      packPrice: row.packPrice,
      count: row.count,
      effectiveFrom: row.effectiveFrom,
      approvedAt: row.approvedAt,
      source: row.source,
    };
    if (!existing) {
      if (row.effectiveFrom && row.effectiveFrom > today) continue; // A future-only approval is not an active price yet.
      existing = {
        id:
          "mof-" +
          createHash("sha256").update(identity).digest("hex").slice(0, 16),
        name: row.name,
        manufacturer: "不明（認可資料に記載なし）",
        importer: null,
        category: category(row),
        type: row.type,
        packPrice: row.packPrice,
        count: row.count,
        unitPrice: row.packPrice / row.count,
        effectiveFrom: row.effectiveFrom,
        status: "approved",
        sources: [row.source],
        verifiedAt: today,
        approvedAt: row.approvedAt,
        countries: row.countries,
        aliases: searchAliases(row.name),
        prices: [price],
      };
      next.products.push(existing);
      lookup.set(identity, next.products.length - 1);
      continue;
    }
    existing.sources = [...new Set([...existing.sources, row.source])];
    existing.countries = [
      ...new Set([...(existing.countries || []), ...row.countries]),
    ];
    existing.aliases = [
      ...new Set([
        ...(existing.aliases || []),
        ...searchAliases(existing.name),
      ]),
    ];
    if (
      !existing.prices.some(
        (p) =>
          p.packPrice === price.packPrice &&
          p.count === price.count &&
          p.effectiveFrom === price.effectiveFrom,
      )
    )
      existing.prices.push(price);
    // A current manufacturer catalog outranks an older approval. A dated new revision outranks both.
    const datedApplicable =
      row.effectiveFrom &&
      row.effectiveFrom <= today &&
      (!existing.effectiveFrom || row.effectiveFrom >= existing.effectiveFrom);
    const currentApproval =
      existing.status === "approved" &&
      !row.effectiveFrom &&
      (!existing.approvedAt || row.approvedAt >= existing.approvedAt);
    if (datedApplicable || currentApproval) {
      if (
        existing.effectiveFrom &&
        row.effectiveFrom &&
        existing.effectiveFrom === row.effectiveFrom &&
        (existing.packPrice !== row.packPrice || existing.count !== row.count)
      )
        throw new Error("Conflicting same-date MOF price: " + row.name);
      const revised =
        existing.packPrice !== row.packPrice ||
        existing.count !== row.count ||
        existing.effectiveFrom !== row.effectiveFrom;
      Object.assign(existing, {
        packPrice: row.packPrice,
        count: row.count,
        unitPrice: row.packPrice / row.count,
        effectiveFrom: row.effectiveFrom,
      });
      if (!existing.approvedAt || row.approvedAt > existing.approvedAt)
        existing.approvedAt = row.approvedAt;
      if (revised) existing.verifiedAt = today;
    }
  }
  for (const p of next.products) {
    p.aliases = [...new Set([...(p.aliases || []), ...searchAliases(p.name)])];
    p.importer ??= null;
  }
  return next;
}
export async function backfill({
  today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  ),
  write = true,
} = {}) {
  const cache = path.join(ROOT, "work/mof");
  await mkdir(cache, { recursive: true });
  const r = await fetch(INDEX, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`MOF index HTTP ${r.status}`);
  const html = await r.text();
  const urls = [
    ...new Set(
      [...html.matchAll(/href=["']([^"']+\.pdf)["']/gi)]
        .map((m) => new URL(m[1], INDEX).href)
        .filter(
          (u) =>
            new URL(u).hostname === "www.mof.go.jp" && /kouriteika/i.test(u),
        ),
    ),
  ].sort();
  if (urls.length < 20)
    throw new Error("MOF index unrecognized; retained current catalog");
  const results = [],
    failed = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const file = path.join(
        cache,
        createHash("sha256").update(url).digest("hex").slice(0, 16) + ".pdf",
      );
      try {
        let bytes;
        try {
          if (!process.env.MOF_USE_CACHE)
            throw new Error("Refresh official PDF");
          bytes = await readFile(file);
        } catch {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(30000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.subarray(0, 4).toString() !== "%PDF")
            throw new Error("Not a PDF");
          await writeFile(file, bytes);
        }
        const digest = createHash("sha256").update(bytes).digest("hex");
        let data;
        try {
          data = JSON.parse(await readFile(file + ".json", "utf8"));
          if (data.digest !== digest) throw new Error("Changed");
        } catch {
          const { stdout } = await run(
            process.env.PYTHON || "python",
            ["scripts/parse-mof.py", file, url],
            {
              cwd: ROOT,
              maxBuffer: 16 * 1024 * 1024,
              env: { ...process.env, PYTHONIOENCODING: "utf-8" },
            },
          );
          data = { digest, ...JSON.parse(stdout) };
          await writeFile(file + ".json", JSON.stringify(data));
        }
        results.push({ url, ...data });
      } catch (error) {
        failed.push({ url, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  results.sort((a, b) => a.url.localeCompare(b.url));
  const report = {
    index: INDEX,
    documents: urls.length,
    parsed: results.length,
    failed,
    acceptedRows: results.reduce((n, r) => n + r.products.length, 0),
    quarantinedRows: results.reduce((n, r) => n + r.quarantine.length, 0),
    sources: results.map((r) => ({
      url: r.url,
      sha256: r.digest,
      accepted: r.products.length,
      quarantine: r.quarantine,
    })),
  };
  await writeFile(
    path.join(ROOT, "work/mof-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (failed.length)
    throw new Error(
      `${failed.length} MOF documents failed. No master changed. See work/mof-report.json`,
    );
  const masterPath = path.join(ROOT, "public/data/products.json");
  const master = JSON.parse(await readFile(masterPath, "utf8"));
  const next = integrateMOF(
    master,
    results.flatMap((r) => r.products),
    today,
  );
  const changed =
    JSON.stringify(master.products) !== JSON.stringify(next.products);
  if (changed) {
    next.version = master.version + 1;
    next.checkedAt = today;
    next.coverage =
      "財務省公開認可資料の紙巻き・加熱式とメーカー公式表。認可は現行販売を保証しません。曖昧な結合セルは保留。輸入者・製造者の記載がない場合は不明。";
  }
  if (write && changed) {
    await writeFile(masterPath + ".tmp", JSON.stringify(next, null, 2) + "\n");
    await rename(masterPath + ".tmp", masterPath);
  }
  const publicReport = {
    index: INDEX,
    documents: report.documents,
    parsed: report.parsed,
    acceptedRows: report.acceptedRows,
    quarantinedRows: report.quarantinedRows,
    oldest: urls[0],
    newest: urls.at(-1),
    limitations: [
      "過去資料には販売終了済み商品も含まれます。販売状態 approved は価格認可済み・販売継続未確認です。",
      "認可表にメーカー・輸入者の記載がない場合は推測しません。",
      "曖昧な結合セルは既存価格を維持し、レポートに保留します。",
    ],
  };
  if (write)
    await writeFile(
      path.join(ROOT, "public/data/catalog-coverage.json"),
      JSON.stringify(publicReport, null, 2) + "\n",
    );
  console.log(
    `MOF: ${urls.length} documents; ${report.acceptedRows} accepted rows; ${report.quarantinedRows} quarantined rows; ${next.products.length} products.`,
  );
  return { changed, master: next, report, publicReport };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  backfill().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
