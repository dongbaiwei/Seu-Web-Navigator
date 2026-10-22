(function () {
  'use strict';
  function render() {
    const main = document.getElementById('links-container');
    if (!main) return;
    let section = document.getElementById('sec-favorites');
    if (!section) {
      section = document.createElement('section');
      section.id = 'sec-favorites';
      section.className = 'pinned-favorites';
      section.setAttribute('aria-labelledby', 'favorites-heading');
      section.innerHTML = '<header class="sec-head"><span class="sec-no" aria-hidden="true">★</span><h2 class="sec-title" id="favorites-heading">收藏</h2><span class="sec-count"></span></header><div class="sec-rows"></div>';
    }
    main.prepend(section);
    if (window.BmeNavigationDesign) BmeNavigationDesign.decorateSection(section, 'favorite');
    const rows = section.querySelector('.sec-rows');
    rows.replaceChildren();
    rows.classList.toggle('list-mode', document.querySelector('#sec-academic .sec-rows')?.classList.contains('list-mode') || false);
    // Use separate shortcuts so totals, categories and navigation management retain one source card per site.
    const allFavorites = Array.from(main.querySelectorAll('.link-card')).filter(card => {
      const title = card.querySelector('.link-title').textContent;
      const visible = card.dataset.sharedProject ? BmePersonalization.isProjectsVisible() : BmePersonalization.isCategoryVisible(card.dataset.category);
      return favorites.includes(title) && visible;
    });
    const sources = allFavorites.filter(card => card.style.display !== 'none');
    for (const [index, source] of sources.entries()) {
      const title = source.querySelector('.link-title').textContent;
      const shortcut = document.createElement('div');
      shortcut.className = 'favorite-site';
      if (source.dataset.sharedProject) shortcut.dataset.sharedProject = 'true';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-btn active';
      button.setAttribute('aria-label', '取消收藏 ' + title);
      button.innerHTML = '<i class="fas fa-star" aria-hidden="true"></i>';
      button.addEventListener('click', () => toggleFavorite(source.querySelector('.favorite-btn')));
      const original = source.querySelector('a');
      const link = document.createElement('a');
      for (const attr of ['href', 'target', 'rel']) if (original.hasAttribute(attr)) link.setAttribute(attr, original.getAttribute(attr));
      for (const child of original.childNodes) link.append(child.cloneNode(true));
      const number = link.querySelector('.row-no');
      if (number) number.textContent = String(index + 1).padStart(2, '0');
      link.addEventListener('click', () => { recordVisit(original, 'favorites'); render(); });
      shortcut.append(button, link);
      if (window.BmeNavigationDesign) BmeNavigationDesign.decorateCard(shortcut);
      rows.append(shortcut);
    }
    section.hidden = sources.length === 0;
    section.querySelector('.sec-count').textContent = sources.length + ' 个网站';
  }
  window.BmePinnedFavorites = {render};
})();
