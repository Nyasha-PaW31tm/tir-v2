/* ═══════════════════════════════════════════════════════════════
   MENU — главное меню, подготовка к забегу, навигация
   BETA 0.10.0
   ═══════════════════════════════════════════════════════════════ */

const Menu = (() => {

  const SCREENS = [
    'screenMain',
    'screenPreGame',
    'screenSettings',
    'screenAbout',
    'screenHistory',
    'screenRating',
    'screenShop'
  ];

  /* ─── Показать / скрыть экраны ─── */
  function hideAllScreens(){
    SCREENS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function showScreen(id){
    hideAllScreens();
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function showMain(){
    showScreen('screenMain');
    Sync.updateCoinsUI();
  }

  function hideMenu(){
    hideAllScreens();
  }

  /* ═══════════════════════════════════════════════════════════════
     PRE-GAME — подготовка к забегу
     ═══════════════════════════════════════════════════════════════ */

  function renderPreGame(){
    /* ─── Табы режима ─── */
    const infiniteTab = document.getElementById('modeInfiniteTab');
    const normalTab = document.querySelector('.mode-tab[data-mode="normal"]');
    const hint = document.getElementById('modeHint');

    const infiniteUnlocked = Storage.isInfiniteUnlocked();
    const infiniteOn = Storage.isInfiniteMode();

    /* Явно управляем состоянием обеих вкладок */
    if (infiniteTab){
      infiniteTab.disabled = !infiniteUnlocked;
      infiniteTab.classList.toggle('locked', !infiniteUnlocked);
    }
    if (normalTab){
      normalTab.disabled = false;
    }

    /* Явно ставим/снимаем active на каждой вкладке */
    if (normalTab)   normalTab.classList.toggle('active',   !infiniteOn);
    if (infiniteTab) infiniteTab.classList.toggle('active',  infiniteOn);

    if (hint){
      if (infiniteOn){
        hint.textContent = '8 промахов — конец. Без лимита очков.';
      } else {
        hint.textContent = 'Цель — 10 000 очков. Победа открывает бесконечный режим.';
      }
    }

    /* ─── Лазер ─── */
    const laserBtn = document.getElementById('laserToggle');
    if (laserBtn){
      const isOn = Storage.isLaserEnabled();
      laserBtn.textContent = isOn ? 'ВКЛ' : 'ВЫКЛ';
      laserBtn.classList.toggle('on', isOn);
      laserBtn.classList.toggle('off', !isOn);

      laserBtn.onclick = () => {
        const newState = !laserBtn.classList.contains('on');
        laserBtn.textContent = newState ? 'ВКЛ' : 'ВЫКЛ';
        laserBtn.classList.toggle('on', newState);
        laserBtn.classList.toggle('off', !newState);
        Storage.setLaserEnabled(newState);
      };
    }

    /* ─── Ульты ─── */
    renderUltTabs();
  }

  /* ═══════════════════════════════════════════════════════════════
     УЛЬТЫ — рендер и выбор
     ═══════════════════════════════════════════════════════════════ */
  function renderUltTabs(){
    const tabs = document.querySelectorAll('.ult-tab');
    if (!tabs.length) return;

    const active = Storage.getActiveUlt();
    const owned = {
      classic: true,
      laser: Storage.get('owned_ult_laser', '0') === '1',
      MLRS: Storage.get('owned_ult_MLRS', '0') === '1'
    };

    tabs.forEach(tab => {
      const ult = tab.dataset.ult;
      const isOwned = owned[ult];
      const isActive = (active === ult) && isOwned;

      tab.classList.toggle('active', isActive);
      tab.classList.toggle('locked', !isOwned);
      tab.disabled = !isOwned;

      tab.onclick = () => {
        if (!isOwned) return;

        /* Заглушка МЛРС — пока не работает */
        if (ult === 'MLRS'){
          showToast('🚀 МЛРС будет доступен в 0.11.0');
          return;
        }

        Storage.setActiveUlt(ult);
        renderUltTabs();
      };
    });

    /* Хинт под ультами */
    const hint = document.getElementById('ultHint');
    if (hint){
      const texts = {
        classic: 'Стандартный залп ×3. Доступна всем.',
        laser: '🎯 Прожигает все линии. ×1.5 очки. Открывается при 210к очков или за 6 000 монет.',
        MLRS: '🚀 Залп РСЗО. Скоро в 0.11.0.'
      };
      hint.textContent = texts[active] || texts.classic;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ТОСТ — всплывашка
     ═══════════════════════════════════════════════════════════════ */
  function showToast(text, ms){
    ms = ms || 2200;
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#171c25;color:#fff;padding:14px 22px;border-radius:14px;' +
      'border:1px solid #ffd23c;font-weight:700;font-size:14px;z-index:9999;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:90vw;text-align:center;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), ms);
  }

  /* ═══════════════════════════════════════════════════════════════
     INIT PRE-GAME
     ═══════════════════════════════════════════════════════════════ */
  function initPreGame(){
    /* ★ Делегирование событий — работает даже после перерисовок */
    const modesWrap = document.querySelector('.pregame-modes');
    if (modesWrap && !modesWrap.__bound){
      modesWrap.__bound = true;

      modesWrap.addEventListener('click', (e) => {
        const tab = e.target.closest('.mode-tab');
        if (!tab) return;
        if (tab.disabled) return;

        const isInfinite = tab.dataset.mode === 'infinite';
        Storage.setInfiniteMode(isInfinite);
        renderPreGame();
      });
    }

    /* Кнопка «Начать забег» */
    const startBtn = document.getElementById('startRunBtn');
    if (startBtn){
      startBtn.onclick = () => {
        hideMenu();
        if (typeof Game !== 'undefined' && Game.start) Game.start();
      };
    }

    /* Кнопка «Назад» */
    const backBtn = document.getElementById('backFromPreGame');
    if (backBtn) backBtn.onclick = showMain;

    /* Боссы и ежедневка — заглушки */
    ['bossBtn', 'dailyBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.onclick = () => {
        const name = id === 'bossBtn' ? 'Боссы' : 'Ежедневные задания';
        showToast('🔒 ' + name + ' появятся в следующих обновлениях');
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════ */
  function init(){
    /* Главная кнопка «Играть» → pre-game */
    const playBtn = document.getElementById('playBtn');
    if (playBtn){
      playBtn.onclick = () => {
        showScreen('screenPreGame');
        renderPreGame();
      };
    }

    /* Профиль — заглушка до 0.11 */
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn){
      profileBtn.onclick = () => {
        showToast('👤 Профиль появится в 0.11.0');
      };
    }

    /* Рейтинг */
    const ratingBtn = document.getElementById('ratingBtn');
    if (ratingBtn){
      ratingBtn.onclick = () => {
        showScreen('screenRating');
        if (typeof Rating !== 'undefined' && Rating.render) Rating.render();
      };
    }

    /* Магазин */
    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn){
      shopBtn.onclick = () => {
        showScreen('screenShop');
        if (typeof Shop !== 'undefined' && Shop.render) Shop.render();
      };
    }

    /* История */
    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn){
      historyBtn.onclick = () => {
        showScreen('screenHistory');
        if (typeof History !== 'undefined' && History.render) History.render();
      };
    }

    /* Об игре */
    const aboutBtn = document.getElementById('aboutBtn');
    if (aboutBtn){
      aboutBtn.onclick = () => {
        showScreen('screenAbout');
        if (typeof About !== 'undefined' && About.render) About.render();
      };
    }

    /* Настройки */
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn){
      settingsBtn.onclick = () => {
        showScreen('screenSettings');
        if (typeof Settings !== 'undefined' && Settings.render) Settings.render();
      };
    }

    /* Кнопки «Назад» с других экранов */
    const backs = {
      backFromAbout:    showMain,
      backFromHistory:  showMain,
      backFromRating:   showMain,
      backFromShop:     showMain,
      backFromSettings: showMain
    };
    for (const id in backs){
      const el = document.getElementById(id);
      if (el) el.onclick = backs[id];
    }

    /* Кнопка «В меню» с экрана финиша */
    const backMenuBtn = document.getElementById('backMenu');
    if (backMenuBtn){
      backMenuBtn.onclick = () => {
        const endScreen = document.getElementById('endScreen');
        if (endScreen) endScreen.classList.add('hidden');
        showMain();
      };
    }

    initPreGame();
  }

  return {
    init,
    showScreen,
    showMain,
    hideMenu,
    renderPreGame
  };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Menu.init());
} else {
  Menu.init();
}