/* ═══════════════════════════════════════════════════════════════
   SETTINGS — экран настроек + китайский триггер
   ═══════════════════════════════════════════════════════════════ */

const Settings = (() => {

  function showToast(text, ms = 2400){
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

  /* ─── Громкость ─── */
  function renderVolume(){
    const slider = document.getElementById('volSlider');
    const val = document.getElementById('volVal');
    if (!slider || !val) return;

    const current = Storage.getVolume();
    slider.value = current;
    val.textContent = current + '%';

    slider.oninput = () => {
      const v = parseInt(slider.value, 10);
      val.textContent = v + '%';
      Storage.setVolume(v);
      if (typeof Game !== 'undefined' && Game.setVolume) Game.setVolume(v / 100);
    };
  }

  /* ─── Фоны ─── */
  function renderBackgrounds(){
    const buttons = document.querySelectorAll('.bg-btn');
    if (!buttons.length) return;

    // Скрываем китайский фон, если не открыт
    const chinaBtn = document.getElementById('bgChinaBtn');
    if (chinaBtn) chinaBtn.classList.toggle('hidden', !Storage.isChinaUnlocked());

    const current = Storage.getBackground();
    document.body.dataset.bg = current;
    buttons.forEach(b => b.classList.toggle('active', b.dataset.bg === current));

    buttons.forEach(btn => {
      btn.onclick = () => {
        const name = btn.dataset.bg;
        document.body.dataset.bg = name;
        Storage.setBackground(name);
        buttons.forEach(b => b.classList.toggle('active', b.dataset.bg === name));
      };
    });
  }

  /* ─── Пасхалка конфети ─── */
  function renderEasterEgg(){
    const devBtn = document.getElementById('devBtn');
    const confettiBtn = document.getElementById('bgConfettiBtn');
    if (!devBtn || !confettiBtn) return;

    if (Storage.isEasterEggFound()) confettiBtn.classList.remove('hidden');

    let clicks = 0;
    let resetTimer = null;

    devBtn.onclick = () => {
      clicks++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { clicks = 0; }, 3000);

      if (clicks >= 10){
        clicks = 0;
        Storage.setEasterEggFound();
        confettiBtn.classList.remove('hidden');
        showToast('🎉 Пасхалка открыта! Новый фон доступен.');
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     ★ КИТАЙСКИЙ ТРИГГЕР
     5 тапов на лого + лазер ON + фон "Космос"
     На 2-м тапе — красная вспышка (намёк)
     ═══════════════════════════════════════════════════════════════ */
  function renderChinaTrigger(){
    const logo = document.querySelector('#screenMain .logo-mark');
    if (!logo) return;

    logo.style.cursor = 'pointer';
    logo.style.userSelect = 'none';
    logo.style.webkitUserSelect = 'none';
    logo.style.transition = 'color .2s ease, text-shadow .2s ease';

    let clicks = 0;
    let resetTimer = null;

    logo.onclick = () => {
      clicks++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { clicks = 0; }, 3000);

      // На 2-м тапе — красная вспышка на полсекунды
      if (clicks === 2){
        logo.classList.remove('logo-flash');
        void logo.offsetWidth;
        logo.classList.add('logo-flash');
        setTimeout(() => logo.classList.remove('logo-flash'), 500);
      }

      if (clicks >= 5){
        clicks = 0;
        triggerChina();
      }
    };
  }

  function triggerChina(){
    const laserOn = Storage.isLaserEnabled();
    const bg = Storage.getBackground();

    // Проверка условий
    if (!laserOn || bg !== 'star'){
      // Условия не выполнены — мягкий намёк
      const needed = [];
      if (!laserOn) needed.push('лазер');
      if (bg !== 'star') needed.push('Космос');
      showToast('🀄 Ещё нужно: ' + needed.join(' + '));
      return;
    }

    // ★ ВСЁ ВЫПОЛНЕНО
    Storage.unlockChina();

    // Меняем фон и скин
    document.body.dataset.bg = 'china';
    Storage.setBackground('china');
    Skins.apply('china');
    Storage.setActiveSkin('china');

    // Обновляем кнопки в настройках
    document.querySelectorAll('.bg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === 'china');
    });
    const chinaBtn = document.getElementById('bgChinaBtn');
    if (chinaBtn) chinaBtn.classList.remove('hidden');

    // Звёздный залп
    showChinaStars();

    // Тост
    showToast('🚩 +100 社会信用 · Партия выдаёт вам Миска Рис и Кошка Жена', 4000);
  }

  function showChinaStars(){
    for (let i = 0; i < 40; i++){
      const s = document.createElement('div');
      s.className = 'china-star-fall';
      s.textContent = '★';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.fontSize = (14 + Math.random() * 18) + 'px';
      s.style.animationDuration = (2 + Math.random() * 2) + 's';
      s.style.animationDelay = (Math.random() * 0.8) + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 5000);
    }
  }

  /* ─── Init ─── */
  function init(){
    renderVolume();
    renderBackgrounds();
    renderEasterEgg();
    renderChinaTrigger();
  }

  return {
    init,
    render: () => {
      renderVolume();
      renderBackgrounds();
    }
  };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Settings.init());
} else {
  Settings.init();
}