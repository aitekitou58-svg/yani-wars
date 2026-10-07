import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { buildInformation } from './information.mjs';
export async function buildAds(config) {
  await mkdir('ads-dist/src', {recursive:true});
  // Standalone readable site: no iframe, PWA bundle, records, IndexedDB or OPFS code.
  await buildInformation(config, {root:'ads-dist', ads:true});
  for (const file of ['ads.js','info-ads.js','style.css','build-mode.js']) await cp(`dist/src/${file}`, `ads-dist/src/${file}`);
  await cp('public/icons','ads-dist/icons',{recursive:true});
  await writeFile('ads-dist/config.json', JSON.stringify({adsense:config.adsense},null,2));
  await writeFile('ads-dist/index.html', await readFile('ads-dist/about/index.html','utf8'));
  const client = config.adsense?.clientId || '';
  await writeFile('ads-dist/ads.txt', /^ca-pub-\d{16}$/.test(client) ? `google.com, ${client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` : '# AdSense is disabled.\n');
}
