/* ═══════════════════════════════════════════════════════════════
   ABOUT — экран «Об игре»
   BETA 0.11.0
   ═══════════════════════════════════════════════════════════════ */

const About = (() => {

  const VERSION = 'BETA 0.11.0';

  const CONTENT = `
    <h3>🎉 МАЖОРНОЕ ОБНОВЛЕНИЕ</h3>

    <h4 class="changelog-sub">🔫 Новое оружие</h4>
    <ul>
      <li>💥 <b>Дробовик</b> — двойной залп, 10 дробинок в разброс. Цена: <b>1500</b> 🪙</li>
      <li>Оружие теперь модульное — у каждого своя механика</li>
    </ul>

    <h4 class="changelog-sub">🎃 Ивент «Хэллоуин»</h4>
    <ul>
      <li>🌌 <b>Фон</b> — луна, летучие мыши, туман. Украшает меню</li>
      <li>🎯 <b>Мишени</b> — Тыквы, Скелеты, Призраки, Ведьмы, Дракула</li>
      <li>💀 <b>Скин ружья</b> — костяное, с оранжевым свечением</li>
      <li>🍬 <b>Рамка профиля</b> — падающие тыквы и конфеты</li>
      <li>До <b>5 ноября 2026</b>. После — товары исчезнут из магазина</li>
    </ul>

    <h4 class="changelog-sub">👤 Профиль</h4>
    <ul>
      <li>Экран профиля с метриками: рейтинг, монеты, рекорд, комбо, рулетка</li>
      <li>Пикер аватарок — <b>9 штук</b></li>
      <li>Пикер фонов профиля и рамок</li>
    </ul>

    <h4 class="changelog-sub">🎨 Рамки профиля</h4>
    <ul>
      <li>🥈 Серебро / 🥇 Золото — полированный металл с обегающим бликом</li>
      <li>🔥 Огонь — языки пламени и угольки</li>
      <li>❄ Лёд — кристаллы и пар</li>
      <li>🌈 Радуга — крутящееся радужное кольцо</li>
      <li>🎃 Хэллоуин — ивент-рамка за 169 🪙</li>
    </ul>

    <h4 class="changelog-sub">🏆 Достижения</h4>
    <ul>
      <li>Экран достижений — каталог 30 штук, фильтр по категориям</li>
      <li>Кнопка «Забрать» — награды монетами и 💎</li>
    </ul>

    <h4 class="changelog-sub">📅 Ежедневки</h4>
    <ul>
      <li>Экран ежедневных заданий — в разработке</li>
    </ul>

    <div class="changelog-more">
      <h4 class="changelog-sub">⚙️ Прочие изменения</h4>
      <button id="changelogToggle" class="changelog-toggle">Детальнее... ▼</button>

      <div id="changelogDetails" class="changelog-details hidden">

        <h5 class="changelog-mini">⚡ Ультимейты</h5>
        <ul>
          <li>🚀 <b>МЛРС разблокирован</b> — катсцена, 8 ракет, ×1.7 очков</li>
          <li>🎯 Лазер — прожигает 3 линии, ×1.5 очков</li>
        </ul>

        <h5 class="changelog-mini">🎬 Катсцены</h5>
        <ul>
          <li>Тумблер «Пропускать катсцены» — в настройках и паузе</li>
          <li>Синхронизирован</li>
        </ul>

        <h5 class="changelog-mini">🖱 Управление</h5>
        <ul>
          <li>Мультитач — крутить ствол и стрелять одновременно</li>
          <li>ПК-управление: мышь крутит ствол, Space = выстрел, E = ульта</li>
        </ul>

        <h5 class="changelog-mini">🔊 Звук</h5>
        <ul>
          <li>Разблокировка аудио при первом тапе</li>
          <li>Уникальные звуки: 🎃 тыква, 💀 кость (только в ивенте)</li>
          <li>Fallback — если звука нет, играет стандартный</li>
        </ul>

        <h5 class="changelog-mini">🐞 Исправлено</h5>
        <ul>
          <li>Ружьё поворачивалось под неправильным углом при ульте</li>
          <li>Оверлеи больше не «ездят» влево-вправо</li>
          <li>Кнопки в списках больше не растягиваются</li>
        </ul>

        <h5 class="changelog-mini">🔒 Скрыто до 0.12.0</h5>
        <ul>
          <li>Рамка Рамиила — появится с боссом</li>
          <li>Испытание SCP</li>
          <li>HP-система для боссов</li>
        </ul>

      </div>
    </div>
  `;

  const CREDITS = `
    <h3>👤 СОЗДАТЕЛИ</h3>
    <ul>
      <li><b>Hen_Nyasha</b> — идея, баланс, дизайн, тесты —
        <a href="https://t.me/Hen_Nyasha" target="_blank">t.me/Hen_Nyasha</a></li>
      <li><b>Claude</b> — скины, SVG-графика, тонкая CSS-работа</li>
      <li><b>DeepSeek</b> — архитектура, сервер, игровая логика</li>
      <li><b>ChatGPT</b> — первоначальная версия (BETA 0.3) и отдельные концепты</li>
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