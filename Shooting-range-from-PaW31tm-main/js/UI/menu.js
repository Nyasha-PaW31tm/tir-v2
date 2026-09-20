/* ═══════════════════════════════════════════════════════════════
   MENU — навигация между экранами
   Управляет: главное меню, настройки, об игре, история, рейтинг, магазин
   ═══════════════════════════════════════════════════════════════ */

const Menu = (() => {

  /* Список всех экранов-оверлеев (кроме endScreen — им управляет Game) */
  const SCREENS = [
    'screenMain',
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
    if (typeof refreshInfiniteToggle === 'function') refreshInfiniteToggle();
  }

  function hideMenu(){
    hideAllScreens();
  }

  /* ─── Лазерный целеуказатель (в главном меню) ─── */
  function initLaserToggle(){
    const btn = document.getElementById('laserToggle');
    if (!btn) return;

    const isOn = Storage.isLaserEnabled();
    btn.textContent = isOn ? 'ВКЛ' : 'ВЫКЛ';
    btn.classList.toggle('on', isOn);
    btn.classList.toggle('off', !isOn);

    btn.onclick = () => {
      const newState = !btn.classList.contains('on');
      btn.textContent = newState ? 'ВКЛ' : 'ВЫКЛ';
      btn.classList.toggle('on', newState);
      btn.classList.toggle('off', !newState);
      Storage.setLaserEnabled(newState);
    };
  }

  /* ─── Бесконечный режим ─── */
  let refreshInfiniteToggle = null;

  function initInfiniteToggle(){
    const block = document.getElementById('infiniteBlock');
    const btn = document.getElementById('infiniteToggle');
    if (!block || !btn) return;

    function refresh(){
      block.classList.toggle('hidden', !Storage.isInfiniteUnlocked());
      const isOn = Storage.isInfiniteMode();
      btn.textContent = isOn ? 'ВКЛ' : 'ВЫКЛ';
      btn.classList.toggle('on', isOn);
      btn.classList.toggle('off', !isOn);
    }

    refresh();

    btn.onclick = () => {
      const newState = !btn.classList.contains('on');
      Storage.setInfiniteMode(newState);
      btn.textContent = newState ? 'ВКЛ' : 'ВЫКЛ';
      btn.classList.toggle('on', newState);
      btn.classList.toggle('off', !newState);
    };

    refreshInfiniteToggle = refresh;
  }

  /* ─── Инициализация кнопок ─── */
  function init(){
    /* Главные кнопки */
    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.onclick = () => {
      hideMenu();
      Game.start();
    };

    const ratingBtn = document.getElementById('ratingBtn');
    if (ratingBtn) ratingBtn.onclick = () => {
      showScreen('screenRating');
      if (typeof Rating !== 'undefined' && Rating.render) Rating.render();
    };

    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn) shopBtn.onclick = () => {
      showScreen('screenShop');
      if (typeof Shop !== 'undefined' && Shop.render) Shop.render();
    };

    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn) historyBtn.onclick = () => {
      showScreen('screenHistory');
      if (typeof History !== 'undefined' && History.render) History.render();
    };

    const aboutBtn = document.getElementById('aboutBtn');
    if (aboutBtn) aboutBtn.onclick = () => showScreen('screenAbout');

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.onclick = () => {
      showScreen('screenSettings');
      if (typeof Settings !== 'undefined' && Settings.render) Settings.render();
    };

    /* Кнопки "Назад" */
    const backs = {
      backFromAbout:    () => showMain(),
      backFromHistory:  () => showMain(),
      backFromRating:   () => showMain(),
      backFromShop:     () => showMain(),
      backFromSettings: () => showMain()
    };
    for (const id in backs){
      const el = document.getElementById(id);
      if (el) el.onclick = backs[id];
    }

    /* Кнопка "В меню" на экране финиша */
    const backMenuBtn = document.getElementById('backMenu');
    if (backMenuBtn) backMenuBtn.onclick = () => {
      const endScreen = document.getElementById('endScreen');
      if (endScreen) endScreen.classList.add('hidden');
      showMain();
    };

    initLaserToggle();
    initInfiniteToggle();
  }

  return {
    init,
    showScreen,
    showMain,
    hideMenu
  };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Menu.init());
} else {
  Menu.init();
}