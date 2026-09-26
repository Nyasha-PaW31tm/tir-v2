/* ═══════════════════════════════════════════════════════════════
   ABOUT — экран «Об игре»
   BETA 0.10.0
   ═══════════════════════════════════════════════════════════════ */

const About = (() => {

  const VERSION = 'BETA 0.10.0';

  const CONTENT = `
    <h3>🎉 МАЖОРНОЕ ОБНОВЛЕНИЕ</h3>

    <h4 class="changelog-sub">🐞 Исправлено</h4>
    <ul>
      <li>Меню больше не «ездит» при зажатии</li>
      <li>Длинные названия в магазине видны полностью</li>
    </ul>

    <h4 class="changelog-sub">🎨 Новое</h4>
    <ul>
      <li>⚡ <b>Ульта «Лазер»</b> — прожигает все линии</li>
      <li>🎁 <b>Рулетка редкостей</b> — 6 уровней призов</li>
      <li>🌌 <b>Новое меню</b> — экран подготовки к забегу</li>
      <li>❄ <b>Снег в Авроре</b> — теперь крест-накрест</li>
    </ul>

    <h4 class="changelog-sub">🛒 Магазин</h4>
    <ul>
      <li>Ульты, ребаланс цен, тумблер снега</li>
    </ul>

    <div class="changelog-more">
      <h4 class="changelog-sub">⚙️ Прочие изменения</h4>
      <button id="changelogToggle" class="changelog-toggle">Детальнее... ▼</button>

      <div id="changelogDetails" class="changelog-details hidden">

        <h5 class="changelog-mini">⚡ Ультимейты</h5>
        <ul>
          <li>Лазер: <b class="new">6000</b> монет или рекорд <b class="new">210 000</b></li>
          <li>МЛРС: <b class="new">12 333</b> монеты (только покупка)</li>
          <li>Накопление ULT: <b class="old">5</b> >>> <b class="new">15</b> попаданий</li>
          <li>КД лазера: <b class="new">20 сек</b></li>
        </ul>

        <h5 class="changelog-mini">🎁 Рулетка</h5>
        <ul>
          <li>Обычный (50%) · Необычный (25%) · Редкий (15%)</li>
          <li>Эпический (8%) · Легендарный (1.5%) · Мифический (0.5%)</li>
          <li>Чем выше редкость — тем больше эффектов</li>
        </ul>

        <h5 class="changelog-mini">💰 Ребаланс</h5>
        <ul>
          <li>Лазер комбо: <b class="old">×0.2</b> >>> <b class="new">×0.15</b> <span class="nerf">↓</span></li>
          <li>Лазер очки: <b class="old">×2</b> >>> <b class="new">×1.5</b> <span class="nerf">↓</span></li>
          <li>ULT не копится во время КД лазера <span class="nerf">↓</span></li>
        </ul>

        <h5 class="changelog-mini">🎨 Меню</h5>
        <ul>
          <li>Главное меню — 7 кнопок вместо портянки</li>
          <li>Экран подготовки: режим, лазер, ульта, боссы, ежедневка</li>
          <li>Кнопки боссов и ежедневок — заглушки под 0.11</li>
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