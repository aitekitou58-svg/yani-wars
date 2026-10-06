/** Official-source updater. Never infer prices, dates, or withdrawal from missing rows.
 * Primary: all linked MOF PDFs with geometric merged-cell parsing and quarantine.
 * Secondary: JT product tables; PMI and BAT official page availability monitoring.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { backfill, searchAliases } from "./backfill-mof.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MASTER = path.join(ROOT, "public/data/products.json");
export const SOURCES = [
  ...["mevius", "sevenstars", "peace", "plooms"].map((family) => ({
    id: `jt-${family}`,
    url: `https://www.jti.co.jp/tobacco/products/${family}/index.html`,
    manufacturer: "JT",
    category: family === "plooms" ? "Ploom" : "紙巻き",
    adapter: "jt-table",
  })),
  {
    id: "mof",
    url: "https://www.mof.go.jp/policy/tab_salt/topics/kouriteika.html",
    adapter: "mof-monitor",
  },
  {
    id: "pmi",
    url: "https://www.pmi.com/markets/japan/ja/media-center",
    adapter: "monitor",
    marker: /フィリップ|Philip/,
  },
  {
    id: "bat",
    url: "https://www.batj.com/",
    adapter: "monitor",
    marker: /BAT|ブリティッシュ/i,
  },
];

export function plain(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([a-f\d]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}
export function productId(name, manufacturer) {
  return (
    manufacturer.toLowerCase().replace(/\W/g, "") +
    "-" +
    createHash("sha256")
      .update(name.normalize("NFKC"))
      .digest("hex")
      .slice(0, 12)
  );
}
export function parseJT(html, source, verifiedAt) {
  if (!/商品名/.test(html) || !/本数/.test(html) || !/価格/.test(html))
    throw new Error(`${source.id}: product table headers missing`);
  const products = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((m) => plain(m[1]));
    if (!cells.length || /商品名/.test(cells[0])) continue;
    const countCell = cells.find((c) => /^\d+\s*本$/.test(c));
    const priceCell = cells.find((c) => /^[\d,]+\s*円/.test(c));
    if (!countCell && !priceCell) continue; // Footnotes are not product rows.
    if (!countCell || !priceCell || cells.length < 4)
      throw new Error(`${source.id}: ambiguous row`);
    const name = cells[0];
    const count = Number(countCell.replace(/\D/g, ""));
    const packPrice = Number(priceCell.match(/^[\d,]+/)[0].replace(/,/g, ""));
    if (
      count < 1 ||
      count > 100 ||
      packPrice < 100 ||
      packPrice > 10000 ||
      name.length > 120
    )
      throw new Error(`${source.id}: implausible row`);
    // The release date column is NOT the effective date of today's price.
    const status = /販売を終了|廃止させて/.test(cells.join(" "))
      ? "discontinuing"
      : "active";
    products.push({
      id: productId(name, source.manufacturer),
      name,
      manufacturer: source.manufacturer,
      category: source.category,
      type: source.category === "紙巻き" ? "紙巻き" : "加熱式",
      packPrice,
      count,
      unitPrice: packPrice / count,
      effectiveFrom: null,
      status,
      sources: [source.url],
      verifiedAt,
      prices: [{ packPrice, count, effectiveFrom: null }],
    });
  }
  if (
    products.length < 3 ||
    new Set(products.map((p) => p.id)).size !== products.length
  )
    throw new Error(`${source.id}: empty or duplicate catalog`);
  return products;
}

export function mergeCatalog(master, incoming, checkedAt) {
  const next = structuredClone(master);
  let changed = false;
  for (const row of incoming) {
    const index = next.products.findIndex((p) => p.id === row.id);
    if (index < 0) {
      next.products.push(row);
      changed = true;
      continue;
    }
    const old = next.products[index];
    const priceChanged =
      old.packPrice !== row.packPrice || old.count !== row.count;
    if (priceChanged) {
      // A dated MOF decision is authoritative; stale manufacturer HTML must not undo it.
      if (!row.effectiveFrom)
        throw new Error(
          `Price/count changed without verified effective date: ${old.name}`,
        );
      if (old.effectiveFrom && row.effectiveFrom < old.effectiveFrom)
        throw new Error(`Stale price source: ${old.name}`);
      if (row.effectiveFrom > checkedAt) {
        if (
          !old.prices.some(
            (p) =>
              p.effectiveFrom === row.effectiveFrom &&
              p.packPrice === row.packPrice &&
              p.count === row.count,
          )
        ) {
          old.prices.push({
            packPrice: row.packPrice,
            count: row.count,
            effectiveFrom: row.effectiveFrom,
          });
          changed = true;
        }
        continue;
      }
    }
    const statusChanged = row.status !== old.status;
    if (!priceChanged && !statusChanged) continue; // No daily date-only commits.
    if (old.status === "discontinued" && row.status === "active")
      throw new Error(`Unverified return to sale: ${old.name}`);
    next.products[index] = {
      ...old,
      ...row,
      sources: [...new Set([...old.sources, ...row.sources])],
      prices: priceChanged
        ? [
            ...old.prices,
            {
              packPrice: row.packPrice,
              count: row.count,
              effectiveFrom: row.effectiveFrom,
            },
          ]
        : old.prices,
      effectiveFrom: priceChanged ? row.effectiveFrom : old.effectiveFrom,
    };
    changed = true;
  }
  if (changed) {
    next.version = master.version + 1;
    next.checkedAt = checkedAt;
  }
  return { master: next, changed };
}

export function parseMOFLinks(html) {
  const links = [...html.matchAll(/href=["']([^"']*\d{8}[^"']*\.pdf)["']/gi)]
    .map((m) => new URL(m[1], SOURCES.find((s) => s.id === "mof").url).href)
    .filter((url) => new URL(url).hostname === "www.mof.go.jp");
  if (!links.length) throw new Error("MOF approval links could not be parsed");
  return [...new Set(links)].sort();
}
async function fetchSource(source) {
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      "User-Agent":
        "YaniWars-Catalog/1.0 (official public product data verification)",
    },
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const html = await response.text();
  if (
    html.length < 500 ||
    /<title>\s*(?:Access Denied|Just a moment)/i.test(html)
  )
    throw new Error(`${source.id}: blocked or invalid response`);
  return html;
}

export async function update({
  fetcher = fetchSource,
  masterPath = MASTER,
  today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  ),
} = {}) {
  const initial = JSON.parse(await readFile(masterPath, "utf8"));
  // MOF is authoritative and provides importer-independent historical coverage.
  // Backfill constructs a candidate; only the final validated candidate is atomically published.
  const primary = await backfill({ today, write: false });
  let master = primary.master;
  const parsed = [];
  const failures = [];
  const report = { checkedAt: today, sources: [] };
  let transportFailure = false;
  // Secondary manufacturer pages can be stale or bot-protected. Their unresolved
  // changes are quarantined rather than replacing a verified MOF decision.
  for (const source of SOURCES) {
    if (source.id === "mof") continue;
    try {
      const html = await fetcher(source);
      if (source.adapter === "jt-table")
        parsed.push(...parseJT(html, source, today));
      if (source.adapter === "monitor" && !source.marker.test(html))
        throw new Error("Official page marker missing");
      report.sources.push({
        id: source.id,
        url: source.url,
        status: "checked",
        adapter: source.adapter,
      });
    } catch (error) {
      transportFailure = true;
      failures.push(String(error.message));
      report.sources.push({
        id: source.id,
        status: "error",
        error: error.message,
      });
    }
  }
  const nameKey = (name) =>
    name
      .normalize("NFKC")
      .replace(/[\s・･'’]/g, "")
      .toLowerCase();
  for (const incoming of parsed) {
    const existing = master.products.find(
      (p) => nameKey(p.name) === nameKey(incoming.name),
    );
    if (existing) {
      incoming.id = existing.id;
      if (
        existing.packPrice !== incoming.packPrice ||
        existing.count !== incoming.count
      ) {
        failures.push(
          `Unresolved manufacturer price/count: ${incoming.name}; retained verified master`,
        );
        continue;
      }
      if (existing.status === "approved") incoming.status = "active";
    }
    incoming.aliases = searchAliases(incoming.name);
    try {
      master = mergeCatalog(master, [incoming], today).master;
    } catch (error) {
      failures.push(error.message);
    }
  }
  const changed =
    JSON.stringify(initial.products) !== JSON.stringify(master.products);
  if (changed) {
    master.version = initial.version + 1;
    master.checkedAt = today;
  }
  const result = { master, changed };
  await mkdir(path.join(ROOT, "work"), { recursive: true });
  await writeFile(
    path.join(ROOT, "work/catalog-check.json"),
    JSON.stringify(
      { ...report, changed: result.changed, quarantine: failures },
      null,
      2,
    ),
  );
  if (transportFailure)
    throw new Error(
      "Official source unavailable or unparseable. Master retained. See work/catalog-check.json. " +
        failures.join("; "),
    );
  if (result.changed) {
    const temporary = `${masterPath}.tmp`;
    await writeFile(temporary, JSON.stringify(result.master, null, 2) + "\n");
    await rename(temporary, masterPath);
  }
  await writeFile(
    path.join(ROOT, "public/data/catalog-coverage.json"),
    JSON.stringify(primary.publicReport, null, 2) + "\n",
  );
  for (const failure of failures) console.warn(`::warning::${failure}`);
  if (primary.report.quarantinedRows)
    console.warn(
      `::warning::${primary.report.quarantinedRows} ambiguous MOF rows retained for review. See work/mof-report.json.`,
    );
  return result;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  update()
    .then((result) =>
      console.log(
        result.changed
          ? "Official catalog updated."
          : "No verified catalog changes.",
      ),
    )
    .catch((error) => {
      console.error(`::error::Catalog retained. ${error.message}`);
      process.exitCode = 1;
    });
}
