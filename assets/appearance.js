(function () {
  'use strict';
  const key = 'seubme_appearance_v1';
  const themes = ['white', 'black', 'blue'];
  const presetWallpapers = {
    'dawn': 'assets/wallpapers/dawn.svg',
    'lakeside': 'assets/wallpapers/lakeside.svg',
    'night-sky': 'assets/wallpapers/night-sky.svg',
    'sleeping-dragon': 'assets/wallpapers/sleeping-dragon.jpg',
    'thinking-dragon': 'assets/wallpapers/thinking-dragon.jpg',
    'nine-dragon': 'assets/wallpapers/nine-dragon.jpg',
    'orange-island': 'assets/wallpapers/orange-island.jpg'
  };
  const wallpapers = ['molecular', 'emblem', 'plain', 'upload', ...Object.keys(presetWallpapers)];
  const root = document.documentElement;
  const validImage = value => typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  let state = {theme: 'white', wallpaper: 'molecular', image: '', activeImageId: ''};
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    state.theme = themes.includes(saved.theme) ? saved.theme : 'white';
    state.image = validImage(saved.image) ? saved.image : '';
    state.activeImageId = typeof saved.activeImageId === 'string' ? saved.activeImageId : '';
    state.wallpaper = wallpapers.includes(saved.wallpaper) && (saved.wallpaper !== 'upload' || state.image || state.activeImageId) ? saved.wallpaper : 'molecular';
  } catch { /* Keep defaults when preferences cannot be read. */ }
  function apply() {
    root.dataset.theme = state.theme;
    root.dataset.wallpaper = state.wallpaper;
    const preset = presetWallpapers[state.wallpaper];
    root.toggleAttribute('data-preset-wallpaper', Boolean(preset));
    if (preset) root.style.setProperty('--preset-wallpaper', 'url("' + new URL(preset, document.baseURI).href + '")');
    else root.style.removeProperty('--preset-wallpaper');
    if (state.image) root.style.setProperty('--user-wallpaper', 'url("' + state.image + '")');
    else root.style.removeProperty('--user-wallpaper');
  }
  apply();
  function init() {
    const dialog = document.getElementById('appearanceDialog');
    if (!dialog) return;
    const status = document.getElementById('appearanceStatus');
    const input = document.getElementById('wallpaperFile');
    const controls = document.getElementById('appearanceControls') || dialog;
    const gallery = document.getElementById('wallpaperGallery');
    const empty = document.getElementById('wallpaperLibraryEmpty');
    let db, images = [], ready = false, busy = false, activeUrl = '', activeUrlId = '';

    function render() {
      apply();
      controls.querySelectorAll('[data-theme-choice]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme));
        button.disabled = busy;
      });
      controls.querySelectorAll('[data-wallpaper-choice]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.wallpaperChoice === state.wallpaper));
        button.disabled = busy;
      });
      input.disabled = !ready || busy;
      input.parentElement.classList.toggle('is-disabled', input.disabled);
      document.getElementById('wallpaperCount').textContent = images.length + ' 张';
      empty.hidden = images.length > 0;
      if (ready) empty.textContent = '还没有壁纸，添加喜欢的图片，保存后随时切换。';
      const focus = gallery.contains(document.activeElement) ? document.activeElement : null;
      const focusId = focus?.dataset.wallpaperId || focus?.dataset.removeWallpaper;
      const focusRemove = !!focus?.dataset.removeWallpaper;
      gallery.replaceChildren();
      for (const item of images) {
        const tile = document.createElement('div');
        tile.className = 'saved-wallpaper';
        const selected = state.wallpaper === 'upload' && item.id === state.activeImageId;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wallpaper-select';
        button.dataset.wallpaperId = item.id;
        button.setAttribute('aria-pressed', String(selected));
        button.title = '使用壁纸：' + item.name;
        button.disabled = busy;
        const preview = document.createElement('img');
        preview.src = item.thumbnail;
        preview.alt = '';
        preview.loading = 'lazy';
        const name = document.createElement('span');
        name.className = 'wallpaper-name';
        name.textContent = item.name;
        const badge = document.createElement('span');
        badge.className = 'wallpaper-current';
        badge.textContent = '使用中';
        badge.hidden = !selected;
        button.append(preview, name, badge);
        button.addEventListener('click', () => select(item));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'wallpaper-remove';
        remove.dataset.removeWallpaper = item.id;
        remove.setAttribute('aria-label', '删除壁纸：' + item.name);
        remove.title = '删除这张壁纸';
        remove.textContent = '×';
        remove.disabled = busy;
        remove.addEventListener('click', () => removeImage(item));
        tile.append(button, remove);
        gallery.append(tile);
      }
      if (focusId) Array.from(gallery.querySelectorAll('button')).find(button => (focusRemove ? button.dataset.removeWallpaper : button.dataset.wallpaperId) === focusId)?.focus({preventScroll: true});
    }
    function persist(next) {
      // Image files live in IndexedDB, outside the small settings quota.
      const saved = {theme: next.theme, wallpaper: next.wallpaper, activeImageId: next.activeImageId};
      // Keep the previous single upload until its migration succeeds.
      if (!next.activeImageId && validImage(next.image)) saved.image = next.image;
      try { localStorage.setItem(key, JSON.stringify(saved)); return true; }
      catch { status.textContent = '当前浏览器无法保存设置，请释放网站存储空间后重试。'; return false; }
    }
    function save(next) {
      if (!persist(next)) return false;
      state = next;
      render();
      status.textContent = '已保存，下次打开仍会保留。';
      return true;
    }
    function imageUrl(item) {
      if (!item) return '';
      if (activeUrlId !== item.id) {
        if (activeUrl) URL.revokeObjectURL(activeUrl);
        activeUrl = URL.createObjectURL(item.blob);
        activeUrlId = item.id;
      }
      return activeUrl;
    }
    function select(item) {
      // Persist the choice before replacing the current object URL.
      const next = {...state, activeImageId: item.id, wallpaper: 'upload'};
      if (!persist(next)) return false;
      next.image = imageUrl(item);
      state = next;
      render();
      status.textContent = '已保存，下次打开仍会保留。';
      return true;
    }
    function transaction(mode, action) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('images', mode);
        let request;
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('壁纸存储失败'));
        try { request = action(tx.objectStore('images')); }
        catch (error) { tx.abort(); reject(error); }
      });
    }
    function storageError() {
      status.textContent = '壁纸未保存：浏览器存储空间不足或存储不可用。已保存的壁纸不受影响，请删除不需要的壁纸后重试。';
    }
    async function removeImage(item) {
      if (busy) return;
      const index = images.indexOf(item);
      const remaining = images.filter(image => image.id !== item.id);
      const replacement = remaining[Math.min(index, remaining.length - 1)];
      const previous = {...state};
      const isActive = state.activeImageId === item.id;
      const next = isActive ? {...state, activeImageId: replacement?.id || '', image: '', wallpaper: state.wallpaper === 'upload' && !replacement ? 'molecular' : state.wallpaper} : {...state};
      if (!persist(next)) return;
      busy = true; render();
      try {
        await transaction('readwrite', store => store.delete(item.id));
        images = remaining;
        if (isActive) next.image = imageUrl(replacement);
        state = next;
        if (isActive && !replacement && activeUrl) {
          URL.revokeObjectURL(activeUrl); activeUrl = ''; activeUrlId = '';
        }
        status.textContent = isActive && !replacement && previous.wallpaper === 'upload' ? '已删除，已恢复学院背景。' : '已删除这张壁纸，其他壁纸已保留。';
      } catch {
        persist(previous);
        storageError();
      } finally { busy = false; render(); }
      if (!gallery.contains(document.activeElement)) gallery.querySelector('[data-wallpaper-id]')?.focus({preventScroll: true});
    }
    function readImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('无法读取图片'));
        image.src = src;
      });
    }
    function canvasFor(image, maxSize) {
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
    const jpegBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法处理图片')), 'image/jpeg', quality));
    async function processFile(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
      if (file.size > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20 MB');
      const url = URL.createObjectURL(file);
      try {
        const image = await readImage(url);
        const canvas = canvasFor(image, 1920);
        let blob = await jpegBlob(canvas, .86);
        if (blob.size > 1800000) blob = await jpegBlob(canvas, .65);
        return {id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2), name: file.name.slice(0, 120), blob, thumbnail: canvasFor(image, 240).toDataURL('image/jpeg', .75), createdAt: Date.now()};
      } finally { URL.revokeObjectURL(url); }
    }
    async function loadLibrary() {
      try {
        db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('seubme_wallpapers_v1', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('images', {keyPath: 'id'});
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error('壁纸库暂时被其他窗口占用'));
        });
        db.onversionchange = () => { db.close(); ready = false; render(); status.textContent = '壁纸库已更新，请刷新页面后继续。'; };
        images = (await transaction('readonly', store => store.getAll())).filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.blob instanceof Blob && validImage(item.thumbnail)).sort((a, b) => a.createdAt - b.createdAt);
        // Migrate the previous single upload without changing its pixels.
        if (validImage(state.image) && !state.activeImageId) {
          const legacyId = 'legacy-upload';
          if (!images.some(item => item.id === legacyId)) {
            const parts = state.image.split(',');
            const bytes = Uint8Array.from(atob(parts[1]), character => character.charCodeAt(0));
            const blob = new Blob([bytes], {type: state.image.slice(5, state.image.indexOf(';'))});
            const legacyImage = await readImage(state.image);
            const legacy = {id: legacyId, name: '原来的壁纸', blob, thumbnail: canvasFor(legacyImage, 240).toDataURL('image/jpeg', .75), createdAt: 0};
            await transaction('readwrite', store => store.put(legacy));
            images.unshift(legacy);
          }
          const next = {...state, activeImageId: legacyId};
          if (persist(next)) state = next;
        }
        const selected = images.find(item => item.id === state.activeImageId) || images[0];
        if (selected) {
          const next = {...state, activeImageId: selected.id};
          if (state.activeImageId === selected.id || persist(next)) { next.image = imageUrl(selected); state = next; }
        } else if (state.activeImageId) {
          const next = {...state, activeImageId: '', image: '', wallpaper: state.wallpaper === 'upload' ? 'molecular' : state.wallpaper};
          if (persist(next)) state = next;
        }
        ready = true;
      } catch {
        empty.textContent = '暂时无法打开壁纸库。原有壁纸和其他背景设置仍可使用。';
        status.textContent = '浏览器未能读取壁纸库，请允许网站存储后刷新重试。';
      }
      render();
    }
    document.getElementById('appearanceButton').addEventListener('click', () => dialog.showModal());
    ['closeAppearance', 'doneAppearance'].forEach(id => document.getElementById(id).addEventListener('click', () => dialog.close()));
    controls.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => save({...state, theme: button.dataset.themeChoice})));
    controls.querySelectorAll('[data-wallpaper-choice]').forEach(button => button.addEventListener('click', () => save({...state, wallpaper: button.dataset.wallpaperChoice})));
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length || !ready || busy) return;
      busy = true; render();
      const additions = [], errors = [];
      try {
        for (let index = 0; index < files.length; index++) {
          status.textContent = '正在处理图片 ' + (index + 1) + ' / ' + files.length + '…';
          try { additions.push(await processFile(files[index])); }
          catch (error) { errors.push(files[index].name + '：' + error.message); }
        }
        if (additions.length) {
          await transaction('readwrite', store => { additions.forEach(item => store.put(item)); });
          images.push(...additions);
          const selected = select(additions[0]);
          status.textContent = selected ? '已保存 ' + additions.length + ' 张壁纸，点击缩略图即可切换。' : '已保存 ' + additions.length + ' 张壁纸，但未能保存当前选择，请释放设置存储空间后重新选择。';
        }
        if (errors.length) status.textContent = (additions.length ? status.textContent + ' ' : '') + '有 ' + errors.length + ' 张未添加：' + errors.join('；');
      } catch { storageError(); }
      finally { input.value = ''; busy = false; render(); }
    });
    render();
    loadLibrary();
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
})();
