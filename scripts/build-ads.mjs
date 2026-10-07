import { mkdir, writeFile } from 'node:fs/promises';
export async function buildAds(config) {
  const a = config.adsense || {};
  await mkdir('ads-dist', {recursive:true});
  // This separate deployment contains no app bundle, records, storage code, or analytics.
  for (const slot of ['slotRecord','slotInfo']) {
    const enabled = process.env.YANI_ENV !== 'development' && a.enabled && a.consentConfigured && /^ca-pub-\d{16}$/.test(a.clientId || '') && /^\d{10}$/.test(a[slot] || '');
    await writeFile(`ads-dist/${slot}.html`, `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>広告 | ヤニウォーズ</title><style>body{margin:0;font:11px sans-serif;color:#52624f}ins{display:block;width:100%;height:270px}p{margin:4px 0}</style></head><body>${enabled ? `<p>広告</p><ins class="adsbygoogle" data-ad-client="${a.clientId}" data-ad-slot="${a[slot]}" data-ad-format="auto" data-full-width-responsive="true"></ins><script src="./frame.js"></script>` : ''}</body></html>`);
  }
  await writeFile('ads-dist/frame.js', `// No user state, query parameters, referrer, or app messages are consumed.
(() => {
const ad = document.querySelector('.adsbygoogle');
if(ad && !document.querySelector('script[data-google-ads]')) {
  let done = false;
  const report = value => { if (!done) { done = true; parent.postMessage(value, '*'); } };
  const script = document.createElement('script'); script.dataset.googleAds = 'true'; script.async = true; script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ad.dataset.adClient);
  script.onerror = () => report('yani-ad-empty');
  script.onload = () => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { report('yani-ad-empty'); } };
  new MutationObserver(() => { const status = ad.getAttribute('data-ad-status'); if (status === 'filled') report('yani-ad-filled'); if (status === 'unfilled') report('yani-ad-empty'); }).observe(ad, {attributes:true});
  document.head.append(script);
  setTimeout(() => report('yani-ad-empty'), 14000);
}
})();`);
  await writeFile('ads-dist/index.html', '<!doctype html><html lang="ja"><meta charset="utf-8"><title>ヤニウォーズ 広告配信</title><p>ヤニウォーズの広告専用配信先です。利用記録は保存・収集しません。</p></html>');
  await writeFile('ads-dist/ads.txt', /^ca-pub-\d{16}$/.test(a.clientId || '') ? `google.com, ${a.clientId.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` : '# AdSense is disabled.\n');
}
