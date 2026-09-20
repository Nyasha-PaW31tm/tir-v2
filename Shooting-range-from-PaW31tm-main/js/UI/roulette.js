/* ═══════════════════════════════════════════════════════════════
   ROULETTE — ежедневная рулетка
   Лента через inline-block, прокрутка через offsetLeft + двойной RAF
   ═══════════════════════════════════════════════════════════════ */

const Roulette = (() => {

  let overlay = null;
  let spinAvailable = true;
  let nextSpinIn = 0;
  let spinning = false;
  let timerInterval = null;

  const PRIZE_VALUES = [10, 25, 50, 75, 100, 150, 200, 300, 500, 800, 1000];

  function rnd(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function rollLocalReward(){
    const r = Math.random() * 100;
    if (r < 50)    return 10  + Math.floor(Math.random() * 41);
    if (r < 75)    return 50  + Math.floor(Math.random() * 51);
    if (r < 90)    return 100 + Math.floor(Math.random() * 101);
    if (r < 98)    return 200 + Math.floor(Math.random() * 301);
    if (r < 99.5)  return 500 + Math.floor(Math.random() * 301);
    return 800 + Math.floor(Math.random() * 201);
  }

  function ensureOverlay(){
    const existing = document.getElementById('rouletteOverlay');
    if (existing) existing.remove();

    overlay = document.createElement('div');
    overlay.id = 'rouletteOverlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
      <div class="roulette-card">
        <h2>🎁 Ежедневная рулетка</h2>
        <p class="subtitle">Крути раз в 24 часа и получай монеты</p>

        <div class="roulette-strip-wrap" id="rouletteWrap">
          <div class="roulette-pointer">▼</div>
          <div class="roulette-strip" id="rouletteStrip"></div>
        </div>

        <div class="roulette-result" id="rouletteResult"></div>

        <button class="roulette-btn-spin" id="rouletteSpinBtn">КРУТИТЬ</button>
        <button class="roulette-btn-close" id="rouletteCloseBtn">ЗАКРЫТЬ</button>

        <div class="roulette-timer" id="rouletteTimer"></div>

        <div class="roulette-chances">
          <b>Шансы:</b><br>
          🪙 10–50 монет — 50%<br>
          🪙 50–100 монет — 25%<br>
          🪙 100–200 монет — 15%<br>
          🪙 200–500 монет — 8%<br>
          🪙 500–800 монет — 1.5%<br>
          💎 800–1000 монет — 0.5%
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('rouletteCloseBtn').onclick = close;
    document.getElementById('rouletteSpinBtn').onclick = spin;

    return overlay;
  }

  function fillStrip(targetReward){
    const strip = document.getElementById('rouletteStrip');
    if (!strip) return { targetCell: null };

    const TOTAL = 50;
    const TARGET_INDEX = 45;
    const cells = [];

    for (let i = 0; i < TOTAL; i++){
      if (i === TARGET_INDEX){
        cells.push({ value: targetReward, isTarget: true });
      } else {
        cells.push({ value: rnd(PRIZE_VALUES), isTarget: false });
      }
    }

strip.innerHTML = cells.map(c => `
  <div class="roulette-cell ${c.isTarget ? 'is-picked' : ''}">🪙 ${c.value}</div>
`).join('');

    return { targetCell: strip.children[TARGET_INDEX] };
  }

  /* ─── Прокрутка ─── */
  function animateStrip(targetCell){
    return new Promise(resolve => {
      const strip = document.getElementById('rouletteStrip');
      const wrap = document.getElementById('rouletteWrap');
      if (!strip || !wrap || !targetCell){
        console.error('[roulette] нет элементов');
        return resolve();
      }

      const CELL_WIDTH = 90;             // совпадает с CSS
      const TARGET_INDEX = 45;           // совпадает с fillStrip

      // ★ Считаем смещение явно, не полагаясь на offsetLeft
      const wrapWidth = wrap.clientWidth;
      const offset = (TARGET_INDEX * CELL_WIDTH) + (CELL_WIDTH / 2) - (wrapWidth / 2);

      console.log('[roulette] wrapWidth:', wrapWidth, 'CELL:', CELL_WIDTH, '→ offset:', offset);

      // ★ Сброс позиции
      strip.style.transition = 'none';
      strip.style.transform = 'translate3d(0, 0, 0)';

      // ★ Форсим reflow
      void strip.offsetHeight;

      // ★ Двойной RAF → гарантирует, что браузер увидел сброс
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          strip.style.transition = 'transform 4s cubic-bezier(.15,.85,.25,1)';
          strip.style.transform = `translate3d(-${offset}px, 0, 0)`;
          console.log('[roulette] поехали, transform:', strip.style.transform);
        });
      });

      setTimeout(resolve, 4300);
    });
  }

  function updateStatus(data){
    spinAvailable = !!data.spin_available;
    nextSpinIn = data.spin_next_in || 0;

    const btn = document.getElementById('rouletteSpinBtn');
    const timer = document.getElementById('rouletteTimer');

    if (!btn || !timer) return;

    if (spinAvailable){
      btn.disabled = false;
      btn.textContent = 'КРУТИТЬ';
      timer.textContent = '✨ Доступно прямо сейчас!';
    } else {
      btn.disabled = true;
      btn.textContent = '⏳ ЖДИ';
      startCountdown(nextSpinIn);
    }
  }

  function startCountdown(seconds){
    const timer = document.getElementById('rouletteTimer');
    if (!timer) return;

    clearInterval(timerInterval);
    let left = seconds;

    function tick(){
      if (left <= 0){
        clearInterval(timerInterval);
        timer.textContent = '✨ Доступно прямо сейчас!';
        const btn = document.getElementById('rouletteSpinBtn');
        if (btn){ btn.disabled = false; btn.textContent = 'КРУТИТЬ'; }
        spinAvailable = true;
        return;
      }
      const h = Math.floor(left / 3600);
      const m = Math.floor((left % 3600) / 60);
      const s = left % 60;
      timer.textContent = `⏳ Следующий спин через ${h}ч ${m}м ${s}с`;
      left--;
    }
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function open(data){
    ensureOverlay();
    overlay.classList.remove('hidden');

    fillStrip(rnd(PRIZE_VALUES));

    if (!API.isTelegramReady()){
      spinAvailable = true;
      const btn = document.getElementById('rouletteSpinBtn');
      if (btn){ btn.disabled = false; btn.textContent = 'КРУТИТЬ'; }
      const timer = document.getElementById('rouletteTimer');
      if (timer) timer.textContent = '📱 Preview-режим';
    } else if (data){
      updateStatus(data);
    }

    document.getElementById('rouletteResult').textContent = '';
  }

  function close(){
    if (overlay) overlay.classList.add('hidden');
    clearInterval(timerInterval);
  }

  async function spin(){
    if (spinning || !spinAvailable) return;
    spinning = true;

    const btn = document.getElementById('rouletteSpinBtn');
    const result = document.getElementById('rouletteResult');

    btn.disabled = true;
    btn.textContent = 'КРУТИМ...';
    result.innerHTML = '';

    let data;
    let preview = false;

    if (API.isTelegramReady()){
      data = await API.spin();
      if (!data.ok){
        if (data.error === 'cooldown'){
          nextSpinIn = data.next_in || 0;
          result.innerHTML = '<div style="color:#ffd23c">⏳ Рано ещё!</div>';
          spinAvailable = false;
          startCountdown(nextSpinIn);
          btn.textContent = '⏳ ЖДИ';
        } else {
          result.innerHTML = `<div style="color:#ff6b6b">❌ Ошибка: ${data.error || 'unknown'}</div>`;
          btn.disabled = false;
          btn.textContent = 'КРУТИТЬ';
        }
        spinning = false;
        return;
      }
    } else {
      const reward = rollLocalReward();
      data = {
        ok: true,
        reward: reward,
        total_coins: Storage.getCoins() + reward,
        next_spin_in: 86400
      };
      preview = true;
    }

    // Заполняем ленту
    const info = fillStrip(data.reward);

    // Даём браузеру отрисовать DOM
    await new Promise(r => setTimeout(r, 100));

    // Прокрутка
    await animateStrip(info.targetCell);

    // Результат
    if (preview){
      result.innerHTML = `
        <div class="roulette-reward">🪙 +${data.reward} монет</div>
        <div class="roulette-preview-note">
          📱 Получить можно только в Telegram
        </div>`;

      Storage.setCoins(data.total_coins);
      Sync.updateCoinsUI();
      if (typeof Shop !== 'undefined' && Shop.updateCoins) Shop.updateCoins();

      btn.disabled = false;
      btn.textContent = 'КРУТИТЬ';
    } else {
      result.innerHTML = `<div class="roulette-reward">🪙 +${data.reward} монет</div>`;

      Storage.setCoins(data.total_coins);
      Sync.updateCoinsUI();
      if (typeof Shop !== 'undefined' && Shop.updateCoins) Shop.updateCoins();

      spinAvailable = false;
      nextSpinIn = data.next_spin_in || 86400;
      startCountdown(nextSpinIn);
      btn.textContent = '⏳ ЖДИ';
    }

    spinning = false;
  }

  return { open, close, updateStatus };
})();