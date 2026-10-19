/* ═══════════════════════════════════════════════════════════════
   ULT.LASER — ульта «Лазер»
   Непрерывный луч, 4 секунды. Прожигает всё по линии прицела.
   Очки ×2, шаг комбо ×0.2. Промах НЕ сбивает комбо.
   ═══════════════════════════════════════════════════════════════ */

const GameLaser = (() => {

  const DURATION_MS  = 4000;   // 4 секунды
  const TICK_MS      = 60;     // частота проверки попаданий
  const REHIT_MS     = 300;    // перезаряд на одну мишень
  const BEAM_WIDTH   = 25;     // толщина луча в px
  const COOLDOWN_MS = 20000;   // 20 сек после окончания
  

  let active = false;
  let cooldownUntil = 0;   // время, до которого ульта заблокирована
  let endTimer = null;
  let tickTimer = null;
  let beamEl = null;
  const hitTimes = new Map();     // id мишени → время последнего удара

  /* ─── Проверка попадания мишени в луч ─── */
  function isInBeam(target, geom){
    const ax = geom.mx, ay = geom.my;
    const bx = geom.tx, by = geom.ty;

    const rr = document.getElementById('range').getBoundingClientRect();
    const r = target.el.getBoundingClientRect();
    const px = r.left + r.width / 2 - rr.left;
    const py = r.top + r.height / 2 - rr.top;

    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return false;

    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const nx = ax + t * dx;
    const ny = ay + t * dy;

    const dist = Math.hypot(px - nx, py - ny);
    const radius = Math.max(r.width, r.height) / 2;

    return dist <= radius + BEAM_WIDTH / 2;
  }

  /* ─── Обновить позицию луча на экране ─── */
  function updateBeam(geom){
    if (!beamEl) return;

    const dx = geom.tx - geom.mx;
    const dy = geom.ty - geom.my;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    beamEl.style.left = geom.mx + 'px';
    beamEl.style.top  = (geom.my - BEAM_WIDTH / 2) + 'px';
    beamEl.style.width = len + 'px';
    beamEl.style.transform = 'rotate(' + angle + 'deg)';
  }

  /* ─── Один тик ─── */
  function tick(){
    if (!active) return;

    const I = (typeof Game !== 'undefined' && Game._internals) || null;
    if (!I) return;

    const geom = I.getAimGeom();
    updateBeam(geom);

    const targets = I.getTargets();
    const now = performance.now();

    for (const t of targets){
      if (!t.el || !t.el.parentNode) continue;

      if (isInBeam(t, geom)){
        const last = hitTimes.get(t.id) || 0;
        if (now - last >= REHIT_MS){
          hitTimes.set(t.id, now);
          I.hitTargetLaser(t);
        }
      }
    }
  }

  /* ─── Создать/удалить DOM луча ─── */
  function createBeam(){
    removeBeam();
    const range = document.getElementById('range');
    if (!range) return;

    beamEl = document.createElement('div');
    beamEl.id = 'laserBeam';
    range.appendChild(beamEl);
  }

  function removeBeam(){
    if (beamEl && beamEl.parentNode){
      beamEl.parentNode.removeChild(beamEl);
    }
    beamEl = null;
  }

  /* ─── Запуск ульты ─── */
  function fire(){
  if (active) return;
  if (performance.now() < cooldownUntil){
    console.log('[ult.laser] on cooldown');
    return;
  }
    const I = (typeof Game !== 'undefined' && Game._internals) || null;
    if (!I) return;

    const game = I.getGame();
    if (!game) return;

    active = true;
    window._laserActive = true;
    hitTimes.clear();

    createBeam();

    // Тик каждые 60 мс
    tickTimer = setInterval(tick, TICK_MS);

    // Первый тик сразу
    tick();

    // Окончание через 4 сек
    endTimer = setTimeout(() => {
      stop();
    }, DURATION_MS);

    console.log('[ult.laser] fired');
  }

  /* ─── Остановка ─── */
  function stop(){
    if (!active) return;
    active = false;
    window._laserActive = false;

    if (tickTimer){ clearInterval(tickTimer); tickTimer = null; }
    if (endTimer){ clearTimeout(endTimer); endTimer = null; }

    removeBeam();
    hitTimes.clear();

    console.log('[ult.laser] stopped');
    cooldownUntil = performance.now() + COOLDOWN_MS;
console.log('[ult.laser] cooldown started: 6s');
  }

  /* ─── Экспорт ─── */
    function getCooldownLeft(){
    const left = cooldownUntil - performance.now();
    return left > 0 ? left : 0;
  }

  const api = {
    fire,
    stop,
    isActive: () => active,
    isOnCooldown: () => performance.now() < cooldownUntil,
    getCooldownLeft
  };

  window.GameLaser = api;

  console.log('[ult.laser] loaded');

  return api;
})();