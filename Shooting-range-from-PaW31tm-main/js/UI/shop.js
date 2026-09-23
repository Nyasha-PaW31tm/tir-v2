/* ═══════════════════════════════════════════════════════════════
   SHOP — магазин скинов + рулетка
   BETA 0.9.4
   ═══════════════════════════════════════════════════════════════ */

const Shop = (() => {

  let currentCategory = 'weapon';
  let cachedSkins = [];
  let cachedCoins = 0;
  let lastServerData = null;

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

  function initCategories(){
    const buttons = document.querySelectorAll('.shop-cat-btn');
    buttons.forEach(btn => {
      btn.onclick = () => {
        currentCategory = btn.dataset.category;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        renderList();
      };
    });
  }

  function ensureRouletteBtn(){
    let btn = document.getElementById('rouletteBtn');
    if (btn) return btn;

    const header = document.querySelector('.shop-header');
    if (!header) return null;

    btn = document.createElement('button');
    btn.id = 'rouletteBtn';
    btn.className = 'roulette-btn';
    btn.innerHTML = '🎁';
    btn.onclick = () => {
      if (typeof Roulette !== 'undefined'){
        Roulette.open(lastServerData);
      }
    };
    header.appendChild(btn);
    return btn;
  }

  function refreshRouletteBtn(){
    const btn = ensureRouletteBtn();
    if (!btn) return;

    const available = lastServerData && lastServerData.spin_available;

    if (available){
      btn.classList.add('ready');
      btn.disabled = false;
      if (!btn.querySelector('.dot')){
        const dot = document.createElement('span');
        dot.className = 'dot';
        btn.appendChild(dot);
      }
    } else {
      btn.classList.remove('ready');
      btn.disabled = false;
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
  function getKindBadge(skin){
    const cat = skin.category || 'weapon';
    if (cat !== 'weapon') return '';

    if (skin.id === 'akc74m'){
      return '<span class="shop-kind weapon">Оружие</span>';
    }
    return '<span class="shop-kind skin">Скин</span>';
  }

  /* Превью */
function getPreviewHTML(skin){
  const cat = skin.category || 'weapon';
  if (cat === 'weapon'){
    return `<div class="shop-preview weapon-${skin.id}"></div>`;
  }
  if (cat === 'target'){
    return `<div class="shop-preview target-${skin.id}"></div>`;
  }
  if (cat === 'ultimate'){
    return `<div class="shop-preview ult-${skin.id}"></div>`;
  }
  if (cat === 'background' || skin.id.startsWith('bg_')){
    return `<div class="shop-preview background-${skin.id}"></div>`;
  }
  return `<div class="shop-preview placeholder">СКОРО</div>`;
}

  /* Цена */
  function getPriceHTML(skin){
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

  /* Кнопка */
  function getButtonHTML(skin){
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
    return `<button class="shop-buy" data-action="buy" data-id="${skin.id}" data-price="${skin.price}">КУПИТЬ</button>`;
  }

/* ═══════════ СТОП. ВСТАВЬ ЧАСТЬ 2 НИЖЕ ═══════════ */

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

  /* ─── Отрисовка списка ─── */
  function renderList(){
    const list = document.getElementById('shopList');
    if (!list) return;

    recalcActive();

    const filtered = cachedSkins.filter(s => (s.category || 'weapon') === currentCategory);

    if (filtered.length === 0){
      list.innerHTML = `
        <div class="shop-empty">
          <span class="big-icon">🚧</span>
          Скоро здесь появятся товары
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(skin => `
      <div class="shop-row">
        ${getPreviewHTML(skin)}
        <div class="shop-info">
          <div class="shop-name">${skin.name}</div>
          <div class="shop-desc">${skin.description || ''}</div>
          ${getPriceHTML(skin)}
        </div>
        <div class="shop-action">
          ${getKindBadge(skin)}
          ${getButtonHTML(skin)}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.shop-buy').forEach(btn => {
      btn.onclick = () => handleAction(btn);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ДЕЙСТВИЯ: покупка / экипировка
     ═══════════════════════════════════════════════════════════════ */
  async function handleAction(btn){
    const action = btn.dataset.action;
    const skinId = btn.dataset.id;
    const price = parseInt(btn.dataset.price || '0', 10);

    const skinData = cachedSkins.find(s => s.id === skinId) || {};
    const cat = skinData.category || 'weapon';

    /* ─── ПОКУПКА ─── */
    if (action === 'buy'){
      const current = Storage.getCoins();
      if (current < price){
        toast('🪙 Не хватает монет');
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳...';
      const resp = await API.buySkin(skinId);

      if (resp.ok){
        Storage.setCoins(resp.new_balance || current - price);
        Sync.updateCoinsUI();
        updateCoins();
        toast('🎉 Куплено!');

        // Флаги покупки фонов
        if (skinId === 'bg_star')      Storage.set('owned_bg_star', '1');
if (skinId === 'bg_sunset')    Storage.set('owned_bg_sunset', '1');
if (skinId === 'bg_aurora')    Storage.set('owned_bg_aurora', '1');
if (skinId === 'bg_nightcity') Storage.set('owned_bg_nightcity', '1');

        // ★ Применение по категории
        if (cat === 'background' || skinId.startsWith('bg_')){
          const bgName = skinId.replace(/^bg_/, '');
          document.body.dataset.bg = bgName;
          Storage.setBackground(bgName);
        } else if (cat === 'target' || skinId.startsWith('tg_')){
          Skins.applyTargetSkin(skinId);
        } else {
          const eq = await API.setSkin(skinId);
          if (eq.ok){
            Storage.setActiveSkin(skinId);
            Skins.apply(skinId);
          }
        }
        await load();
      } else if (resp.error === 'not enough coins'){
        toast('🪙 Не хватает монет');
        btn.disabled = false;
        renderList();
      } else if (resp.error === 'already owned'){
        toast('Уже куплено');
        await load();
      } else {
        toast('Ошибка покупки');
        btn.disabled = false;
      }
      return;
    }

    /* ─── ЭКИПИРОВКА ─── */
    if (action === 'equip'){
      btn.disabled = true;
      btn.textContent = '⏳...';

      // ★ ФОН
      if (cat === 'background' || skinId.startsWith('bg_')){
        const bgName = skinId.replace(/^bg_/, '');
        document.body.dataset.bg = bgName;
        Storage.setBackground(bgName);
        toast('✅ Фон надет');
        await load();
        return;
      }

      // ★ МИШЕНИ
      if (cat === 'target' || skinId.startsWith('tg_')){
        Skins.applyTargetSkin(skinId);
        toast('✅ Мишени надеты');
        await load();
        return;
      }

      // ★ ПАСХАЛЬНЫЙ СКИН ОРУЖИЯ
      if (skinId === 'china'){
        Storage.setActiveSkin(skinId);
        Skins.apply(skinId);
        toast('✅ Надето');
        await load();
        return;
      }

      // ★ ОБЫЧНЫЙ СКИН ОРУЖИЯ
      const resp = await API.setSkin(skinId);
      if (resp.ok){
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
     ЗАГРУЗКА ДАННЫХ С СЕРВЕРА
     ═══════════════════════════════════════════════════════════════ */
  async function load(){
    if (!API.isTelegramReady()){
      const list = document.getElementById('shopList');
      cachedSkins = injectChinaSkins([]);
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
      cachedSkins = injectChinaSkins([]);
      recalcActive();
      renderList();
      return;
    }

    cachedSkins = injectChinaSkins(data.skins || []);
    cachedCoins = data.coins || 0;
    lastServerData = data;

    // Флаги покупки фонов
    const bgStar = (data.skins || []).find(s => s.id === 'bg_star');
    if (bgStar && bgStar.owned) Storage.set('owned_bg_star', '1');
    const bgSunset = (data.skins || []).find(s => s.id === 'bg_sunset');
    if (bgSunset && bgSunset.owned) Storage.set('owned_bg_sunset', '1');
    const bgAurora = (data.skins || []).find(s => s.id === 'bg_aurora');
if (bgAurora && bgAurora.owned) Storage.set('owned_bg_aurora', '1');
const bgNightcity = (data.skins || []).find(s => s.id === 'bg_nightcity');
if (bgNightcity && bgNightcity.owned) Storage.set('owned_bg_nightcity', '1');

    Storage.setCoins(cachedCoins);

    // Фикс: не сбрасываем пасхальный скин "Товарищ"
    const localActive = Storage.getActiveSkin();
    const isEasterSkin = (localActive === 'china');

    if (data.active_skin && !isEasterSkin){
      Storage.setActiveSkin(data.active_skin);
      Skins.apply(data.active_skin);
    } else if (isEasterSkin){
      Skins.apply(localActive);
    }

    // Мишени из localStorage
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