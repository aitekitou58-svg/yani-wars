// Intentionally no imports from app, core, statistics, or storage.
// The vendor runs on a separate origin, never in the app's IndexedDB origin.
export function adSettings(config, slot, location, production) {
  const a = config?.adsense;
  if (!production || !a?.enabled || !a.consentConfigured || location.protocol !== 'https:' ||
      !/^ca-pub-\d{16}$/.test(a.clientId || '') || !/^\d{10}$/.test(a[slot] || '')) return null;
  try {
    const host = new URL(a.hostUrl);
    if (host.protocol !== 'https:' || host.origin === location.origin || host.username || host.password || host.search || host.hash) return null;
    return { origin: host.origin, url: new URL(`./${slot}.html`, host.href.endsWith('/') ? host : `${host.href}/`).href };
  } catch { return null; }
}
export function mountAd(container, config, slot, production) {
  if (!container || container.dataset.mounted) return;
  const a = adSettings(config, slot, window.location, production);
  if (!a || !navigator.onLine) return;
  container.dataset.mounted = 'true';
  const frame = document.createElement('iframe');
  frame.title = '広告'; frame.src = a.url; frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.className = 'advert-frame';
  // Keep the actual frame measurable for responsive AdSense, but collapse its parent until filled.
  container.className = 'advert pending';
  container.append(frame);
  let timer;
  const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onMessage); };
  const fail = () => { cleanup(); container.replaceChildren(); container.className = ''; };
  const onMessage = e => {
    if (e.origin !== a.origin || e.source !== frame.contentWindow) return;
    if (e.data === 'yani-ad-filled' && container.isConnected) { cleanup(); container.className = 'advert'; }
    if (e.data === 'yani-ad-empty') fail();
  };
  window.addEventListener('message', onMessage);
  frame.onerror = fail;
  timer = setTimeout(fail, 15000);
}
