import { buildInformation, articles } from "./information.mjs";
import { buildAds } from "./build-ads.mjs";
import { mkdir, cp, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
await mkdir("public/icons", { recursive: true });
function crc(b) {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const b = Buffer.from(type),
    size = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([b, data])));
  return Buffer.concat([size, b, data, sum]);
}
function icon(n) {
  const raw = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = x / n,
        b = y / n;
      let rgb = [33, 61, 46];
      if (
        (a > 0.28 && a < 0.36 && b > 0.34 && b < 0.69) ||
        (a > 0.28 && a < 0.66 && b > 0.61 && b < 0.69)
      )
        rgb = [244, 243, 233];
      if (((a - 0.58) / 0.16) ** 2 + ((b - 0.43) / 0.15) ** 2 < 1 && b < 0.61)
        rgb = [168, 201, 151];
      const i = y * (n * 4 + 1) + 1 + x * 4;
      raw.set([...rgb, 255], i);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const n of [180, 192, 512])
  await writeFile(
    `public/icons/${n === 180 ? "apple-touch-icon" : `icon-${n}`}.png`,
    icon(n),
  );
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp("src", "dist/src", { recursive: true });
await cp("index.html", "dist/index.html");
const config = JSON.parse(await readFile('public/config.json', 'utf8'));
await writeFile('dist/src/build-mode.js', `export const production = ${process.env.YANI_ENV !== 'development'};`);
await buildInformation(config);
await buildAds(config);
const assets = [
  "./",
  ...Object.keys(articles).map(slug => `./${slug}/index.html`),
  "./index.html",
  "./src/app.js",
  "./src/style.css",
  "./src/core.js",
  "./src/storage.js",
  "./src/sharing.js",
  "./src/landscape.js",
  "./src/world.js",
  "./src/patterns.js",
  "./src/transfer.js",
  "./src/ads.js",
  "./src/build-mode.js",
  "./src/info-ads.js",
  "./ads.txt",
  "./config.json",
  "./data/products.json",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];
const hash = createHash("sha256");
for (const f of assets.slice(1))
  hash.update(await readFile(`dist/${f.slice(2)}`));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE='yani-static-${version}';const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('yani-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const url=new URL(e.request.url);const scope=new URL(self.registration.scope);const relative=url.pathname.slice(scope.pathname.length);if(e.request.mode==='navigate'){const page=relative===''?'index.html':relative.endsWith('/')?relative+'index.html':relative;const key=ASSETS.includes('./'+page)?new URL(page,scope).href:null;e.respondWith(key?caches.match(key).then(r=>r||fetch(e.request)):fetch(e.request));return;}if(!ASSETS.some(a=>a.slice(2)===relative))return;e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);return hit||fetch(e.request);}));});`,
);
console.log(`Built static PWA: dist/ (${version})`);
