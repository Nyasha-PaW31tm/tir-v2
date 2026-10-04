/* ═══════════════════════════════════════════════════════════════
   ULT.MLRS — ульта «МЛРС»
   3 сек подготовка → 5 сек залп 8 ракет → восстановление
   Очки ×1.7, кап 22 мишени, спавн ×2.2
   ═══════════════════════════════════════════════════════════════ */

const GameMLRS = (() => {

  const ROCKETS_COUNT     = 8;
  const INTERVAL_MS       = 625;
  const EXPLOSION_RADIUS  = 130;
  const COOLDOWN_MS       = 50000;
  const PREPARATION_MS    = 3000;

  let active = false;
  let cooldownUntil = 0;
  let rocketsLeft = 0;
  let intervalId = null;
  let extraSpawnId = null;

  /* ─── Выбор цели для ракеты ─── */
  function pickTarget(used){
    const I = (typeof Game !== 'undefined' && Game._internals) || null;
    if (!I) return null;

    const targets = I.getTargets();
    if (!targets.length) return null;

    const available = targets.filter(t => !used.has(t.id));
    if (!available.length) return null;

    const priority = { fastgold: 5, gold: 4, armored: 3, maneuver: 2, fast: 1, normal: 0 };
    available.sort((a,b) => (priority[b.type]||0) - (priority[a.type]||0));
    return available[0];
  }

  /* ─── Запуск одной ракеты ─── */
  function launchRocket(usedTargets){
    const I = (typeof Game !== 'undefined' && Game._internals) || null;
    if (!I) return;

    const range = document.getElementById('range');
    if (!range) return;

    const rr = range.getBoundingClientRect();

    let targetX, targetY;
    const target = pickTarget(usedTargets);

    if (target && Math.random() < 0.7){
      const c = I.getElCenter(target.el);
      targetX = c.x;
      targetY = c.y;
      usedTargets.add(target.id);
    } else {
      targetX = 40 + Math.random() * (rr.width - 80);
      targetY = 40 + Math.random() * (rr.height * 0.7);
    }

    const startX = rr.width / 2 + (Math.random() - 0.5) * 80;
    const startY = rr.height - 60;

    const rocket = document.createElement('div');
    rocket.className = 'mlrs-rocket';
    rocket.style.left = startX + 'px';
    rocket.style.top  = startY + 'px';
    rocket.style.setProperty('--dx', (targetX - startX) + 'px');
    rocket.style.setProperty('--dy', (targetY - startY) + 'px');

    range.appendChild(rocket);

    const FLY_MS = 600;
    setTimeout(() => {
      rocket.remove();
      explode(targetX, targetY);
    }, FLY_MS);
  }

  /* ─── Взрыв ─── */
function explode(x, y){
  const I = (typeof Game !== 'undefined' && Game._internals) || null;
  if (!I) return;

  const range = document.getElementById('range');
  if (!range) return;

  /* Звук прилёта */
  try {
    const s = new Audio('sounds/projectile_arrival.mp3');
    s.volume = 0.7;
    s.play().catch(() => {});
  } catch(e){}

  /* Визуал взрыва */
  const boom = document.createElement('div');
  boom.className = 'mlrs-explosion';
  boom.style.left = x + 'px';
  boom.style.top  = y + 'px';
  range.appendChild(boom);
  setTimeout(() => boom.remove(), 700);

  /* ★ ОСКОЛКИ С УРОНОМ — наводятся на мишени в радиусе */
  const targetsInRange = [];
  for (const t of I.getTargets()){
    if (!t.el || !t.el.parentNode) continue;
    const c = I.getElCenter(t.el);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d <= EXPLOSION_RADIUS){
      targetsInRange.push({ t, c, d });
    }
  }

  /* Каждая мишень в радиусе получает ВАНШОТ от взрыва */
  for (const item of targetsInRange){
    if (item.t.el && item.t.el.parentNode){
      I.hitTargetMLRS(item.t);
    }
  }

  /* Дополнительные осколки — визуал + урон по ближайшим */
  const shardsCount = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < shardsCount; i++){
    spawnShard(x, y, I);
  }
}

