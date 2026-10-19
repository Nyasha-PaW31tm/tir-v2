/* ═══════════════════════════════════════════════════════════════
   SHOP — магазин скинов + рулетка
   BETA 0.11.1 — карточки, фильтры, сортировка, устойчивое превью
   ═══════════════════════════════════════════════════════════════ */

const Shop = (() => {

  const CATEGORIES = ['weapon', 'background', 'target', 'ultimate'];
  let currentCategory = Storage.get('shop_cat', 'weapon');
  if (!CATEGORIES.includes(currentCategory)) currentCategory = 'weapon';
  let filterMode = Storage.get('shop_filter', 'all');     /* all | owned | buy   */
  let sortMode   = Storage.get('shop_sort', 'smart');     /* smart | cheap | pricey */
  let cachedSkins = [];
  let cachedCoins = 0;
  let lastServerData = null;
  
  /* ★ Хэллоуин — дата окончания */
const HALLOWEEN_END = new Date('2026-11-05T23:59:59+03:00').getTime();

/* ★ Скрываем ивент-товары после окончания ивента (кроме купленных) */
function filterEventItems(skins){
  const now = Date.now();
  return skins.filter(s => {
    if (s.is_event !== 1) return true;         /* не ивент — всегда показываем */
    if (now <= HALLOWEEN_END) return true;      /* ивент ещё идёт — показываем */
    return s.owned;                             /* ивент кончился — только купленные видят */
  });
}

  function toast(text, ms = 2200){
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#171c25;color:#fff;padding:14px 22px;border-radius:14px;' +
      'border:1px solid #ffd23c;font-weight:700;font-size:14px;z-index:9999;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:90vw;text-align:center;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function updateCoins(){
    const el = document.getElementById('shopCoins');
    if (el) el.textContent = Storage.getCoins();
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,
      c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function setCategory(cat){
    currentCategory = cat;
    Storage.set('shop_cat', cat);
    document.querySelectorAll('.shop-cat-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.category === cat));
  }

  function initCategories(){
    document.querySelectorAll('.shop-cat-btn').forEach(btn => {
      btn.onclick = () => { setCategory(btn.dataset.category); renderList(); };
    });
    setCategory(currentCategory);
    renderToolbar();
  }

  /* ★ Фильтр и сортировка */
  const FILTERS = [['all', 'Все'], ['owned', 'Куплено'], ['buy', 'Купить']];
  const SORT_ORDER = ['smart', 'cheap', 'pricey'];
  const SORT_LABEL = { smart: '↕ Умная', cheap: '↑ Дешевле', pricey: '↓ Дороже' };

  function renderToolbar(){
    const bar = document.getElementById('shopToolbar');
    if (!bar) return;
    bar.innerHTML =
      `<div class="shop-seg">${FILTERS.map(([v, l]) =>
        `<button type="button" class="shop-seg-btn${v === filterMode ? ' active' : ''}" data-filter="${v}">${l}</button>`
      ).join('')}</div>` +
      `<button type="button" class="shop-sort" data-sort-cycle="1">${SORT_LABEL[sortMode] || SORT_LABEL.smart}</button>`;

    bar.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
      filterMode = b.dataset.filter; Storage.set('shop_filter', filterMode);
      renderToolbar(); renderList();
    });
    const cyc = bar.querySelector('[data-sort-cycle]');
    if (cyc) cyc.onclick = () => {
      sortMode = SORT_ORDER[(SORT_ORDER.indexOf(sortMode) + 1) % SORT_ORDER.length];
      Storage.set('shop_sort', sortMode);
      renderToolbar(); renderList();
    };
  }

  /* ★ Рулетка — баннер под шапкой */
  function ensureRouletteBtn(){
    let btn = document.getElementById('rouletteBtn');
    if (btn) return btn;

    const host = document.getElementById('shopRoulette') || document.querySelector('.shop-header');
    if (!host) return null;

    btn = document.createElement('button');
    btn.id = 'rouletteBtn';
    btn.type = 'button';
    btn.className = 'roulette-btn';
    btn.innerHTML =
      '<span class="rb-ico">🎁</span>' +
      '<span class="rb-txt"><b>Ежедневная рулетка</b><small>Испытай удачу</small></span>';
    btn.onclick = () => {
      if (typeof Roulette !== 'undefined'){
        Roulette.open(lastServerData);
      }
    };
    host.appendChild(btn);
    return btn;
  }

  function refreshRouletteBtn(){
    const btn = ensureRouletteBtn();
    if (!btn) return;

    const available = lastServerData && lastServerData.spin_available;
    const small = btn.querySelector('small');

    if (available){
      btn.classList.add('ready');
      btn.disabled = false;
      if (small) small.textContent = 'Бесплатный спин готов!';
      if (!btn.querySelector('.dot')){
        const dot = document.createElement('span');
        dot.className = 'dot';
        btn.appendChild(dot);
      }
    } else {
      btn.classList.remove('ready');
      btn.disabled = false;
      if (small) small.textContent = 'Спин уже использован — приходи завтра';
      const dot = btn.querySelector('.dot');
      if (dot) dot.remove();
    }
  }

  /* ★ Универсальное применение: скин оружия или фон */
  function applyItem(itemId){
    if (itemId.startsWith('bg_')){
      const bgName = itemId.slice(3);
      document.body.dataset.bg = bgName;
      Storage.setBackground(bgName);
      const btn = document.querySelector(`.bg-btn[data-bg="${bgName}"]`);
      if (btn){
        document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      return;
    }
    Skins.apply(itemId);
  }

  /* ★ Инъекция пасхальных скинов */
  function injectChinaSkins(skins){
    if (!Storage.isChinaUnlocked()) return skins;

    const result = skins.slice();

    if (!result.some(s => s.id === 'china')){
      result.push({
        id: 'china',
        name: 'Товарищ',
        price: 0,
        base_price: 0,
        discount: 0,
        description: '🚩 Пасхальный скин',
        category: 'weapon',
        owned: true,
        active: Storage.getActiveSkin() === 'china'
      });
    }

    if (!result.some(s => s.id === 'bg_china')){
      result.push({
        id: 'bg_china',
        name: 'Китайская народная',
        price: 0,
        base_price: 0,
        discount: 0,
        description: '🚩 Пасхальный фон',
        category: 'background',
        owned: true,
        active: Storage.getBackground() === 'china'
      });
    }

    return result;
  }

  /* ★ Бейдж "СКИН" / "ОРУЖИЕ" */
  function getKindBadge(skin) {
    const cat = skin.category || 'weapon';
    if (cat !== 'weapon') return '';

    const WEAPON_IDS = ['akc74m', 'shotgun'];
    if (WEAPON_IDS.includes(skin.id)) {
      return '<span class="shop-kind weapon">Оружие</span>';
    }
    return '<span class="shop-kind skin">Скин</span>';
  }

  /* ═══════════════════════════════════════════════════════════════
     ПРЕВЬЮ
     Раньше класс превью брался напрямую из id (weapon-<id>). Если id на
     сервере не совпадал с CSS — получалась белая заглушка (баг «Костяного
     ружья»). Теперь id сопоставляется с известными превью + эвристика
     по названию/описанию/ивент-флагу, а неизвестное получает нормальную
     иконку вместо заглушки.
     ═══════════════════════════════════════════════════════════════ */
  const PREVIEW_KNOWN = {
    weapon:     ['default', 'neon', 'star', 'china', 'akc74m', 'shotgun', 'halloween', 'frost', 'toxic'],
    target:     ['tg_classic', 'tg_neon', 'tg_halloween', 'tg_radar'],
    background: ['bg_star', 'bg_sunset', 'bg_aurora', 'bg_nightcity', 'bg_halloween', 'bg_china', 'bg_ocean'],
    ultimate:   ['ult_classic', 'ult_laser', 'ult_MLRS']
  };
  const PREVIEW_ALIASES = [
    [/halloween|hallow|bone|skelet|skull|кост|тыкв|хэллоуин|хеллоуин/i, 'halloween'],
    [/akc|ak-?74|акс/i,                                                'akc74m'],
    [/shotgun|дроб/i,                                                  'shotgun']
  ];
  const CAT_ICON = { weapon: '🔫', target: '🎯', background: '🎨', ultimate: '⚡' };

  function weaponPreviewKey(skin){
    if (PREVIEW_KNOWN.weapon.includes(skin.id)) return skin.id;
    const hay = [skin.id, skin.name, skin.description].join(' ');
    for (const [re, key] of PREVIEW_ALIASES){
      if (re.test(hay)) return key;
    }
    if (skin.is_event === 1) return 'halloween';
    console.warn('[shop] нет превью для оружия, id =', skin.id);
    return 'default';
  }

  function getPreviewHTML(skin){
    const cat = skin.category || 'weapon';

    if (cat === 'weapon'){
      return `<div class="shop-preview weapon-${weaponPreviewKey(skin)}"></div>`;
    }

    const prefix = { target: 'target', ultimate: 'ult', background: 'background' }[cat];
    const known  = PREVIEW_KNOWN[cat] || [];
    if (prefix && known.includes(skin.id)){
      return `<div class="shop-preview ${prefix}-${skin.id}"></div>`;
    }
    if (skin.id.startsWith('bg_') && known.includes(skin.id)){
      return `<div class="shop-preview background-${skin.id}"></div>`;
    }
    return `<div class="shop-preview placeholder"><span>${CAT_ICON[cat] || '🎁'}</span></div>`;
  }

  /* Цена */
  function getPriceHTML(skin){
    /* ★ Для ульт цену показывает кнопка, не отдельный блок */
if (skin.category === 'ultimate') return '';
    if (skin.owned) return '';

    if (typeof skin.price === 'string' && skin.price.indexOf('?') !== -1){
      return `<div class="shop-price-block"><span class="shop-price">🪙 ???</span></div>`;
    }
    if (skin.price === 0) return '';

    if (skin.discount > 0 && skin.base_price > skin.price){
      return `
        <div class="shop-price-block">
          <span class="shop-price old">🪙 ${skin.base_price}</span>
          <span class="shop-price">🪙 ${skin.price}</span>
          <span class="shop-discount">−${skin.discount}%</span>
        </div>`;
    }
    return `<div class="shop-price-block"><span class="shop-price">🪙 ${skin.price}</span></div>`;
  }

  /* Кнопка покупки/экипировки */
  function getButtonHTML(skin){
  /* ★ УЛЬТЫ — особая логика */
  if (skin.category === 'ultimate'){
    return getUltButtonHTML(skin);
  }

  /* Обычные товары */
  if (skin.active){
    return `<button class="shop-buy active" disabled>✅ НАДЕТ</button>`;
  }
  if (skin.owned){
    return `<button class="shop-buy owned" data-action="equip" data-id="${skin.id}">НАДЕТЬ</button>`;
  }
  if (typeof skin.price === 'string' && skin.price.indexOf('?') !== -1){
    return `<button class="shop-buy" disabled style="opacity:.5">СКОРО</button>`;
  }
  if (skin.price === 0){
    return `<button class="shop-buy owned" data-action="equip" data-id="${skin.id}">БЕСПЛАТНО</button>`;
  }
  const coins = Storage.getCoins();
  const poor = coins < skin.price;
  return `<button class="shop-buy${poor ? ' poor' : ''}" data-action="buy" data-id="${skin.id}" data-price="${skin.price}">${poor ? 'Не хватает 🪙 ' + (skin.price - coins) : 'КУПИТЬ'}</button>`;
}

/* ★ Логика кнопок для ульт */
function getUltButtonHTML(skin){
  const activeUlt = Storage.getActiveUlt();
  const isActive = (activeUlt === skin.id.replace('ult_', '') ||
                    (skin.id === 'ult_classic' && activeUlt === 'classic') ||
                    (skin.id === 'ult_laser' && activeUlt === 'laser') ||
                    (skin.id === 'ult_MLRS' && activeUlt === 'MLRS'));

  // Классика — всегда бесплатна
  if (skin.id === 'ult_classic'){
    if (isActive) return `<button class="shop-buy active" disabled>✅ АКТИВНА</button>`;
    return `<button class="shop-buy owned" data-action="equip-ult" data-id="classic">ВЫБРАТЬ</button>`;
  }

  // Лазер
  if (skin.id === 'ult_laser'){
    const owned = skin.owned || Storage.get('owned_ult_laser', '0') === '1';
    const record = Storage.getPersonalBest();
    const RECORD_REQ = 210000;
    const canClaimByRecord = record >= RECORD_REQ;

    if (owned){
      if (isActive) return `<button class="shop-buy active" disabled>✅ АКТИВНА</button>`;
      return `<button class="shop-buy owned" data-action="equip-ult" data-id="laser">ВЫБРАТЬ</button>`;
    }

    if (canClaimByRecord){
      return `
        <button class="shop-buy ult-record" data-action="claim-record" data-id="ult_laser">
          🎖 ЗАБРАТЬ
        </button>
        <div class="ult-hint">Открыт рекордом ${Math.floor(record/1000)}к</div>
      `;
    }

    return `
      <button class="shop-buy${Storage.getCoins() < 6000 ? ' poor' : ''}" data-action="buy" data-id="ult_laser" data-price="6000">
        🪙 6000
      </button>
      <div class="ult-hint">Или рекорд ${RECORD_REQ/1000}к</div>
    `;
  }

  // МЛРС
  if (skin.id === 'ult_MLRS'){
    const owned = skin.owned || Storage.get('owned_ult_MLRS', '0') === '1';
    if (owned){
      if (isActive) return `<button class="shop-buy active" disabled>✅ АКТИВНА</button>`;
      return `<button class="shop-buy owned" data-action="equip-ult" data-id="MLRS">ВЫБРАТЬ</button>`;
    }
    return `<button class="shop-buy${Storage.getCoins() < 12333 ? ' poor' : ''}" data-action="buy" data-id="ult_MLRS" data-price="12333">🪙 12333</button>`;
  }

  return '';
}

  /* ★ Тумблер снега — только для купленной Авроры */
  function getSnowToggleHTML(skin){
    if (skin.id !== 'bg_aurora') return '';
    if (!skin.owned) return '';

    const snowOn = Storage.getAuroraSnow();
    return `<button class="shop-snow-toggle ${snowOn ? 'on' : 'off'}" data-snow-toggle="1">
      ❄ ${snowOn ? 'ВКЛ' : 'ВЫКЛ'}
    </button>`;
  }

  /* ─── Пересчёт active перед выводом ─── */
  function recalcActive(){
    const activeWeapon = Storage.getActiveSkin();
    const activeBg     = Storage.getBackground();
    const activeTarget = Storage.getActiveTargetSkin();

    cachedSkins.forEach(s => {
      const cat = s.category || 'weapon';
      if (cat === 'weapon'){
        s.active = (activeWeapon === s.id);
      } else if (cat === 'background'){
        s.active = (activeBg === s.id || 'bg_' + activeBg === s.id);
      } else if (cat === 'target'){
        s.active = (activeTarget === s.id);
      } else {
        s.active = false;
      }
    });
  }

  /* ─── Хелперы состояния товара ─── */
  const PRICE_FALLBACK = { ult_laser: 6000, ult_MLRS: 12333 };

  function isSoon(s){
    return typeof s.price === 'string' && s.price.indexOf('?') !== -1;
  }
  function priceOf(s){
    if (isSoon(s)) return Infinity;
    const p = Number(s.price);
    if (Number.isFinite(p)) return p;
    return PRICE_FALLBACK[s.id] || 0;
  }
  function isOwned(s){
    if (s.category === 'ultimate'){
      if (s.id === 'ult_classic') return true;
      return !!s.owned || Storage.get('owned_' + s.id, '0') === '1';
    }
    return !!s.owned || (!isSoon(s) && s.price === 0);
  }
  function isActiveItem(s){
    if (s.category === 'ultimate'){
      return Storage.getActiveUlt() === s.id.replace('ult_', '');
    }
    return !!s.active;
  }
  function isEvent(s){ return s.is_event === 1; }

  function eventLeft(){
    const days = Math.ceil((HALLOWEEN_END - Date.now()) / 86400000);
    if (days <= 0) return 'финал';
    if (days === 1) return 'последний день';
    return days + ' дн.';
  }

  /* ─── Счётчики на вкладках (куплено/всего) ─── */
  function updateCounts(){
    document.querySelectorAll('.shop-cat-btn').forEach(btn => {
      const cat = btn.dataset.category;
      const all = cachedSkins.filter(s => (s.category || 'weapon') === cat);
      let el = btn.querySelector('.cat-count');
      if (!el){
        el = document.createElement('span');
        el.className = 'cat-count';
        btn.appendChild(el);
      }
      el.textContent = all.length ? all.filter(isOwned).length + '/' + all.length : '';
    });
  }

  /* ─── Карточка товара ─── */
  function cardHTML(skin, wide){
    const owned  = isOwned(skin);
    const active = isActiveItem(skin);
    const ev     = isEvent(skin);

    const tags = [];
    if (active) tags.push('<span class="shop-tag on">✓ Надето</span>');
    else if (ev && !owned) tags.push(`<span class="shop-tag event">🎃 ${eventLeft()}</span>`);
    if (!owned && skin.discount > 0) tags.push(`<span class="shop-tag sale">−${skin.discount}%</span>`);

    return `
      <article class="shop-card${wide ? ' wide' : ''}${active ? ' is-active' : ''}${owned ? ' is-owned' : ''}${ev ? ' is-event' : ''}">
        <div class="shop-card-media">
          ${getPreviewHTML(skin)}
          <div class="shop-card-kind">${getKindBadge(skin)}</div>
          <div class="shop-card-tags">${tags.join('')}</div>
        </div>
        <div class="shop-card-side">
          <div class="shop-card-body">
            <div class="shop-name">${esc(skin.name)}</div>
            <div class="shop-desc">${esc(skin.description || '')}</div>
            ${getPriceHTML(skin)}
          </div>
          <div class="shop-card-foot">
            ${getButtonHTML(skin)}
            ${getSnowToggleHTML(skin)}
          </div>
        </div>
      </article>`;
  }

  function emptyHTML(icon, text){
    return `<div class="shop-empty"><span class="big-icon">${icon}</span>${text}</div>`;
  }

  /* ─── Отрисовка списка ─── */
  const GROUP_TITLES = ['Сейчас используется', '🎃 Событие', 'В продаже', 'Моя коллекция'];

  function groupOf(s){
    if (isActiveItem(s)) return 0;
    if (isEvent(s) && !isOwned(s)) return 1;
    if (!isOwned(s)) return 2;
    return 3;
  }

  function renderList(){
    const list = document.getElementById('shopList');
    if (!list) return;

    recalcActive();
    updateCounts();

    let items = cachedSkins.filter(s => (s.category || 'weapon') === currentCategory);

    if (items.length === 0){
      list.innerHTML = emptyHTML('🚧', 'Скоро здесь появятся товары');
      return;
    }

    if (filterMode === 'owned') items = items.filter(isOwned);
    else if (filterMode === 'buy') items = items.filter(s => !isOwned(s));

    if (items.length === 0){
      list.innerHTML = filterMode === 'owned'
        ? emptyHTML('🛍️', 'Пока ничего не куплено')
        : emptyHTML('🎉', 'Всё в этой категории уже куплено');
      return;
    }

    let html = '';
    if (sortMode === 'smart'){
      const buckets = [[], [], [], []];
      items.forEach(s => buckets[groupOf(s)].push(s));
      buckets.forEach((arr, i) => {
        if (!arr.length) return;
        arr.sort(i === 3
          ? (a, b) => String(a.name).localeCompare(String(b.name), 'ru')
          : (a, b) => priceOf(a) - priceOf(b));
        html += `<div class="shop-section">${GROUP_TITLES[i]}<i>${arr.length}</i></div>` + arr.map(x => cardHTML(x, i === 0)).join('');
      });
    } else {
      const dir = sortMode === 'cheap' ? 1 : -1;
      items.sort((a, b) => {
        const pa = isSoon(a) ? 1e12 : priceOf(a), pb = isSoon(b) ? 1e12 : priceOf(b);
        return (pa - pb) * dir || String(a.name).localeCompare(String(b.name), 'ru');
      });
      html = items.map(x => cardHTML(x, false)).join('');
    }
    list.innerHTML = html;

    /* Кнопки покупки/экипировки */
    list.querySelectorAll('.shop-buy').forEach(btn => {
      btn.onclick = () => handleAction(btn);
    });

    /* ★ Тумблер снега в магазине */
    list.querySelectorAll('[data-snow-toggle]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        const newState = !btn.classList.contains('on');
        Storage.setAuroraSnow(newState);
        btn.textContent = '❄ ' + (newState ? 'ВКЛ' : 'ВЫКЛ');
        btn.classList.toggle('on', newState);
        btn.classList.toggle('off', !newState);

        /* Если Аврора сейчас активна — переключаем вживую */
        const cur = document.body.dataset.bg;
        if (cur === 'aurora' || cur === 'aurora-winter'){
          const target = newState ? 'aurora-winter' : 'aurora';
          document.body.dataset.bg = target;
          Storage.setBackground(target);
        }
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ДЕЙСТВИЯ: покупка / экипировка
     ═══════════════════════════════════════════════════════════════ */
  async function handleAction(btn) {
  const action = btn.dataset.action;
  const skinId = btn.dataset.id;
  const price = parseInt(btn.dataset.price || '0', 10);
  
  const skinData = cachedSkins.find(s => s.id === skinId) || {};
  const cat = skinData.category || 'weapon';
  
  /* ─── БЫСТРЫЕ ЭКШЕНЫ БЕЗ ПОКУПКИ ─── */
  if (action === 'equip-ult') {
    Storage.setActiveUlt(skinId);
    toast('✅ Ульта выбрана');
    renderList();
    return;
  }
  
  if (action === 'claim-record') {
    const record = Storage.getPersonalBest();
    if (record < 210000) {
      toast('🎖 Нужен рекорд 210 000');
      return;
    }
    Storage.set('owned_ult_laser', '1');
    Storage.setActiveUlt('laser');
    toast('🎖 Лазер открыт!');
    await load();
    return;
  }
  
  /* ─── ПОКУПКА ─── */
  if (action === 'buy') {
    const current = Storage.getCoins();
    if (current < price) {
      toast('🪙 Не хватает монет');
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳...';
    const resp = await API.buySkin(skinId);
    
    if (resp.ok) {
      Storage.setCoins(resp.new_balance || current - price);
      Sync.updateCoinsUI();
      updateCoins();
      toast('🎉 Куплено!');
      
      // Флаги покупки фонов
      if (skinId === 'bg_star') Storage.set('owned_bg_star', '1');
      if (skinId === 'bg_sunset') Storage.set('owned_bg_sunset', '1');
      if (skinId === 'bg_aurora') Storage.set('owned_bg_aurora', '1');
      if (skinId === 'bg_nightcity') Storage.set('owned_bg_nightcity', '1');
      if (skinId === 'bg_halloween') Storage.set('owned_bg_halloween', '1');
      if (skinId === 'bg_ocean') Storage.set('owned_bg_ocean', '1');
      
      // ★ Флаги покупки ульт
      if (skinId === 'ult_laser') {
        Storage.set('owned_ult_laser', '1');
        Storage.setActiveUlt('laser');
      }
      if (skinId === 'ult_MLRS') {
        Storage.set('owned_ult_MLRS', '1');
        Storage.setActiveUlt('MLRS');
      }
      
      // Применение по категории
      if (cat === 'background' || skinId.startsWith('bg_')) {
        const bgName = skinId.replace(/^bg_/, '');
        document.body.dataset.bg = bgName;
        Storage.setBackground(bgName);
      } else if (cat === 'target' || skinId.startsWith('tg_')) {
        Skins.applyTargetSkin(skinId);
      } else if (cat === 'weapon') {
        const eq = await API.setSkin(skinId);
        if (eq.ok) {
          Storage.setActiveSkin(skinId);
          Skins.apply(skinId);
        }
      }
      await load();
    } else if (resp.error === 'not enough coins') {
      toast('🪙 Не хватает монет');
      btn.disabled = false;
      renderList();
    } else if (resp.error === 'already owned') {
      toast('Уже куплено');
      await load();
    } else {
      toast('Ошибка покупки');
      btn.disabled = false;
    }
    return;
  }
  
  /* ─── ЭКИПИРОВКА ─── */
  if (action === 'equip') {
    btn.disabled = true;
    btn.textContent = '⏳...';
    
    // ФОН
    if (cat === 'background' || skinId.startsWith('bg_')) {
      const bgName = skinId.replace(/^bg_/, '');
      document.body.dataset.bg = bgName;
      Storage.setBackground(bgName);
      toast('✅ Фон надет');
      await load();
      return;
    }
    
    // МИШЕНИ
    if (cat === 'target' || skinId.startsWith('tg_')) {
      Skins.applyTargetSkin(skinId);
      toast('✅ Мишени надеты');
      await load();
      return;
    }
    
    // ПАСХАЛЬНЫЙ СКИН ОРУЖИЯ
    if (skinId === 'china') {
      Storage.setActiveSkin(skinId);
      Skins.apply(skinId);
      toast('✅ Надето');
      await load();
      return;
    }
    
    // ОБЫЧНЫЙ СКИН ОРУЖИЯ
    const resp = await API.setSkin(skinId);
    if (resp.ok) {
      Storage.setActiveSkin(skinId);
      Skins.apply(skinId);
      toast('✅ Надето');
      await load();
    } else {
      toast('Ошибка');
      btn.disabled = false;
    }
  }
}

  /* ═══════════════════════════════════════════════════════════════
     ДВУСТОРОННЯЯ СИНХРОНИЗАЦИЯ ФЛАГОВ "КУПЛЕНО"
     ═══════════════════════════════════════════════════════════════ */
  function syncOwnedFlags(skins) {
  /* Фоны — двусторонняя синхронизация */
  const bgIds = ['bg_star', 'bg_sunset', 'bg_aurora', 'bg_nightcity', 'bg_halloween', 'bg_ocean'];
  bgIds.forEach(id => {
    const skin = (skins || []).find(s => s.id === id);
    const key = 'owned_' + id;
    if (!skin) { Storage.remove(key); return; }
    if (skin.owned) Storage.set(key, '1');
    else Storage.remove(key);
  });
  
  /* ★ Ульты — синхронизация (не сбрасываем если открыт по рекорду) */
  ['ult_laser', 'ult_MLRS'].forEach(id => {
    const skin = (skins || []).find(s => s.id === id);
    const key = 'owned_' + id;
    if (!skin) return;
    if (skin.owned) Storage.set(key, '1');
    // ★ НЕ сбрасываем флаг, если он был установлен локально (рекорд / покупка)
  });
}

  /* ═══════════════════════════════════════════════════════════════
     ЗАГРУЗКА ДАННЫХ С СЕРВЕРА
     ═══════════════════════════════════════════════════════════════ */
  async function load(){
    if (!API.isTelegramReady()){
      const list = document.getElementById('shopList');
      cachedSkins = injectChinaSkins(filterEventItems([]));
      recalcActive();
      renderList();
      if (list && cachedSkins.length === 0){
        list.innerHTML = `
          <div class="shop-empty">
            <span class="big-icon">📱</span>
            Открой через Telegram, чтобы увидеть магазин
          </div>`;
      }
      return;
    }

    const data = await API.getSkins();
    if (!data.ok){
      cachedSkins = injectChinaSkins(filterEventItems([]));
      recalcActive();
      renderList();
      return;
    }

    cachedSkins = injectChinaSkins(filterEventItems(data.skins || []));
    cachedCoins = data.coins || 0;
    lastServerData = data;

    /* Синхронизация флагов покупки */
    syncOwnedFlags(data.skins || []);

    Storage.setCoins(cachedCoins);

    /* Фикс: не сбрасываем пасхальный скин "Товарищ" */
    const localActive = Storage.getActiveSkin();
    const isEasterSkin = (localActive === 'china');

    if (data.active_skin && !isEasterSkin){
      Storage.setActiveSkin(data.active_skin);
      Skins.apply(data.active_skin);
    } else if (isEasterSkin){
      Skins.apply(localActive);
    }

    /* Мишени из localStorage */
    if (Skins.loadTargetFromStorage){
      Skins.loadTargetFromStorage();
    }

    Sync.updateCoinsUI();
    updateCoins();
    refreshRouletteBtn();
    recalcActive();
    renderList();
  }

  async function render(){
    updateCoins();
    ensureRouletteBtn();
    await load();
  }

  function init(){
    initCategories();
  }

  return { init, render, updateCoins };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Shop.init());
} else {
  Shop.init();
}