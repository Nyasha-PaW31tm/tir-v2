/* ═══════════════════════════════════════════════════════════════
   ABOUT — экран "Об игре"
   Заполняет содержимое динамически
   ═══════════════════════════════════════════════════════════════ */

const About = (() => {

  const VERSION = 'BETA 0.9.4';

  const CONTENT = `
    <h3>🎉 ОБНОВЛЕНИЕ</h3>

    <h4 class="changelog-sub">🐞 Исправлено</h4>
    <ul>
      <li>Манёвренные мишени теперь корректно прыгают между рядами</li>
      <li>Починены три линии мишеней</li>
      <li>Устранён баг с двойными пулями</li>
      <li>Ульта завершает анимацию корректно</li>
    </ul>

    <h4 class="changelog-sub">🎨 Новое</h4>
    <ul>
      <li>🔫 <b>AKC-74M</b> — полноценное оружие с очередью из 3 пуль</li>
      <li>⭐ <b>Звезда</b>, 💠 <b>Неон</b> — скины оружия</li>
      <li>🎯 <b>Неоновые мишени</b></li>
      <li>🌅 <b>Закат</b>, 🌌 <b>Космос</b></li>
      <li>🔊 Добавлены новые звуки</li>
    </ul>

    <h4 class="changelog-sub">🛒 Магазин</h4>
    <ul>
      <li>Обновлён: 4 категории, превью товаров, скидки</li>
    </ul>

    <h4 class="changelog-sub">🥚 Пасхалки</h4>
    <ul>
      <li>Добавлена <b>1 новая пасхалка</b> — найди её сам</li>
    </ul>

    <div class="changelog-more">
      <h4 class="changelog-sub">⚙️ Прочие изменения</h4>
      <button id="changelogToggle" class="changelog-toggle">Детальнее... ▼</button>

      <div id="changelogDetails" class="changelog-details hidden">

        <h5 class="changelog-mini">💰 Ребаланс</h5>
        <ul>
          <li>Закат: <b class="old">80</b> >>> <b class="new">120</b> <span class="nerf">↓</span></li>
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