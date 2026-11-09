const APP_URL = 'https://om-systems.lovable.app';

function navigationAction(url) {
  try {
    const target = new URL(url);
    if (target.origin === new URL(APP_URL).origin) return 'app';
    if (['https:', 'mailto:', 'tel:'].includes(target.protocol)) return 'external';
  } catch {}
  return 'deny';
}

module.exports = { APP_URL, navigationAction };