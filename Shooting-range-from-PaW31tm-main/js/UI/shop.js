/* ═══════════════════════════════════════════════════════════════
   SHOP — магазин скинов + рулетка + китайские пасхалки
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

  /* ★ Универсальное применение */
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

  /* ★ Инъекция китайских пасхальных скинов */
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

  function getPreviewHTML(skin){
    const cat = skin.category || 'weapon';
    if (cat === 'weapon'){
      return `<div class="shop-preview weapon-${skin.id}"></div>`;
    }
    if (skin.id === 'bg_star'){
      return `<div class="shop-preview background-bg_star"></div>`;
    }
    if (skin.id === 'bg_china'){
      return `<div class="shop-preview background-bg_china"></div>`;
    }
    return `<div class="shop-preview placeholder">СКОРО</div>`;
  }

  function getPriceHTML(skin){
    if (skin.owned || skin.price === 0) return '';

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

  function getButtonHTML(skin){
    if (skin.active){
      return `<button class="shop-buy active" disabled>✅ НАДЕТ</button>`;
    }
    if (skin.owned){
      return `<button class="shop-buy owned" data-action="equip" data-id="${skin.id}">НАДЕТЬ</button>`;
    }
    if (skin.price === 0){
      return `<button class="shop-buy owned" data-action="equip" data-id="${skin.id}">БЕСПЛАТНО</button>`;
    }
    return `<button class="shop-buy" data-action="buy" data-id="${skin.id}" data-price="${skin.price}">КУПИТЬ</button>`;
  }

  function renderList(){
    const list = document.getElementById('shopList');
    if (!list) return;

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
        ${getButtonHTML(skin)}
      </div>
    `).join('');

    list.querySelectorAll('.shop-buy').forEach(btn => {
      btn.onclick = () => handleAction(btn);
    });
  }

  async function handleAction(btn){
    const action = btn.dataset.action;
    const skinId = btn.dataset.id;
    const price = parseInt(btn.dataset.price || '0', 10);

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

        const eq = await API.setSkin(skinId);
        if (eq.ok){
          Storage.setActiveSkin(skinId);
          applyItem(skinId);
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

    if (action === 'equip'){
      btn.disabled = true;
      btn.textContent = '⏳...';

      // Пасхальные скины — только локально
      if (skinId === 'china' || skinId === 'bg_china'){
        Storage.setActiveSkin(skinId);
        applyItem(skinId);
        toast('✅ Надето');
        await load();
        return;
      }

      const resp = await API.setSkin(skinId);
      if (resp.ok){
        Storage.setActiveSkin(skinId);
        applyItem(skinId);
        toast('✅ Надето');
        await load();
      } else {
        toast('Ошибка');
        btn.disabled = false;
      }
    }
  }

  async function load(){
    if (!API.isTelegramReady()){
      const list = document.getElementById('shopList');
      // Всё равно показываем китайские скины локально
      cachedSkins = injectChinaSkins([]);
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
      const list = document.getElementById('shopList');
      // Всё равно показываем локальные
      cachedSkins = injectChinaSkins([]);
      renderList();
      return;
    }

    cachedSkins = injectChinaSkins(data.skins || []);
    cachedCoins = data.coins || 0;
    lastServerData = data;

    Storage.setCoins(cachedCoins);
    if (data.active_skin){
      Storage.setActiveSkin(data.active_skin);
      Skins.apply(data.active_skin);
    }

    Sync.updateCoinsUI();
    updateCoins();
    refreshRouletteBtn();
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