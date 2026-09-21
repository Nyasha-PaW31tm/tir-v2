/* ═══════════════════════════════════════════════════════════════
   SETTINGS — настройки + пасхалки + промокоды
   ═══════════════════════════════════════════════════════════════ */

const Settings = (() => {

  /* ─── Тост ─── */
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

    // Китайский фон — только если открыт
    const chinaBtn = document.getElementById('bgChinaBtn');
    if (chinaBtn) chinaBtn.classList.toggle('hidden', !Storage.isChinaUnlocked());

    // Космос — только если куплен
    const starBtn = document.getElementById('bgStarBtn');
    if (starBtn){
      const ownedBgStar = Storage.get('owned_bg_star', '0') === '1';
      starBtn.classList.toggle('hidden', !ownedBgStar);
    }
    
    // Закат — только если куплен
const sunsetBtn = document.getElementById('bgSunsetBtn');
if (sunsetBtn){
  const ownedBgSunset = Storage.get('owned_bg_sunset', '0') === '1';
  sunsetBtn.classList.toggle('hidden', !ownedBgSunset);
}

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

    if (!laserOn || bg !== 'star'){
      const needed = [];
      if (!laserOn) needed.push('лазер');
      if (bg !== 'star') needed.push('Космос');
      showToast('🀄 Ещё нужно: ' + needed.join(' + '));
      return;
    }

    Storage.unlockChina();

    document.body.dataset.bg = 'china';
    Storage.setBackground('china');
    Skins.apply('china');
    Storage.setActiveSkin('china');

    document.querySelectorAll('.bg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === 'china');
    });
    const chinaBtn = document.getElementById('bgChinaBtn');
    if (chinaBtn) chinaBtn.classList.remove('hidden');

    showChinaStars();
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

  /* ═══════════════════════════════════════════════════════════════
     ★ ПРОМОКОДЫ
     ═══════════════════════════════════════════════════════════════ */
  function renderPromo(){
    const promoBtn = document.getElementById('promoBtn');
    const promoModal = document.getElementById('promoModal');
    const promoInput = document.getElementById('promoInput');
    const promoSubmit = document.getElementById('promoSubmit');
    const promoClose = document.getElementById('promoClose');
    const promoResult = document.getElementById('promoResult');

    if (!promoBtn || !promoModal) return;

    /* Открыть модалку */
    promoBtn.onclick = () => {
      promoModal.classList.remove('hidden');
      if (promoInput){
        promoInput.value = '';
        promoInput.focus();
      }
      if (promoResult){
        promoResult.classList.add('hidden');
        promoResult.textContent = '';
        promoResult.className = 'promo-result hidden';
      }
    };

    /* Закрыть */
    if (promoClose){
      promoClose.onclick = () => {
        promoModal.classList.add('hidden');
      };
    }

    /* Отправить код */
    async function submitCode(){
      if (!promoInput || !promoResult) return;

      const code = promoInput.value.trim().toUpperCase();
      if (!code){
        showPromoResult('Введи код', 'error');
        return;
      }

      if (!API.isTelegramReady()){
        showPromoResult('Открой игру через Telegram-бота', 'error');
        return;
      }

      if (promoSubmit){
        promoSubmit.disabled = true;
        promoSubmit.textContent = '⏳ ПРОВЕРКА...';
      }

      const data = await API.redeemPromo(code);

      if (promoSubmit){
        promoSubmit.disabled = false;
        promoSubmit.textContent = 'АКТИВИРОВАТЬ';
      }

      if (!data || !data.ok){
        const errors = {
          'invalid code': '❌ Неверный код',
          'expired': '❌ Код истёк',
          'limit reached': '❌ Лимит активаций исчерпан',
          'already used': '❌ Ты уже активировал этот код',
          'no code': '❌ Пустой код',
          'auth': '❌ Ошибка авторизации',
          'network': '❌ Нет связи с сервером'
        };
        const msg = errors[data?.error] || ('❌ Ошибка: ' + (data?.error || 'unknown'));
        showPromoResult(msg, 'error');
        return;
      }

      // Успех
      Storage.setCoins(data.new_balance || (Storage.getCoins() + data.coins_added));
      Sync.updateCoinsUI();
      if (typeof Shop !== 'undefined' && Shop.updateCoins) Shop.updateCoins();

      showPromoResult('✅ Получено: 🪙 +' + data.coins_added + ' монет!', 'success');

      if (promoInput) promoInput.value = '';
    }

    function showPromoResult(text, type){
      if (!promoResult) return;
      promoResult.textContent = text;
      promoResult.className = 'promo-result ' + (type === 'success' ? 'success' : 'error');
      promoResult.classList.remove('hidden');
    }

    if (promoSubmit){
      promoSubmit.onclick = submitCode;
    }

    if (promoInput){
      promoInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitCode();
      });
    }
  }

  /* ─── Init ─── */
  function init(){
    renderVolume();
    renderBackgrounds();
    renderEasterEgg();
    renderChinaTrigger();
    renderPromo();
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