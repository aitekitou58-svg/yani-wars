// Independent advertising module: no statistics or storage imports.
let scriptPromise;
export function adSettings(config, slot, location, production) {
  const a = config?.adsense;
  if (!production || !a?.enabled || !a.consentConfigured || location.protocol !== 'https:' ||
      !/^ca-pub-\d{16}$/.test(a.clientId || '') || !/^\d{10}$/.test(a[slot] || '')) return null;
  if (/^(localhost|127\.|\[?::1)/.test(location.hostname || '')) return null;
  return { client: a.clientId, slot: a[slot] };
}
function loadScript(client) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-google-ads]');
    if (script?.dataset.loaded === 'true') return resolve();
    const created = !script;
    if (!script) {
      script = document.createElement('script'); script.dataset.googleAds = 'true';
      script.async = true; script.crossOrigin = 'anonymous';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    }
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, {once:true});
    script.addEventListener('error', reject, {once:true});
    if (created) document.head.append(script);
  });
  return scriptPromise;
}
export function mountAd(container, config, slot, production) {
  if (!container || container.dataset.mounted) return;
  const a = adSettings(config, slot, window.location, production);
  if (!a || !navigator.onLine) return;
  container.dataset.mounted = 'true';
  container.className = 'advert';
  const label = document.createElement('p'); label.textContent = '広告';
  const unit = document.createElement('ins'); unit.className = 'adsbygoogle';
  unit.style.display = 'block'; unit.style.minHeight = '100px';
  unit.dataset.adClient = a.client; unit.dataset.adSlot = a.slot;
  unit.dataset.adFormat = slot === 'slotHome' ? 'horizontal' : 'auto'; unit.dataset.fullWidthResponsive = 'true';
  container.append(label, unit);
  let timer;
  const observer = new MutationObserver(() => {
    const status = unit.getAttribute('data-ad-status');
    if (status === 'filled') { clearTimeout(timer); observer.disconnect(); container.className = 'advert'; }
    if (status === 'unfilled') fail();
  });
  const fail = () => { clearTimeout(timer); observer.disconnect(); container.replaceChildren(); container.className = ''; };
  observer.observe(unit, {attributes:true});
  timer = setTimeout(fail, 15000);
  loadScript(a.client).then(() => {
    if (!unit.isConnected) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { fail(); }
  }).catch(fail);
}

// Keep the vendor DOM outside the frequently rerendered app. No timer refreshes.
export function positionHomeAd(config, production) {
  let banner = document.querySelector('#home-banner');
  const anchor = document.querySelector('#home-ad-anchor');
  if (!anchor || !adSettings(config, 'slotHome', window.location, production)) {
    if (banner) banner.hidden = true;
    return;
  }
  if (!banner) {
    banner = document.createElement('aside'); banner.id = 'home-banner';
    banner.setAttribute('aria-label', '広告'); document.body.append(banner);
    banner.style.position = 'absolute';
    const position = () => {
      const target = document.querySelector('#home-ad-anchor');
      if (!target || !banner.childElementCount) { banner.hidden = true; if(target) { target.style.height='0px'; target.style.marginTop='0px'; } return; }
      banner.hidden = false;
      const rect = target.getBoundingClientRect();
      banner.style.left = `${rect.left + window.scrollX}px`;
      banner.style.top = `${rect.top + window.scrollY}px`;
      banner.style.width = `${rect.width}px`;
      target.style.height = `${banner.offsetHeight}px`;
      target.style.marginTop = '32px';
    };
    new ResizeObserver(position).observe(banner);
    window.addEventListener('resize', position);
    banner.reposition = position;
  }
  banner.hidden = false;
  mountAd(banner, config, 'slotHome', production);
  requestAnimationFrame(banner.reposition);
}
