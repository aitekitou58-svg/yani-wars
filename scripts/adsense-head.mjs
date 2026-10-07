// Ownership verification only. Never reads records or enables an ad unit.
export function adsenseHead(config, production) {
  const a = config?.adsense;
  if (!production || !a?.siteVerification || !/^ca-pub-\d{16}$/.test(a.clientId || '')) return '';
  const src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + a.clientId;
  return `<meta name="google-adsense-account" content="${a.clientId}">
<script data-adsense-verification>
if (location.protocol === 'https:' && location.hostname === 'yaniwars.pages.dev' && navigator.onLine) {
  const script = document.createElement('script');
  script.async = true;
  script.src = '${src}';
  script.crossOrigin = 'anonymous';
  script.dataset.googleAds = 'true';
  script.addEventListener('load', () => { script.dataset.loaded = 'true'; }, { once: true });
  document.head.append(script);
}
</script>`;
}
