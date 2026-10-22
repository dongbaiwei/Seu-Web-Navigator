(function () {
  'use strict';
  const config = window.BmeAnalyticsConfig || {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let site, scriptUrl, ready = false, queue = [];
  try { site = new URL(config.siteUrl); scriptUrl = new URL(config.scriptUrl); } catch {}
  const production = Boolean(config.enabled === true && site && scriptUrl &&
    site.protocol === 'https:' && scriptUrl.protocol === 'https:' && !scriptUrl.username && !scriptUrl.password &&
    uuid.test(config.websiteId || '') && location.origin === site.origin && location.pathname === site.pathname &&
    !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
  function excluded() {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return true;
    try { return Boolean(localStorage.getItem('umami.disabled')); } catch { return true; }
  }
  const permitted = () => production && !excluded();
  // Capture only shipped public labels before personal settings or custom sites are applied.
  const builtinNames = new WeakMap();
  document.querySelectorAll('#links-container .link-card').forEach(card => {
    builtinNames.set(card, card.querySelector('.link-title')?.textContent.trim().slice(0, 64) || '默认网站');
  });
  function payload() {
    let referrer = '';
    try { const url = new URL(document.referrer); if (/^https?:$/.test(url.protocol)) referrer = url.origin; } catch {}
    // Never forward the browser URL query, hash, personal title, or a full referrer URL.
    const result = {website: config.websiteId, hostname: site.hostname, url: site.pathname,
      title: config.title || '校园导航', language: navigator.language, screen: screen.width + 'x' + screen.height, referrer};
    const source = new URLSearchParams(location.search).get('utm_source');
    if (['xiaohongshu', 'douyin'].includes(source)) result.url += '?utm_source=' + source;
    return result;
  }
  function deliver(event) {
    if (!permitted()) return;
    try { Promise.resolve(window.umami.track(event)).catch(() => {}); } catch { /* Analytics must not interrupt navigation. */ }
  }
  function send(name, data) {
    if (!permitted()) return;
    const event = {...payload(), name, data};
    if (ready) deliver(event);
    else if (queue.length < 30) queue.push(event);
  }
  window.BmeAnalytics = Object.freeze({
    recordCard(action, card, placement) {
      if (!['navigation_click', 'favorite_add', 'favorite_remove'].includes(action) || !card) return;
      const kind = card.dataset.customSiteId ? 'custom' : card.dataset.sharedProject ? 'project' : 'builtin';
      const data = {kind, placement: placement === 'favorites' ? 'favorites' : 'category'};
      if (kind !== 'custom') data.site = card.dataset.navId === 'college-official' ? '学院官网' : builtinNames.get(card) || '默认网站';
      send(action, data);
    },
    collegeChanged(id) {
      if (window.BmeColleges?.profiles.some(profile => profile.id === id)) send('college_switch', {college_id: id});
    },
    siteAdded() { send('custom_site_add', {kind: 'custom'}); }
  });
  const summary = document.getElementById('siteAnalytics');
  function loadPublicCounter() {
    if (!permitted() || !summary || config.publicCounter !== 'busuanzi') return;
    const callback = 'BmeVisitCounter_' + crypto.randomUUID().replace(/-/g, '');
    const counter = document.createElement('script');
    let finished = false;
    const timeout = setTimeout(() => finish(), 8000);
    function finish() {
      if (finished) return;
      finished = true; clearTimeout(timeout);
      // A late JSONP response must remain harmless after timeout or opt-out.
      window[callback] = () => {};
      counter.remove();
    }
    window[callback] = data => {
      if (finished) return;
      const count = value => typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
      const pageviews = count(data?.site_pv), visitors = count(data?.site_uv);
      if (permitted() && Number.isSafeInteger(pageviews) && pageviews >= 0 && Number.isSafeInteger(visitors) && visitors >= 0) {
        document.getElementById('analyticsPageviewsLabel').textContent = '本站总访问量';
        document.getElementById('analyticsPageviews').textContent = pageviews.toLocaleString('zh-CN');
        document.getElementById('analyticsVisitorsLabel').textContent = '访客数';
        document.getElementById('analyticsVisitors').textContent = visitors.toLocaleString('zh-CN');
        document.getElementById('analyticsSinceItem').hidden = true;
        summary.title = '不蒜子按 ' + site.hostname + ' 整个域名累计统计，包含此域名下接入同一服务的其他页面；访客按服务规则估算去重，与 Umami 本项目的统计口径不同。';
        summary.hidden = false;
      }
      finish();
    };
    counter.async = true;
    counter.src = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback=' + callback;
    // Domain-level totals only need the origin: don't disclose personal query strings or page paths.
    counter.referrerPolicy = 'origin';
    counter.addEventListener('error', finish);
    counter.addEventListener('load', finish);
    document.head.append(counter);
  }
  async function loadSummary() {
    if (!permitted() || !summary || config.publicCounter !== 'umami' || !config.summaryUrl) return;
    try {
      const url = new URL(config.summaryUrl, document.baseURI);
      if (url.origin !== location.origin) return;
      const response = await fetch(url, {credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(5000)});
      if (!response.ok) return;
      const data = await response.json();
      const updated = Date.parse(data.updatedAt), since = Date.parse(data.since);
      const validCount = value => Number.isSafeInteger(value) && value >= 0;
      if (!permitted() || data.ready !== true || data.websiteId !== config.websiteId || data.siteUrl !== config.siteUrl ||
        data.since !== config.startedAt || !Number.isFinite(since) || !Number.isFinite(updated) ||
        updated > Date.now() + 300000 || Date.now() - updated > 48 * 3600000 || since > updated ||
        data.windowDays !== 30 || !validCount(data.pageviews) || !validCount(data.visitors30d)) return;
      const number = value => value.toLocaleString('zh-CN');
      document.getElementById('analyticsPageviews').textContent = number(data.pageviews);
      document.getElementById('analyticsVisitors').textContent = number(data.visitors30d);
      const date = document.getElementById('analyticsSince'); date.textContent = data.since; date.dateTime = data.since;
      summary.title = '数据定期更新，最近更新：' + new Date(updated).toLocaleString('zh-CN') + '。访客按 Umami 规则估算去重。';
      summary.hidden = false;
    } catch { /* Hide absent, stale or unavailable figures rather than showing invented zeros. */ }
  }
  if (!production) return;
  const privacy = document.getElementById('analyticsPrivacy');
  const dialog = document.getElementById('analyticsPrivacyDialog');
  const optOut = document.getElementById('analyticsOptOut');
  privacy.hidden = false;
  privacy.addEventListener('click', () => {
    optOut.checked = excluded();
    document.getElementById('analyticsPrivacyStatus').textContent = excluded() ? '当前浏览器已暂停统计。' : '当前浏览器正在参与匿名访问统计。';
    dialog.showModal();
  });
  dialog.querySelector('[data-analytics-close]').addEventListener('click', () => dialog.close());
  optOut.addEventListener('change', () => {
    try {
      if (optOut.checked) localStorage.setItem('umami.disabled', '1');
      else localStorage.removeItem('umami.disabled');
      queue = [];
      // Reload reinitializes the tracker without retaining pending events.
      location.reload();
    } catch { document.getElementById('analyticsPrivacyStatus').textContent = '浏览器未能保存，请在浏览器中启用“请勿跟踪”以退出统计。'; }
  });
  if (!permitted()) return;
  const script = document.createElement('script');
  script.async = true; script.src = scriptUrl.href;
  script.dataset.websiteId = config.websiteId;
  script.dataset.domains = site.hostname;
  // Manual collection supplies sanitized payloads and exactly one pageview per page load.
  script.dataset.autoTrack = 'false';
  script.addEventListener('load', () => {
    if (!permitted() || typeof window.umami?.track !== 'function') { queue = []; return; }
    ready = true; deliver(payload());
    const pending = queue; queue = []; pending.forEach(deliver);
  });
  script.addEventListener('error', () => { queue = []; });
  document.head.append(script);
  loadPublicCounter();
  loadSummary();
})();
