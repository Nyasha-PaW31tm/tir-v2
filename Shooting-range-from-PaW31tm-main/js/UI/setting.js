/* ═══════════════════════════════════════════════════════════════
   SETTINGS — настройки + пасхалки + промокоды + обратная связь
   BETA 0.9.5
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
  function renderBackgrounds() {
  const buttons = document.querySelectorAll('.bg-btn');
  if (!buttons.length) return;
  
  /* ─── Видимость кнопок ─── */
  const chinaBtn = document.getElementById('bgChinaBtn');
  if (chinaBtn) chinaBtn.classList.toggle('hidden', !Storage.isChinaUnlocked());
  
  const starBtn = document.getElementById('bgStarBtn');
  if (starBtn) {
    const owned = Storage.get('owned_bg_star', '0') === '1';
    starBtn.classList.toggle('hidden', !owned);
  }
  
  const sunsetBtn = document.getElementById('bgSunsetBtn');
  if (sunsetBtn) {
    const owned = Storage.get('owned_bg_sunset', '0') === '1';
    sunsetBtn.classList.toggle('hidden', !owned);
  }
  
  const auroraBtn = document.getElementById('bgAuroraBtn');
  const snowToggle = document.getElementById('auroraSnowToggle');
  const ownedAurora = Storage.get('owned_bg_aurora', '0') === '1';
  
  if (auroraBtn) {
    auroraBtn.classList.toggle('hidden', !ownedAurora);
  }
  
  /* ─── Тумблер снега ─── */
  if (snowToggle && auroraBtn) {
    const snowOn = Storage.getAuroraSnow();
    snowToggle.textContent = '❄ Снег ' + (snowOn ? 'ВКЛ' : 'ВЫКЛ');
    snowToggle.classList.toggle('on', snowOn);
    
    snowToggle.onclick = (e) => {
      e.stopPropagation();
      const newState = !snowToggle.classList.contains('on');
      Storage.setAuroraSnow(newState);
      snowToggle.textContent = '❄ Снег ' + (newState ? 'ВКЛ' : 'ВЫКЛ');
      snowToggle.classList.toggle('on', newState);
      
      /* Если Аврора активна — переключаем вживую */
      const cur = document.body.dataset.bg;
      if (cur === 'aurora' || cur === 'aurora-winter') {
        const target = newState ? 'aurora-winter' : 'aurora';
        document.body.dataset.bg = target;
        Storage.setBackground(target);
        buttons.forEach(b => {
          b.classList.toggle('active', b.dataset.bg === 'aurora');
        });
      }
    };
  }
  
  const nightcityBtn = document.getElementById('bgNightcityBtn');
  if (nightcityBtn) {
    const owned = Storage.get('owned_bg_nightcity', '0') === '1';
    nightcityBtn.classList.toggle('hidden', !owned);
  }
  
  /* ─── Применяем текущий фон ─── */
  const current = Storage.getBackground();
  document.body.dataset.bg = current;
  
  buttons.forEach(b => {
    const btnBg = b.dataset.bg;
    const isActive = (btnBg === current) ||
      (btnBg === 'aurora' && current === 'aurora-winter');
    b.classList.toggle('active', isActive);
  });
  
  /* ─── Клик по кнопке фона ─── */
  buttons.forEach(btn => {
    btn.onclick = () => {
      const name = btn.dataset.bg;
      const effective = (name === 'aurora' && Storage.getAuroraSnow()) ?
        'aurora-winter' : name;
      
      document.body.dataset.bg = effective;
      Storage.setBackground(effective);
      
      buttons.forEach(b => {
        const isActive = (b.dataset.bg === effective) ||
          (b.dataset.bg === 'aurora' && effective === 'aurora-winter');
        b.classList.toggle('active', isActive);
      });
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

  /* ─── Китайский триггер ─── */
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

  /* ─── Промокоды ─── */
  function renderPromo(){
    const promoBtn = document.getElementById('promoBtn');
    const promoModal = document.getElementById('promoModal');
    const promoInput = document.getElementById('promoInput');
    const promoSubmit = document.getElementById('promoSubmit');
    const promoClose = document.getElementById('promoClose');
    const promoResult = document.getElementById('promoResult');

    if (!promoBtn || !promoModal) return;

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

    if (promoClose){
      promoClose.onclick = () => {
        promoModal.classList.add('hidden');
      };
    }

    function showPromoResult(text, type){
      if (!promoResult) return;
      promoResult.textContent = text;
      promoResult.className = 'promo-result ' + (type === 'success' ? 'success' : 'error');
      promoResult.classList.remove('hidden');
    }

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

      Storage.setCoins(data.new_balance || (Storage.getCoins() + data.coins_added));
      Sync.updateCoinsUI();
      if (typeof Shop !== 'undefined' && Shop.updateCoins) Shop.updateCoins();

      showPromoResult('✅ Получено: 🪙 +' + data.coins_added + ' монет!', 'success');
      if (promoInput) promoInput.value = '';
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

  /* ─── Обратная связь ─── */
  const FEEDBACK_COOLDOWN = 4 * 60 * 60 * 1000;
  const FEEDBACK_KEY = 'tir_feedback_lastSent';

  function getFeedbackCooldownLeft(){
    const lastSent = parseInt(localStorage.getItem(FEEDBACK_KEY) || '0', 10);
    if (!lastSent) return 0;
    const passed = Date.now() - lastSent;
    return Math.max(0, FEEDBACK_COOLDOWN - passed);
  }

  function formatCooldown(ms){
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return h + 'ч ' + m + 'м';
    return m + ' мин';
  }

  function refreshFeedbackBtn(){
    const btn = document.getElementById('feedbackBtn');
    if (!btn) return;

    const left = getFeedbackCooldownLeft();
    if (left > 0){
      btn.classList.add('disabled');
      btn.textContent = '💬 ОБРАТНАЯ СВЯЗЬ · ' + formatCooldown(left);
      btn.disabled = true;
    } else {
      btn.classList.remove('disabled');
      btn.textContent = '💬 ОБРАТНАЯ СВЯЗЬ';
      btn.disabled = false;
    }
  }

  function renderFeedback(){
    const feedbackBtn    = document.getElementById('feedbackBtn');
    const feedbackModal  = document.getElementById('feedbackModal');
    const feedbackInput  = document.getElementById('feedbackInput');
    const feedbackCount  = document.getElementById('feedbackCount');
    const feedbackSubmit = document.getElementById('feedbackSubmit');
    const feedbackClose  = document.getElementById('feedbackClose');
    const feedbackResult = document.getElementById('feedbackResult');

    if (!feedbackBtn || !feedbackModal) return;

    refreshFeedbackBtn();
    setInterval(refreshFeedbackBtn, 60000);

    feedbackBtn.onclick = () => {
      if (feedbackBtn.disabled) return;

      feedbackModal.classList.remove('hidden');
      if (feedbackInput){
        feedbackInput.value = '';
        feedbackInput.focus();
      }
      if (feedbackCount) feedbackCount.textContent = '0';
      if (feedbackResult){
        feedbackResult.classList.add('hidden');
        feedbackResult.textContent = '';
        feedbackResult.className = 'feedback-result hidden';
      }
    };

    if (feedbackInput && feedbackCount){
      feedbackInput.addEventListener('input', () => {
        feedbackCount.textContent = feedbackInput.value.length;
      });
    }

    if (feedbackClose){
      feedbackClose.onclick = () => {
        feedbackModal.classList.add('hidden');
      };
    }

    function showResult(text, type){
      if (!feedbackResult) return;
      feedbackResult.textContent = text;
      feedbackResult.className = 'feedback-result ' + type;
      feedbackResult.classList.remove('hidden');
    }

    async function submitFeedback(){
      if (!feedbackInput || !feedbackResult) return;

      const text = feedbackInput.value.trim();

      if (text.length < 5){
        showResult('Слишком коротко. Опиши подробнее.', 'error');
        return;
      }
      if (text.length > 2000){
        showResult('Слишком длинно. Максимум 2000 символов.', 'error');
        return;
      }

      if (!API.isTelegramReady()){
        showResult('Открой игру через Telegram-бота.', 'error');
        return;
      }

      if (feedbackSubmit){
        feedbackSubmit.disabled = true;
        feedbackSubmit.textContent = '⏳ ОТПРАВКА...';
      }

      const data = await API.sendFeedback(text);

      if (feedbackSubmit){
        feedbackSubmit.disabled = false;
        feedbackSubmit.textContent = 'ОТПРАВИТЬ';
      }

      if (data && data.ok){
        localStorage.setItem(FEEDBACK_KEY, String(Date.now()));
        refreshFeedbackBtn();
        showResult('✅ Спасибо! Мы получили твоё сообщение.', 'success');
        setTimeout(() => {
          feedbackModal.classList.add('hidden');
        }, 2000);
      } else {
        showResult('❌ Ошибка отправки. Попробуй позже.', 'error');
      }
    }

    if (feedbackSubmit){
      feedbackSubmit.onclick = submitFeedback;
    }
  }

  /* ─── INIT ─── */
  function init(){
    renderVolume();
    renderBackgrounds();
    renderEasterEgg();
    renderChinaTrigger();
    renderPromo();
    renderFeedback();
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