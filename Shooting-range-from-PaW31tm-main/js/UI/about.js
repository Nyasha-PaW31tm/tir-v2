/* ═══════════════════════════════════════════════════════════════
   ABOUT — экран «Об игре»
   BETA 0.9.5
   ═══════════════════════════════════════════════════════════════ */

const About = (() => {

  const VERSION = 'BETA 0.9.5';

  const CONTENT = `
    <h3>🎉 ОБНОВЛЕНИЕ</h3>

    <h4 class="changelog-sub">🐞 Исправлено</h4>
    <ul>
      <li>Фриз при окончании забега — экран больше не ждёт сервер</li>
      <li>Забеги снова уходят в рейтинг, монеты начисляются</li>
      <li>Убран античит-лимит на очки и комбо</li>
      <li>Версия в интерфейсе: 0.9.2 → <b>0.9.5</b></li>
    </ul>

    <h4 class="changelog-sub">🎨 Новое</h4>
    <ul>
      <li>⏸ <b>Меню паузы</b></li>
      <li>🌌 <b>Северное сияние</b> — новый фон</li>
      <li>🌃 <b>Ночной город</b> — новый фон</li>
      <li>📊 <b>Счётчик FPS</b> для отладки</li>
    </ul>

    <h4 class="changelog-sub">🛒 Магазин</h4>
    <ul>
      <li>Ребаланс цен на фоны</li>
    </ul>

    <div class="changelog-more">
      <h4 class="changelog-sub">⚙️ Прочие изменения</h4>
      <button id="changelogToggle" class="changelog-toggle">Детальнее... ▼</button>

      <div id="changelogDetails" class="changelog-details hidden">

        <h5 class="changelog-mini">💰 Ребаланс</h5>
        <ul>
          <li>Закат: <b class="old">120</b> >>> <b class="new">222</b> <span class="nerf">↓</span></li>
          <li>Космос: <b class="old">225</b> >>> <b class="new">150</b> <span class="buff">↑</span></li>
        </ul>

        <h5 class="changelog-mini">🚀 Оптимизация</h5>
        <ul>
          <li>Убран <b>drop-shadow</b> у скинов оружия</li>
          <li>Фоны на GPU-анимациях</li>
          <li>Пул частиц для дыма и гильз</li>
        </ul>

        <h5 class="changelog-mini">🖥 Сервер</h5>
        <ul>
          <li>Прогрессивная шкала монет (до ×3 при 500k+)</li>
          <li>Очередь отправки забегов при сбое связи</li>
        </ul>

      </div>
    </div>
  `;

  const CREDITS = `
    <h3>👤 СОЗДАТЕЛИ</h3>
    <ul>
      <li><b>DeepSeek</b> — архитектура, сервер, дизайн</li>
      <li><b>ChatGPT</b> — первоначальная версия (BETA 0.3)</li>
      <li><b>Hen_Nyasha</b> — идея, баланс, тесты —
        <a href="https://t.me/Hen_Nyasha" target="_blank">t.me/Hen_Nyasha</a></li>
    </ul>
  `;

  function bindToggle(){
    const btn = document.getElementById('changelogToggle');
    const details = document.getElementById('changelogDetails');
    if (!btn || !details) return;

    btn.onclick = () => {
      const isOpen = !details.classList.contains('hidden');
      if (isOpen){
        details.classList.add('hidden');
        btn.textContent = 'Детальнее... ▼';
      } else {
        details.classList.remove('hidden');
        btn.textContent = 'Свернуть ▲';
      }
    };
  }

  function render(){
    const card = document.querySelector('#screenAbout .menu-card');
    if (!card) return;

    card.innerHTML = `
      <div style="text-align:center">
        <span class="version-tag">${VERSION}</span>
      </div>
      <h1>О игре</h1>
      <p class="beta">Тир / Стрельбище</p>
      <p style="text-align:center">
        Браузерная игра для Telegram — на чистом HTML / CSS / JavaScript
      </p>
      ${CONTENT}
      ${CREDITS}
      <button id="backFromAbout" class="secondary" style="margin-top:20px;width:100%">← НАЗАД</button>
    `;

    bindToggle();

    const backBtn = document.getElementById('backFromAbout');
    if (backBtn && typeof Menu !== 'undefined' && Menu.showMain){
      backBtn.onclick = () => Menu.showMain();
    }
  }

  function init(){
    render();
  }

  return { init, render };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => About.init());
} else {
  About.init();
}