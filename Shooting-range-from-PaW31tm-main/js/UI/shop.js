/* ═══════════════════════════════════════════════════════════════
   SHOP — магазин скинов + рулетка
   BETA 0.10.0
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
  return `<button class="shop-buy" data-action="buy" data-id="${skin.id}" data-price="${skin.price}">КУПИТЬ</button>`;
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
      <button class="shop-buy" data-action="buy" data-id="ult_laser" data-price="6000">
        🪙 6000
      </button>
      <div class="ult-hint">Или рекорд ${RECORD_REQ/1000}к</div>
    `;
  }

  // МЛРС
  /*if (skin.id === 'ult_MLRS'){
    const owned = skin.owned || Storage.get('owned_ult_MLRS', '0') === '1';
    if (owned){
      if (isActive) return `<button class="shop-buy active" disabled>✅ АКТИВНА</button>`;
      return `<button class="shop-buy owned" data-action="equip-ult" data-id="MLRS">ВЫБРАТЬ</button>`;
    }
    return `<button class="shop-buy" data-action="buy" data-id="ult_MLRS" data-price="12333">🪙 12333</button>`;
  }*/
  // МЛРС — пока недоступен
if (skin.id === 'ult_MLRS'){
  return `
    <button class="shop-buy" disabled style="opacity:.45;cursor:not-allowed">
      🚧 0.11.0
    </button>
    <div class="ult-hint">Скоро в обновлении</div>
  `;
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
          ${getSnowToggleHTML(skin)}
        </div>
      </div>
    `).join('');

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
  /* ★ МЛРС пока недоступен */
if (skinId === 'ult_MLRS'){
  toast('🚧 МЛРС появится в 0.11.0');
  return;
}
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
  const bgIds = ['bg_star', 'bg_sunset', 'bg_aurora', 'bg_nightcity'];
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