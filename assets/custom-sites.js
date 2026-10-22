(function () {
  'use strict';
  const key = 'seubme_custom_sites_v1';
  const hiddenKey = 'seubme_hidden_builtin_sites_v1';
  const model = window.BmeSiteModel;
  let sites = [];
  let builtinSites = [];
  let hiddenBuiltins = [];
  let manageMode = false;
  let mounted = false;
  const cards = () => Array.from(document.querySelectorAll('#links-container .link-card'));
  const cardSite = card => ({name: card.querySelector('.link-title').textContent, url: card.querySelector('a').href});
  const existingSites = () => builtinSites.concat(cards().map(cardSite));
  const error = message => { document.getElementById('customSiteError').textContent = message; };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function persist(next) {
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { throw new Error('当前浏览器无法保存网站，请允许网站存储后再试。'); }
    sites = next;
  }
  function persistHidden(next) {
    try { localStorage.setItem(hiddenKey, JSON.stringify(next)); }
    catch { throw new Error('当前浏览器无法保存删除操作，请允许网站存储后再试。'); }
    hiddenBuiltins = next;
  }
  function loadHidden() {
    try {
      const value = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
      return Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => window.BmeColleges && BmeColleges.profiles.some(p => p.url === item) ? 'college:official' : item) : [];
    } catch { return []; }
  }
  function updateCounts() {
    const navigation = cards().filter(card => !card.dataset.sharedProject);
    const total = navigation.filter(card => !window.BmePersonalization || BmePersonalization.isCategoryVisible(card.dataset.category)).length;
    const label = document.getElementById('siteTotalLabel');
    if (label) label.textContent = '共 ' + total + ' 个常用站点';
    const categoryIds = window.BmePersonalization ? BmePersonalization.getCategories().map(c => c.id) : ['academic', 'life', 'service', 'resource'];
    for (const category of ['all', ...categoryIds]) {
      const count = category === 'all' ? total : navigation.filter(card => card.dataset.category === category).length;
      const tabCount = document.querySelector('[data-tab="' + category + '"] .n');
      if (tabCount) tabCount.textContent = count;
      const section = document.getElementById('sec-' + category);
      if (section) {
        section.querySelector('.sec-count').textContent = count + ' 个网站';
        section.querySelectorAll('.sec-rows').forEach(rows => {
          rows.querySelectorAll('.row-no').forEach((node, index) => { node.textContent = String(index + 1).padStart(2, '0'); });
        });
      }
    }
    const projectCount = document.querySelectorAll('#projectLinksRows .link-card').length;
    document.querySelectorAll('#links-container .sec-rows').forEach(rows => rows.querySelectorAll('.row-no').forEach((node,index) => { node.textContent = String(index + 1).padStart(2,'0'); }));
    document.getElementById('projectLinksCount').textContent = projectCount + ' 个项目';
  }
  function buildCard(site) {
    const modern = !!document.getElementById('sec-academic');
    const card = element('div', 'link-card fade-in-up custom-site-card');
    card.dataset.category = site.category;
    card.dataset.customSiteId = site.id;
    card.dataset.navId = 'custom:' + site.id;
    card.draggable = true;
    const favorite = element('button', 'favorite-btn');
    favorite.type = 'button';
    favorite.setAttribute('aria-label', '收藏 ' + site.name);
    favorite.appendChild(element('i', 'fas fa-star'));
    favorite.addEventListener('click', event => { event.stopPropagation(); toggleFavorite(favorite); });
    const link = element('a');
    link.href = site.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => recordVisit(link));
    if (modern) {
      const head = element('span', 'tile-head');
      head.append(element('span', 'row-no'), element('span', 'row-domain', new URL(site.url).hostname));
      link.append(head, element('span', 'link-title', site.name), element('span', 'link-desc', site.description));
    } else {
      const icon = element('div', 'link-icon');
      icon.appendChild(element('i', 'fas fa-link'));
      const text = element('div', 'link-text');
      text.append(element('div', 'link-title', site.name), element('div', 'link-desc', site.description));
      link.append(icon, text);
    }
    const remove = element('button', 'custom-site-remove', '×');
    remove.type = 'button';
    remove.title = '删除这个自定义网站';
    remove.setAttribute('aria-label', '删除自定义网站 ' + site.name);
    remove.addEventListener('click', event => { event.stopPropagation(); removeSite(site, card); });
    card.append(favorite, link, remove);
    card.classList.add('draggable');
    const section = document.getElementById('sec-' + site.category);
    if (section) section.querySelector('.sec-rows').appendChild(card);
    else {
      const container = document.getElementById('links-container');
      const next = Array.from(container.querySelectorAll('.link-card')).find(item => {
        const ranks = {academic: 0, life: 1, service: 2, resource: 3};
        return ranks[item.dataset.category] > ranks[site.category];
      });
      container.insertBefore(card, next || document.getElementById('no-results'));
    }
    return card;
  }
  function removeSite(site, card) {
    try { persist(sites.filter(item => item.id !== site.id)); }
    catch (problem) { showToast(problem.message); return; }
    card.remove();
    favorites = favorites.filter(name => name !== site.name);
    recentVisits = recentVisits.filter(item => item.title !== site.name);
    customOrder = customOrder.filter(name => name !== site.name);
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
      localStorage.setItem('recentVisits', JSON.stringify(recentVisits));
      localStorage.setItem('customOrder', JSON.stringify(customOrder));
    } catch { /* The saved site deletion has already succeeded. */ }
    updateCounts();
    performSearch();
    showToast('已删除自定义网站');
  }
  function removePersonalState(name) {
    favorites = favorites.filter(item => item !== name);
    recentVisits = recentVisits.filter(item => item.title !== name);
    customOrder = customOrder.filter(item => item !== name);
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
      localStorage.setItem('recentVisits', JSON.stringify(recentVisits));
      localStorage.setItem('customOrder', JSON.stringify(customOrder));
    } catch { /* The site removal itself is already saved. */ }
  }
  function removeBuiltin(card) {
    const site = cardSite(card);
    try { persistHidden(Array.from(new Set(hiddenBuiltins.concat(card.dataset.navId === 'college-official' ? 'college:official' : site.url)))); }
    catch (problem) { showToast(problem.message); return; }
    removePersonalState(site.name);
    card.remove();
    updateCounts();
    performSearch();
    updateManageControls();
    showToast('已从导航中删除“' + site.name + '”');
  }
  function updateManageControls() {
    const manage = document.getElementById('manageSitesButton');
    const restore = document.getElementById('restoreSitesButton');
    if (manage) {
      manage.textContent = manageMode ? '✓ 完成管理' : '管理导航';
      manage.setAttribute('aria-pressed', String(manageMode));
    }
    if (restore) {
      restore.hidden = !manageMode;
      restore.disabled = hiddenBuiltins.length === 0;
      restore.textContent = hiddenBuiltins.length ? '恢复已删除（' + hiddenBuiltins.length + '）' : '恢复已删除';
    }
  }
  function toggleManageMode() {
    manageMode = !manageMode;
    document.body.classList.toggle('site-manage-mode', manageMode);
    updateManageControls();
    showToast(manageMode ? '管理模式已开启，点击卡片右下角删除' : '已退出管理模式');
  }
  function restoreBuiltins() {
    if (!hiddenBuiltins.length) { showToast('没有已删除的默认网站'); return; }
    try { persistHidden([]); }
    catch (problem) { showToast(problem.message); return; }
    window.location.reload();
  }
  function setupManagement() {
    hiddenBuiltins = loadHidden();
    const originals = cards();
    builtinSites = originals.map(cardSite);
    originals.forEach(card => {
      if (card.dataset.sharedProject) return;
      const site = cardSite(card);
      if (hiddenBuiltins.includes(site.url) || (card.dataset.navId === 'college-official' && hiddenBuiltins.includes('college:official'))) { card.remove(); return; }
      const remove = element('button', 'site-manage-remove', '×');
      remove.type = 'button';
      remove.title = '删除“' + site.name + '”';
      remove.setAttribute('aria-label', '删除网站 ' + site.name);
      remove.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removeBuiltin(card);
      });
      card.appendChild(remove);
    });
    const actions = document.querySelector('.custom-site-actions');
    const add = document.getElementById('addSiteButton');
    if (actions && add) {
      const buttons = element('div', 'custom-site-buttons');
      const management = element('div', 'site-management-controls');
      management.id = 'siteManagementControls';
      const manage = element('button', 'custom-site-manage', '管理导航');
      manage.id = 'manageSitesButton';
      manage.type = 'button';
      manage.addEventListener('click', toggleManageMode);
      const restore = element('button', 'custom-site-restore', '恢复已删除');
      restore.id = 'restoreSitesButton';
      restore.type = 'button';
      restore.addEventListener('click', restoreBuiltins);
      management.append(manage, restore);
      buttons.append(add);
      actions.appendChild(buttons);
      document.body.appendChild(management);
    }
    updateManageControls();
  }
  function migrateOrder() {
    try {
      if (localStorage.getItem('seubme_order_revision') === 'graduate-service-first-v2') return;
      if (customOrder.length) {
        const pinned = ['东南大学', '研究生院', '研究生综合服务平台'];
        const order = pinned.concat(customOrder.filter(name => !pinned.includes(name)));
        customOrder = order;
        localStorage.setItem('customOrder', JSON.stringify(order));
      }
      localStorage.setItem('seubme_order_revision', 'graduate-service-first-v2');
    } catch { /* Keep the updated order in memory when storage is unavailable. */ }
  }
  function openForm() {
    document.getElementById('customSiteForm').reset();
    error('');
    const available = Array.from(document.getElementById('customSiteCategory').options).map(o => o.value);
    document.getElementById('customSiteCategory').value = available.includes(currentCategory) ? currentCategory : available[0];
    document.getElementById('customSiteDialog').showModal();
    document.getElementById('customSiteName').focus();
  }
  function submitForm(event) {
    event.preventDefault();
    error('');
    try {
      const site = model.validate({
        id: window.crypto.randomUUID ? window.crypto.randomUUID() : 'site-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        name: document.getElementById('customSiteName').value,
        url: document.getElementById('customSiteUrl').value,
        description: document.getElementById('customSiteDescription').value,
        category: document.getElementById('customSiteCategory').value
      }, existingSites());
      persist(sites.concat(site));
      window.BmeAnalytics?.siteAdded();
      buildCard(site);
      if (window.BmePersonalization) BmePersonalization.refresh();
      initializeFavorites();
      setupDragAndDrop();
      setupCardClick();
      updateCounts();
      document.getElementById('customSiteDialog').close();
      document.getElementById('searchInput').value = '';
      if (typeof switchCat === 'function') switchCat(site.category);
      else filterCategory(site.category);
      showToast('网站已加入导航');
    } catch (problem) { error(problem.message); }
  }
  function highlightTextSafely(card, keyword) {
    if (!keyword) return;
    for (const node of [card.querySelector('.link-title'), card.querySelector('.link-desc')]) {
      const text = node.textContent;
      const lower = text.toLowerCase();
      const search = keyword.toLowerCase();
      node.replaceChildren();
      let from = 0;
      let index;
      while ((index = lower.indexOf(search, from)) !== -1) {
        node.appendChild(document.createTextNode(text.slice(from, index)));
        node.appendChild(element('span', 'highlight', text.slice(index, index + search.length)));
        from = index + search.length;
      }
      node.appendChild(document.createTextNode(text.slice(from)));
    }
  }
  function init() {
    if (mounted) return;
    mounted = true;
    window.highlightText = highlightTextSafely;
    migrateOrder();
    setupManagement();
    const collegeUrl = document.querySelector('[data-nav-id="college-official"] a')?.href;
    try { sites = model.load(localStorage.getItem(key), existingSites().filter(site => !collegeUrl || site.url !== collegeUrl)); }
    catch { showToast('自定义网站暂时无法读取，仍可使用默认导航。'); }
    sites.forEach(buildCard);
    updateCounts();
    document.getElementById('addSiteButton').addEventListener('click', () => openForm());
    document.getElementById('customSiteForm').addEventListener('submit', submitForm);
    document.getElementById('cancelAddSite').addEventListener('click', () => document.getElementById('customSiteDialog').close());
  }
  window.BmeCustomSites = {init, updateCounts, refreshCollegeCatalog: () => { builtinSites = builtinSites.filter(s => !window.BmeColleges || !BmeColleges.profiles.some(p => p.url === s.url)); }};
})();
