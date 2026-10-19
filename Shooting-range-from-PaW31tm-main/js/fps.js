/* ═══════════════════════════════════════════════════════════════
   FPS — счётчик кадров для отладки
   BETA 0.9.5
   Показывает реальный FPS раз в секунду. Включается в настройках
   и в меню паузы. По умолчанию выключен.
   ═══════════════════════════════════════════════════════════════ */

const FPS = (() => {

  let enabled = false;
  let el = null;
  let frames = 0;
  let lastUpdate = 0;
  let raf = null;

  function createEl(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'fpsCounter';
    el.className = 'fps-counter hidden';
    el.textContent = '0 FPS';
    document.body.appendChild(el);
    return el;
  }

  function tick(now){
    if (!enabled) return;
    frames++;

    if (now - lastUpdate >= 1000){
      const fps = Math.round(frames * 1000 / (now - lastUpdate));

      if (el){
        el.textContent = fps + ' FPS';

        // цвет по уровню FPS
        if (fps >= 55)      el.style.color = '#4ade80';   // зелёный
        else if (fps >= 40) el.style.color = '#ffd23c';   // жёлтый
        else if (fps >= 25) el.style.color = '#ff8c42';   // оранжевый
        else                el.style.color = '#ff3a3a';   // красный
      }

      frames = 0;
      lastUpdate = now;
    }

    raf = requestAnimationFrame(tick);
  }

  function enable(){
    enabled = true;
    Storage.setFpsEnabled(true);

    createEl();
    el.classList.remove('hidden');

    frames = 0;
    lastUpdate = performance.now();

    if (!raf) raf = requestAnimationFrame(tick);
    updateButtons();
  }

  function disable(){
    enabled = false;
    Storage.setFpsEnabled(false);

    if (el) el.classList.add('hidden');
    if (raf){ cancelAnimationFrame(raf); raf = null; }
    updateButtons();
  }

  function toggle(){
    if (enabled) disable(); else enable();
  }

  function updateButtons(){
    document.querySelectorAll('[data-fps-toggle]').forEach(b => {
      b.textContent = enabled ? 'ВКЛ' : 'ВЫКЛ';
      b.classList.toggle('on', enabled);
      b.classList.toggle('off', !enabled);
    });
  }

  function init(){
    // восстанавливаем состояние из настроек
    if (Storage.isFpsEnabled()) enable();
    else updateButtons();

    // кнопки-переключатели
    document.querySelectorAll('[data-fps-toggle]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      });
    });
  }

  return { init, enable, disable, toggle };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => FPS.init());
} else {
  FPS.init();
}