/* ─── Осколок с полётом и уроном ─── */
function spawnShard(x, y, I){
  const range = document.getElementById('range');
  if (!range) return;

  /* Выбираем цель — случайная мишень поблизости, либо случайное направление */
  const targets = I.getTargets().filter(t => t.el && t.el.parentNode);
  let targetX, targetY, target = null;

  if (targets.length && Math.random() < 0.85){
    target = targets[Math.floor(Math.random() * targets.length)];
    const c = I.getElCenter(target.el);
    targetX = c.x;
    targetY = c.y;
  } else {
    const ang = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 100;
    targetX = x + Math.cos(ang) * dist;
    targetY = y + Math.sin(ang) * dist;
  }

  const shard = document.createElement('div');
  shard.className = 'mlrs-shard';
  shard.style.left = x + 'px';
  shard.style.top  = y + 'px';
  shard.style.setProperty('--dx', (targetX - x) + 'px');
  shard.style.setProperty('--dy', (targetY - y) + 'px');
  range.appendChild(shard);

  /* Через 350мс — попадание в цель */
  setTimeout(() => {
    shard.remove();

    /* Если цель жива — наносим урон */
    if (target && target.el && target.el.parentNode){
      const c = I.getElCenter(target.el);
      const d = Math.hypot(c.x - targetX, c.y - targetY);
      if (d < 30){
        I.hitTargetMLRS(target);
      }
    }
  }, 350);
}

  /* ─── Фаза A: подготовка ─── */
  function preparation(){
    return new Promise(resolve => {
      window._mlrsActive = true;
      window._mlrsMaxTargets = 22;

      const msg = document.getElementById('message');
      if (msg){
        msg.textContent = '🚀 РАСЧЁТ...';
        msg.className = 'pop';
        setTimeout(() => { msg.textContent = ''; msg.className = ''; }, PREPARATION_MS);
      }

      /* Ускоренный спавн — доп. интервал */
      extraSpawnId = setInterval(() => {
        if (!window._mlrsActive) return;
        const I = (typeof Game !== 'undefined' && Game._internals) || null;
        if (I && I.spawn) I.spawn();
      }, 450);

      setTimeout(resolve, PREPARATION_MS);
    });
  }

  /* ─── Фаза B: залп ─── */
  function salvo(){
    return new Promise(resolve => {
      const usedTargets = new Set();
      rocketsLeft = ROCKETS_COUNT;

      intervalId = setInterval(() => {
        if (rocketsLeft <= 0){
          clearInterval(intervalId);
          intervalId = null;
          resolve();
          return;
        }
        rocketsLeft--;
        launchRocket(usedTargets);
      }, INTERVAL_MS);

      rocketsLeft--;
      launchRocket(usedTargets);
    });
  }

  /* ─── Фаза C: восстановление ─── */
  function cleanup(){
    window._mlrsActive = false;
    window._mlrsMaxTargets = 5;

    if (intervalId){ clearInterval(intervalId); intervalId = null; }
    if (extraSpawnId){ clearInterval(extraSpawnId); extraSpawnId = null; }

    active = false;
    cooldownUntil = performance.now() + COOLDOWN_MS;
  }

  /* ─── Запуск ульты ─── */
  async function fire(){
    if (active) return;
    if (performance.now() < cooldownUntil) return;

    active = true;

    /* Катсцена */
    if (typeof Game !== 'undefined' && Game.playCutscene){
      try { await Game.playCutscene(); } catch(e){ console.warn('[mlrs] cutscene failed:', e); }
    }

    /* Фаза A */
    await preparation();

    /* Фаза B */
    await salvo();

    /* Даём последним ракетам долететь */
    setTimeout(cleanup, 1500);
  }

  function isActive(){ return active; }
  function isOnCooldown(){ return performance.now() < cooldownUntil; }
  function getCooldownLeft(){ return Math.max(0, cooldownUntil - performance.now()); }

  return { fire, isActive, isOnCooldown, getCooldownLeft };
})();

window.GameMLRS = GameMLRS;
console.log('[ult.mlrs] loaded');