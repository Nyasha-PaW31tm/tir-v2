/* ═══════════════════════════════════════════════════════════════
   ABOUT — экран "Об игре"
   Заполняет содержимое динамически
   ═══════════════════════════════════════════════════════════════ */

const About = (() => {

  const VERSION = 'BETA 0.9';

  const CHANGELOG = `
    <h3>✨ НОВОЕ В 0.9</h3>
    <ul>
      <li>♾ <b>Бесконечный режим</b> — открывается после первой победы</li>
      <li>🪙 <b>Монеты</b> — 1 за каждые 250 очков</li>
      <li>🛒 <b>Магазин</b> с категориями: оружие, фоны, мишени</li>
      <li>🎨 <b>Скины оружия</b>: Неон, Звезда и другие</li>
      <li>📊 <b>Синхронизация</b> — прогресс сохраняется на сервере</li>
      <li>🎯 Штраф лазера — <b>−35%</b></li>
      <li>📈 Прогрессивная сложность в бесконечном режиме</li>
    </ul>

    <h3>🛠 РАНЕЕ</h3>
    <ul>
      <li>Общий рейтинг, история забегов</li>
      <li>Стикерпак в личку за победу</li>
      <li>Спецэффекты: осколки мишеней, золотые комбо</li>
      <li>Звуки, 4 фона, пасхалка 🥚</li>
    </ul>

    <h3>👤 СОЗДАТЕЛИ</h3>
    <ul>
      <li><b>DeepSeek</b> — архитектура, сервер, дизайн</li>
      <li><b>Hen_Nyasha</b> — идея, баланс, тесты</li>
    </ul>

    <p style="text-align:center;color:#8893a3;font-size:12px;margin-top:20px">
      Сделано с душой 🎯
    </p>
  `;

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
      ${CHANGELOG}
      <button id="backFromAbout" class="secondary" style="margin-top:20px;width:100%">← НАЗАД</button>
    `;

    // Перепривязываем кнопку "Назад" (она пересоздана)
    const backBtn = document.getElementById('backFromAbout');
    if (backBtn && typeof Menu !== 'undefined' && Menu.showMain){
      backBtn.onclick = () => Menu.showMain();
    }
  }

  function init(){
    // Рендерим один раз при старте
    render();
  }

  return { init, render };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => About.init());
} else {
  About.init();
}