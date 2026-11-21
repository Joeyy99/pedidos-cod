(function () {
  const KEYS = ['o','utm_source','utm_medium','utm_campaign','utm_content','utm_term','ttclid','fbclid'];
  const p = new URLSearchParams(location.search);
  let t = {};
  try { t = JSON.parse(sessionStorage.getItem('trk') || '{}'); } catch (e) {}
  KEYS.forEach(k => { const v = p.get(k); if (v) t[k] = v.slice(0, 200); });
  if (!t.landing_url) t.landing_url = location.href.slice(0, 500);
  if (!t.referrer) t.referrer = document.referrer.slice(0, 200);
  try { sessionStorage.setItem('trk', JSON.stringify(t)); } catch (e) {}
  window.TRACKING = t;
})();