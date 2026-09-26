/* ═══════════════════════════════════════════════════════════════
   ТИР — BETA 0.10.0 — ядро игры
   ═══════════════════════════════════════════════════════════════ */

const Game = (() => {

  const WIN_SCORE = 10000;
  const MAX_MISSES = 8;
  const LASER_PENALTY = 0.65;
  const COINS_PER_POINTS = 250;
  const MAX_SHELLS = 12;

  /* ★ ULT_REQ зависит от активной ульты */
  const ULT_REQ_MAP = {
    classic: 5,
    laser:   15,
    MLRS:    20
  };

  function getUltReq(){
    const active = Storage.getActiveUlt();
    return ULT_REQ_MAP[active] || 5;
  }

  const TYPES = {
    normal:   {base: 25, hp:1, speed:  0, color:'normal'},
    fast:     {base: 55, hp:1, speed:150, color:'fast'},
    armored:  {base: 80, hp:2, speed:  0, color:'armored'},
    maneuver: {base:120, hp:1, speed: 70, color:'maneuver'},
    gold:     {base:200, hp:1, speed:  0, color:'gold'},
    fastgold: {base:350, hp:1, speed:160, color:'fastgold'}
  };

  /* ─── Состояние игры ─── */
  let game = false;
  let score = 0;
  let comboHits = 0;
  let ultHits = 0;
  let targets = [];
  let bullets = [];
  let nextId = 1;
  let spawnTimer = null;
  let raf = null;
  let aimX = 50;
  let aimY = 40;
  let laserEnabled = false;
  let prevComboFloor = 1;
  let missCount = 0;
  let personalBest = 0;
  let ultReadySoundPlayed = false;
  let sawTenCombo = false;

  /* ─── AKC-74M ─── */
  let isFiring = false;
  let totalShotCount = 0;
  let recentShotTimestamps = [];
  let smokeInterval = null;
  let coolDownCheck = null;

  /* ─── Прицеливание ульты ─── */
  let ultAiming = false;
  let ultAimTarget = null;

  let runStats = {
    shotCount: 0, ultCount: 0, maxComboMult: 1,
    startTime: 0, duration: 0, mode: 'normal', laser: false
  };

  /* ═══════════════════════════════════════════════════════════════
     ЗВУКИ
     ═══════════════════════════════════════════════════════════════ */
  const SFX = {
    shot: new Audio('sounds/fire.mp3'),
    shotAkc: [
      new Audio('sounds/akc_fire.mp3'),
      new Audio('sounds/akc_fire.mp3'),
      new Audio('sounds/akc_fire.mp3')
    ],
    hit: new Audio('sounds/armor.mp3'),
    ult: new Audio('sounds/series_of_shots.mp3'),
    ultReady: new Audio('sounds/ult.mp3'),
    win: new Audio('sounds/win.mp3'),
    miss: new Audio('sounds/miss.mp3')
  };

  let masterVolume = Storage.getVolume() / 100;
  let akcShotIndex = 0;

  function playSfx(name){
    const a = SFX[name];
    if (!a || masterVolume <= 0) return;

    try {
      if (Array.isArray(a)){
        const audio = a[akcShotIndex % a.length];
        akcShotIndex = (akcShotIndex + 1) % a.length;
        audio.currentTime = 0;
        audio.volume = masterVolume;
        audio.play().catch(() => {});
        return;
      }
      a.currentTime = 0;
      a.volume = masterVolume;
      a.play().catch(() => {});
    } catch(e){}
  }

  function setVolume(v){
    masterVolume = Math.max(0, Math.min(1, v));
  }

  /* ═══════════════════════════════════════════════════════════════
     DOM-ссылки
     ═══════════════════════════════════════════════════════════════ */
  let range, rifle, rifleWrap, flash, laser;
  let scoreEl, comboEl, ultEl, ultBtn, endScreen;
  let homeBtn, modeBadge, missesBlock, missesEl, scoreBox;

  function bindDom(){
    range       = document.getElementById('range');
    rifle       = document.getElementById('rifle');
    rifleWrap   = document.getElementById('rifleWrap');
    flash       = document.getElementById('muzzleFlash');
    laser       = document.getElementById('laser');
    scoreEl     = document.getElementById('score');
    comboEl     = document.getElementById('combo');
    ultEl       = document.getElementById('ult');
    ultBtn      = document.getElementById('ultimate');
    endScreen   = document.getElementById('endScreen');
    const pb = document.getElementById('pauseBtn');
    homeBtn = pb;
    modeBadge   = document.getElementById('modeBadge');
    missesBlock = document.getElementById('missesBlock');
    missesEl    = document.getElementById('misses');
    scoreBox    = document.querySelector('.score');
  }

  function isChinaActive(){
    return document.body.classList.contains('skin-china');
  }

  function isAkcActive(){
    return document.body.classList.contains('skin-akc74m');
  }

/* ═══════════════════════════════════════════════════════════════
   СТОП. ВСТАВЬ ЧАСТЬ 2 НИЖЕ
   ═══════════════════════════════════════════════════════════════ */
     /* ═══════════════════════════════════════════════════════════════
     СЛОЖНОСТЬ
     ═══════════════════════════════════════════════════════════════ */
  function difficulty(){
    if (Storage.isInfiniteMode()){
      const t = Math.min(1, score / 25000);
      return {
        normal:   0.40 - 0.39 * t,
        fast:     0.30 + 0.10 * t,
        maneuver: 0.15 + 0.13 * t,
        armored:  0.13 + 0.15 * t,
        gold:     0.015 + 0.005 * t,
        fastgold: 0.005 + 0.005 * t
      };
    }
    if (score <= 1750) return {normal:.40, fast:.35, maneuver:.15, armored:.09, gold:.008, fastgold:.002};
    const t = Math.min(1, (score - 1750) / 8250);
    return {normal:.40-.30*t, fast:.35+.11*t, maneuver:.15+.12*t, armored:.09+.07*t, gold:.008, fastgold:.002};
  }

  /* ★ Шаг комбо: 0.1 обычно, 0.15 во время лазера */
  function comboMult(stepOverride){
    const step = stepOverride || (window._laserActive ? 0.15 : 0.1);
    return 1 + Math.max(0, comboHits - 1) * step;
  }

  /* ═══════════════════════════════════════════════════════════════
     UI
     ═══════════════════════════════════════════════════════════════ */
  function updateUI(){
    scoreEl.textContent = Math.floor(score);
    comboEl.textContent = '×' + comboMult().toFixed(1);
    updateUltCounter();
    missesEl.textContent = missCount + '/' + MAX_MISSES;
    missesBlock.classList.toggle('hidden', !Storage.isInfiniteMode());

    if (comboMult() > runStats.maxComboMult) runStats.maxComboMult = comboMult();

    const isRecord = Storage.isInfiniteMode() && personalBest > 0 && score > personalBest;
    if (scoreBox) scoreBox.classList.toggle('gold-record', isRecord);
  }

  /* ★ Отдельная функция: показывает либо счётчик, либо КД лазера */
  function updateUltCounter(){
    if (!ultEl || !ultBtn) return;

    const activeUlt = Storage.getActiveUlt();

    /* Лазер активен прямо сейчас */
    if (activeUlt === 'laser' && window.GameLaser && window.GameLaser.isActive && window.GameLaser.isActive()){
      ultEl.textContent = '⚡ АКТИВЕН';
      ultBtn.classList.remove('ready');
      return;
    }

    /* Лазер на КД */
    if (activeUlt === 'laser' && window.GameLaser && window.GameLaser.isOnCooldown && window.GameLaser.isOnCooldown()){
      const left = window.GameLaser.getCooldownLeft();
      const sec = Math.ceil(left / 1000);
      ultEl.textContent = '⏳ ' + sec + 'с';
      ultBtn.classList.remove('ready');
      return;
    }

    /* Обычный счётчик — с учётом активной ульты */
    const req = getUltReq();
    const displayHits = Math.min(ultHits, req);
    ultEl.textContent = displayHits + '/' + req;
    ultBtn.classList.toggle('ready', ultHits >= req);
  }

  /* ═══════════════════════════════════════════════════════════════
     СПАВН
     ═══════════════════════════════════════════════════════════════ */
  function freePoints(){ return Math.max(0, 5 - targets.reduce((n,t) => n + t.slots, 0)); }

  function pickType(){
    const p = difficulty();
    const r = Math.random();
    let s = 0;
    for (const k of Object.keys(p)){ s += p[k]; if (r < s) return k; }
    return 'normal';
  }

  function validType(type){
    if (type === 'gold' || type === 'fastgold'){
      return targets.filter(t => t.gold).length < 2 && freePoints() >= 1;
    }
    return freePoints() >= 1;
  }

  function spawn(){
    if (!game || targets.length >= 5) return;

    let type = null;
    for (let i = 0; i < 30; i++){
      const x = pickType();
      if (validType(x)){ type = x; break; }
    }
    if (!type) return;

    const d = TYPES[type];
    const gold = type === 'gold' || type === 'fastgold';
    const slots = 1;
    const lane = Math.floor(Math.random() * 3);
    const laneSlots = targets.filter(t => t.lane === lane).reduce((n,t) => n + t.slots, 0);
    if (laneSlots + slots > 2){ setTimeout(spawn, 120); return; }

    const el = document.createElement('div');
    el.className = 'target ' + d.color;
    const t = {
      id: nextId++, type, lane,
      x: 12 + Math.random() * 76,
      y: 50, hp: d.hp, slots, gold, el,
      dx: (type === 'fast' || type === 'fastgold') ? (Math.random() < .5 ? 1 : -1) * d.speed
        : type === 'maneuver' ? (Math.random() < .5 ? 1 : -1) * d.speed
        : 0,
      last: performance.now(),
      jumpAt: performance.now() + 1200 + Math.random() * 1500,
      telegraphing: false
    };
    el.style.left = t.x + '%';
    el.style.top = t.y + '%';
    el.dataset.id = t.id;
    if (t.hp > 1){
      const hp = document.createElement('div');
      hp.className = 'hp';
      hp.textContent = 'HP 2/2';
      el.appendChild(hp);
    }
    document.querySelectorAll('.lane')[lane].appendChild(el);
    targets.push(t);
  }

  function removeTarget(t){
    t.el.remove();
    targets = targets.filter(x => x !== t);
  }

  /* ═══════════════════════════════════════════════════════════════
     СПЕЦЭФФЕКТЫ
     ═══════════════════════════════════════════════════════════════ */
  function getElCenter(el){
    const tr = el.getBoundingClientRect();
    const r = range.getBoundingClientRect();
    return { x: tr.left + tr.width/2 - r.left, y: tr.top + tr.height/2 - r.top };
  }

  function shatterTarget(el, x, y){
    const color = getComputedStyle(el).backgroundColor;
    const count = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++){
      const shard = document.createElement('div');
      shard.className = 'shard';
      shard.style.left = x + 'px';
      shard.style.top = y + 'px';
      shard.style.background = color;
      const size = 8 + Math.random() * 8;
      shard.style.width = size + 'px';
      shard.style.height = size + 'px';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 45 + Math.random() * 45;
      shard.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      shard.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      range.appendChild(shard);
      setTimeout(() => shard.remove(), 650);
    }
  }

  function showGoldCombo(x, y, mult){
    const el = document.createElement('div');
    el.className = 'combo-pop';
    el.textContent = '×' + mult.toFixed(1);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    range.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

/* ═══════════════════════════════════════════════════════════════
   СТОП. ВСТАВЬ ЧАСТЬ 3 НИЖЕ
   ═══════════════════════════════════════════════════════════════ */
     /* ═══════════════════════════════════════════════════════════════
     КИТАЙСКИЕ ПОПАПЫ
     ═══════════════════════════════════════════════════════════════ */
  function chinaPopup(x, y, type, text){
    const el = document.createElement('div');
    el.className = 'china-popup ' + type;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    range.appendChild(el);
    const ms = type === 'full' ? 2200 : (type === 'miska' ? 1800 : 1400);
    setTimeout(() => el.remove(), ms);
  }

  function showChinaCombo(x, y, floor){
    if (floor % 10 === 0){
      chinaPopup(x, y, 'full', '+ Миска Рис и Кошка Жена');
    } else if (floor % 5 === 0){
      chinaPopup(x, y, 'miska', '+ Миска Рис');
    } else {
      chinaPopup(x, y, 'credit', '+100 社会信用');
    }
  }

  function showChinaPride(){
    const el = document.createElement('div');
    el.className = 'china-pride';
    el.textContent = 'Партия гордится вами!!!';
    range.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function showChinaMissScore(){
    const el = document.createElement('div');
    el.className = 'china-miss-score';
    el.textContent = 'Вы разочаровали партию!!!';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  function showChinaMissPoint(xPercent, yPercent){
    const r = range.getBoundingClientRect();
    const px = xPercent / 100 * r.width;
    const py = yPercent / 100 * r.height;
    const el = document.createElement('div');
    el.className = 'china-miss-point';
    el.textContent = '-1000 社会信用';
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    range.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  /* ═══════════════════════════════════════════════════════════════
     ★ AKC-74M — ГИЛЬЗЫ, ДЫМ, РАЗРЕЗ ДЫМА
     ═══════════════════════════════════════════════════════════════ */
  function spawnShell(){
    if (!isAkcActive() || !range || !rifleWrap) return;

    const existing = range.querySelectorAll('.akc-shell');
    if (existing.length >= MAX_SHELLS) existing[0].remove();

    const receiver = rifleWrap.querySelector('.rifle-receiver');
    if (!receiver) return;

    const stageRect = range.getBoundingClientRect();
    const rRect = receiver.getBoundingClientRect();

    const shell = document.createElement('div');
    shell.className = 'akc-shell';
    shell.style.left = (rRect.right - stageRect.left - 4) + 'px';
    shell.style.top  = (rRect.top - stageRect.top + 18) + 'px';
    range.appendChild(shell);

    const angleRad = (-25 - Math.random() * 50) * Math.PI / 180;
    const speed = 250 + Math.random() * 200;
    let vx = Math.cos(angleRad) * speed;
    let vy = Math.sin(angleRad) * speed;

    const gravity = 1800;
    const rotSpeed = 600 + Math.random() * 900;
    const fallY = 120 + Math.random() * 80;

    let x = 0, y = 0, rot = 0;
    let lastTime = performance.now();
    let landed = false;
    const startTime = lastTime;
    const maxTime = 2500;

    function tick(now){
      if (!shell.parentNode || landed) return;

      const dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      vy += gravity * dt;
      x += vx * dt;
      y += vy * dt;
      rot += rotSpeed * dt;

      shell.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;

      if (y >= fallY || (now - startTime) > maxTime){
        landed = true;
        setTimeout(() => {
          if (!shell.parentNode) return;
          shell.style.opacity = '0';
          setTimeout(() => shell.remove(), 900);
        }, 2000);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    setTimeout(() => { if (shell.parentNode) shell.remove(); }, 5000);
  }

  function cutSmokeAlongBullet(bullet) {
    if (!range) return;

    const checkInterval = setInterval(() => {
      if (!bullet.parentNode) { clearInterval(checkInterval); return; }

      const particles = range.querySelectorAll('.akc-smoke-particle');
      if (particles.length === 0) return;

      const rect = bullet.getBoundingClientRect();
      if (!rect) { clearInterval(checkInterval); return; }

      const stageRect = range.getBoundingClientRect();
      const bulletX = rect.left + rect.width / 2 - stageRect.left;
      const bulletY = rect.top + rect.height / 2 - stageRect.top;

      particles.forEach(p => {
        const pRect = p.getBoundingClientRect();
        const pX = pRect.left + pRect.width / 2 - stageRect.left;
        const pY = pRect.top + pRect.height / 2 - stageRect.top;

        if (Math.abs(bulletX - pX) < 25 && Math.abs(bulletY - pY) < 25) {
          cutSmokeParticle(pX, pY, bulletX < pX ? 1 : -1);
          p.remove();
        }
      });
    }, 70);
  }

  function cutSmokeParticle(px, py, direction){
    const piecesCount = 3 + Math.floor(Math.random() * 2);

    for (let i = 0; i < piecesCount; i++){
      const piece = document.createElement('div');
      piece.className = 'akc-smoke-piece';

      const angle = (i / piecesCount) * Math.PI - Math.PI / 2;
      const dx = Math.cos(angle) * (20 + Math.random() * 20) + direction * 10;
      const dy = -Math.sin(angle) * (20 + Math.random() * 20) - 15;

      piece.style.left = px + 'px';
      piece.style.top = py + 'px';
      piece.style.setProperty('--dx', dx + 'px');
      piece.style.setProperty('--dy', dy + 'px');

      const size = 6 + Math.random() * 6;
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';

      range.appendChild(piece);
      setTimeout(() => piece.remove(), 1200);
    }
  }

  function spawnSmoke(){
    if (!isAkcActive() || !range || !rifleWrap) return;

    const muzzle = rifleWrap.querySelector('.rifle-muzzle');
    if (!muzzle) return;

    const stageRect = range.getBoundingClientRect();
    const mRect = muzzle.getBoundingClientRect();

    const px = mRect.left + mRect.width / 2 - stageRect.left;
    const py = mRect.top + mRect.height / 2 - stageRect.top;

    const count = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < count; i++){
      const p = document.createElement('div');
      p.className = 'akc-smoke-particle';
      p.style.left = (px + (Math.random() - 0.5) * 12) + 'px';
      p.style.top  = (py - Math.random() * 8) + 'px';
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      const sz = 14 + Math.random() * 10;
      p.style.width = sz + 'px';
      p.style.height = sz + 'px';
      range.appendChild(p);
      setTimeout(() => p.remove(), 2400);
    }
  }

  function updateHeat(){
    if (!isAkcActive()) return;

    const now = Date.now();
    recentShotTimestamps = recentShotTimestamps.filter(t => now - t < 20000);
    const hot = recentShotTimestamps.length >= 10;

    if (hot){
      rifleWrap.classList.add('akc-hot');
      if (!smokeInterval) smokeInterval = setInterval(spawnSmoke, 400);
      if (!coolDownCheck){
        coolDownCheck = setInterval(() => {
          const t = Date.now();
          recentShotTimestamps = recentShotTimestamps.filter(ts => t - ts < 20000);
          if (recentShotTimestamps.length < 10) stopHeat();
        }, 500);
      }
    } else {
      stopHeat();
    }
  }

  function stopHeat(){
    if (smokeInterval){ clearInterval(smokeInterval); smokeInterval = null; }
    if (coolDownCheck){ clearInterval(coolDownCheck); coolDownCheck = null; }
    if (rifleWrap) rifleWrap.classList.remove('akc-hot');
  }

  /* ═══════════════════════════════════════════════════════════════
     ОЧКИ
     ═══════════════════════════════════════════════════════════════ */
  function addScore(points){
    score += points * (laserEnabled ? LASER_PENALTY : 1);
  }

/* ═══════════════════════════════════════════════════════════════
   СТОП. ВСТАВЬ ЧАСТЬ 4 НИЖЕ
   ═══════════════════════════════════════════════════════════════ */
     /* ═══════════════════════════════════════════════════════════════
     ПОПАДАНИЕ
     ═══════════════════════════════════════════════════════════════ */
  function hitTarget(t){
    playSfx('hit');
    t.hp--;
    const alive = t.hp > 0;

    if (alive){
      const hp = t.el.querySelector('.hp');
      if (hp) hp.textContent = 'HP 1/2';
    } else {
      addScore(TYPES[t.type].base * comboMult());
    }

    comboHits++;

    /* ★ Не копим ульту, если лазер на КД */
    const laserOnCd = Storage.getActiveUlt() === 'laser'
      && window.GameLaser
      && window.GameLaser.isOnCooldown
      && window.GameLaser.isOnCooldown();

    if (!laserOnCd){
      const req = getUltReq();
      const wasUltReady = ultHits >= req;
      ultHits = Math.min(req, ultHits + 1);
      if (!wasUltReady && ultHits >= req && !ultReadySoundPlayed){
        playSfx('ultReady');
        ultReadySoundPlayed = true;
      }
    }

    let center = null;
    if (!alive){
      center = getElCenter(t.el);
      shatterTarget(t.el, center.x, center.y);
    }

    const newFloor = Math.floor(comboMult());
    if (newFloor > prevComboFloor){
      prevComboFloor = newFloor;
      if (newFloor >= 10 && runStats.mode === 'infinite') sawTenCombo = true;
      const c = center || getElCenter(t.el);
      if (isChinaActive()){
        showChinaCombo(c.x, c.y, newFloor);
        if (newFloor % 5 === 0) showChinaPride();
      } else {
        showGoldCombo(c.x, c.y, newFloor);
      }
    }

    if (!alive) removeTarget(t);
    updateUI();
  }

  function hitTargetNoMiss(t){
    playSfx('hit');
    t.hp--;
    const alive = t.hp > 0;

    if (alive){
      const hp = t.el.querySelector('.hp');
      if (hp) hp.textContent = 'HP 1/2';
    } else {
      addScore(TYPES[t.type].base * comboMult());
    }

    comboHits++;

    const laserOnCd = Storage.getActiveUlt() === 'laser'
      && window.GameLaser
      && window.GameLaser.isOnCooldown
      && window.GameLaser.isOnCooldown();

    if (!laserOnCd){
      const req = getUltReq();
      const wasUltReady = ultHits >= req;
      ultHits = Math.min(req, ultHits + 1);
      if (!wasUltReady && ultHits >= req && !ultReadySoundPlayed){
        playSfx('ultReady');
        ultReadySoundPlayed = true;
      }
    }

    let center = null;
    if (!alive){
      center = getElCenter(t.el);
      shatterTarget(t.el, center.x, center.y);
    }

    const newFloor = Math.floor(comboMult());
    if (newFloor > prevComboFloor){
      prevComboFloor = newFloor;
      if (newFloor >= 10 && runStats.mode === 'infinite') sawTenCombo = true;
      const c = center || getElCenter(t.el);
      if (isChinaActive()){
        showChinaCombo(c.x, c.y, newFloor);
        if (newFloor % 5 === 0) showChinaPride();
      } else {
        showGoldCombo(c.x, c.y, newFloor);
      }
    }

    if (!alive) removeTarget(t);
    updateUI();
  }

  /* ★ Попадание лазером: ×1.5 к очкам, шаг комбо ×0.15, БЕЗ сброса комбо */
  function hitTargetLaser(t){
    playSfx('hit');
    t.hp--;
    const alive = t.hp > 0;

    if (alive){
      const hp = t.el.querySelector('.hp');
      if (hp) hp.textContent = 'HP 1/2';
    } else {
      addScore(TYPES[t.type].base * comboMult(0.15) * 1.5);
    }

    comboHits++;
    /* ★ Во время лазера ULT НЕ накапливается */

    let center = null;
    if (!alive){
      center = getElCenter(t.el);
      shatterTarget(t.el, center.x, center.y);
    }

    const newFloor = Math.floor(comboMult(0.15));
    if (newFloor > prevComboFloor){
      prevComboFloor = newFloor;
      if (newFloor >= 10 && runStats.mode === 'infinite') sawTenCombo = true;
      const c = center || getElCenter(t.el);
      if (isChinaActive()){
        showChinaCombo(c.x, c.y, newFloor);
        if (newFloor % 5 === 0) showChinaPride();
      } else {
        showGoldCombo(c.x, c.y, newFloor);
      }
    }

    if (!alive) removeTarget(t);
    updateUI();
  }

  function miss(){
    playSfx('miss');
    if (isChinaActive()){
      showChinaMissScore();
      showChinaMissPoint(aimX, aimY);
    }

    comboHits = 0;
    prevComboFloor = 1;

    if (Storage.isInfiniteMode()){
      missCount++;
      if (missCount >= MAX_MISSES){
        updateUI();
        finish(false);
        return;
      }
    }
    updateUI();
  }

  function resetComboSilent(){
    comboHits = 0;
    prevComboFloor = 1;

    if (Storage.isInfiniteMode()){
      missCount++;
      if (missCount >= MAX_MISSES){
        updateUI();
        finish(false);
        return;
      }
    }
    updateUI();
  }

  /* ═══════════════════════════════════════════════════════════════
     ПРИЦЕЛ
     ═══════════════════════════════════════════════════════════════ */
  function setAim(clientX, clientY){
    if (paused) return;
    const r = range.getBoundingClientRect();
    aimX = Math.max(8, Math.min(92, (clientX - r.left) / r.width * 100));
    aimY = Math.max(5, Math.min(62, (clientY - r.top) / r.height * 100));
    updateRifle();
  }

  function getAimGeom(){
    const r = range.getBoundingClientRect();
    const pivotX = r.width / 2, pivotY = r.height - 18;

    let tx, ty;
    if (ultAiming && ultAimTarget){
      tx = ultAimTarget.x;
      ty = ultAimTarget.y;
    } else {
      tx = aimX / 100 * r.width;
      ty = aimY / 100 * r.height;
    }

    const angle = Math.atan2(tx - pivotX, pivotY - ty) * 180 / Math.PI;
    const muzzleDist = getMuzzleDistance();
    const mx = pivotX + Math.sin(angle * Math.PI / 180) * muzzleDist;
    const my = pivotY - Math.cos(angle * Math.PI / 180) * muzzleDist;

    return { pivotX, pivotY, tx, ty, angle, mx, my, muzzleDist };
  }

  let _cachedMuzzleDist = 0;
  let _cachedMuzzleSkin = '';

  function getMuzzleDistance(){
    const currentSkin = Storage.getActiveSkin();

    if (_cachedMuzzleSkin === currentSkin && _cachedMuzzleDist > 0){
      return _cachedMuzzleDist;
    }

    const muzzle = rifle.querySelector('.rifle-muzzle');
    if (!muzzle){
      _cachedMuzzleDist = 176;
      _cachedMuzzleSkin = currentSkin;
      return 176;
    }

    const muzzleCX = muzzle.offsetLeft + muzzle.offsetWidth / 2;
    const muzzleCY = muzzle.offsetTop + muzzle.offsetHeight / 2;
    const pivotX = rifle.offsetWidth / 2;
    const pivotY = rifle.offsetHeight * 0.9;

    _cachedMuzzleDist = Math.hypot(muzzleCX - pivotX, muzzleCY - pivotY);
    _cachedMuzzleSkin = currentSkin;
    return _cachedMuzzleDist;
  }

  function updateRifle(){
    if (!range) return;
    const g = getAimGeom();
    rifle.style.transform = `rotate(${g.angle}deg)`;
    flash.style.left = g.mx + 'px';
    flash.style.top = g.my + 'px';
    laser.style.left = g.pivotX + 'px';
    laser.style.top = g.pivotY + 'px';
    laser.style.width = Math.hypot(g.tx - g.pivotX, g.ty - g.pivotY) + 'px';
    laser.style.transform = `rotate(${Math.atan2(g.ty - g.pivotY, g.tx - g.pivotX)}rad)`;
    laser.classList.toggle('hidden', !laserEnabled || !game);
  }

  function isOnHomeBtn(e){
    let el = e.target;
    while (el && el !== range){
      if (el.id === 'homeBtn' || el.id === 'pauseBtn') return true;
      el = el.parentElement;
    }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════════
     ПУЛЯ
     ═══════════════════════════════════════════════════════════════ */
  function spawnBullet(offsetX, offsetY, isTracer){
    const g = getAimGeom();
    const dx = g.tx - g.mx + (offsetX || 0);
    const dy = g.ty - g.my + (offsetY || 0);
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const b = document.createElement('div');
    b.className = 'bullet pv-bullet';
    if (isTracer) b.classList.add('pv-tracer');
    b.style.left = g.mx + 'px';
    b.style.top = g.my + 'px';
    b.style.setProperty('--dx', dx + 'px');
    b.style.setProperty('--dy', dy + 'px');
    b.style.setProperty('--angle', (angle + 90) + 'deg');
    b.style.animation = `bulletTravel ${Math.max(.09, Math.min(.28, dist/1700))}s linear forwards`;

    range.appendChild(b);
    bullets.push(b);
    cutSmokeAlongBullet(b);
    setTimeout(() => { b.remove(); bullets = bullets.filter(x => x !== b); }, 320);
  }

  function findHit(aimXPercent, aimYPercent){
    const r = range.getBoundingClientRect();
    const tx = aimXPercent / 100 * r.width;
    const ty = aimYPercent / 100 * r.height;
    let hit = null, best = 1e9;
    for (const t of targets){
      const tr = t.el.getBoundingClientRect();
      const cx = tr.left + tr.width / 2 - r.left;
      const cy = tr.top + tr.height / 2 - r.top;
      const dist = Math.hypot(tx - cx, ty - cy);
      const rad = Math.max(tr.width, tr.height) / 2;
      if (dist <= rad && dist < best){ best = dist; hit = t; }
    }
    return hit;
  }

/* ═══════════════════════════════════════════════════════════════
   СТОП. ВСТАВЬ ЧАСТЬ 5 НИЖЕ
   ═══════════════════════════════════════════════════════════════ */
     /* ═══════════════════════════════════════════════════════════════
     ВЫСТРЕЛ — ОБЫЧНЫЙ (1 пуля)
     ═══════════════════════════════════════════════════════════════ */
  function fireSingle(){
    if (!game) return;

    runStats.shotCount++;
    totalShotCount++;
    recentShotTimestamps.push(Date.now());

    playSfx('shot');

    rifleWrap.classList.remove('recoil');
    void rifleWrap.offsetWidth;
    rifleWrap.classList.add('recoil');
    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');

    spawnBullet(0, 0, false);

    const hit = findHit(aimX, aimY);
    if (hit) hitTarget(hit); else miss();
  }

  /* ═══════════════════════════════════════════════════════════════
     ВЫСТРЕЛ — AKC-74M (очередь из 3 пуль)
     ═══════════════════════════════════════════════════════════════ */
  function fireAkc(){
    if (!game || isFiring) return;
    isFiring = true;

    let shotsFired = 0;
    let hitsCount = 0;

    const burstInterval = setInterval(() => {
      if (!game){
        clearInterval(burstInterval);
        isFiring = false;
        return;
      }

      shotsFired++;
      runStats.shotCount++;
      totalShotCount++;
      recentShotTimestamps.push(Date.now());

      playSfx('shotAkc');

      rifleWrap.classList.remove('recoil');
      void rifleWrap.offsetWidth;
      rifleWrap.classList.add('recoil');
      flash.classList.remove('fire');
      void flash.offsetWidth;
      flash.classList.add('fire');

      const isTracer = (totalShotCount % 5 === 0);

      let offsetX = 0, offsetY = 0;
      if (shotsFired === 2){
        offsetX = (Math.random() < .5 ? 1 : -1) * (10 + Math.random() * 15);
        offsetY = (Math.random() - .5) * 20;
      } else if (shotsFired === 3){
        offsetX = (Math.random() < .5 ? 1 : -1) * (15 + Math.random() * 20);
        offsetY = (Math.random() - .5) * 30;
      }

      spawnBullet(offsetX, offsetY, isTracer);
      spawnShell();

      const r = range.getBoundingClientRect();
      const bulletAimX = aimX + (offsetX / r.width) * 100;
      const bulletAimY = aimY + (offsetY / r.height) * 100;

      const hit = findHit(bulletAimX, bulletAimY);

      if (hit){
        hitsCount++;
        hitTargetNoMiss(hit);
      } else {
        playSfx('miss');
      }

      updateHeat();

      if (shotsFired >= 3){
        clearInterval(burstInterval);
        if (hitsCount === 0) resetComboSilent();
        setTimeout(() => { isFiring = false; }, 100);
      }
    }, 150);
  }

  /* ═══════════════════════════════════════════════════════════════
     ГЛАВНЫЙ ВЫСТРЕЛ
     ═══════════════════════════════════════════════════════════════ */
  function fire(){
    if (!game) return;
    if (isFiring) return;
    if (window._laserActive) return;   // блок на время работы лазера

    if (isAkcActive()){
      fireAkc();
    } else {
      fireSingle();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ULT — проверка активной ульты + классическая
     ═══════════════════════════════════════════════════════════════ */
  function ultimate(){
    if (!game || ultHits < getUltReq()) return;

    /* ★ Активная ульта из Storage */
    const activeUlt = Storage.getActiveUlt();

    if (activeUlt === 'laser' && window.GameLaser && window.GameLaser.fire){
      /* Если лазер на КД — не тратим ульту */
      if (window.GameLaser.isOnCooldown && window.GameLaser.isOnCooldown()){
        const msg = document.getElementById('message');
        msg.textContent = '⏳ Лазер перезаряжается';
        msg.className = 'pop';
        setTimeout(() => { msg.textContent = ''; msg.className = ''; }, 800);
        return;
      }
      ultHits = 0;
      ultReadySoundPlayed = false;
      updateUI();
      runStats.ultCount++;
      window.GameLaser.fire();
      return;
    }

    if (activeUlt === 'MLRS' && window.GameMLRS && window.GameMLRS.fire){
      ultHits = 0;
      ultReadySoundPlayed = false;
      updateUI();
      runStats.ultCount++;
      window.GameMLRS.fire();
      return;
    }

    /* ─── Классическая ульта ×3 ─── */
    window._ultJustFired = true;
    setTimeout(() => { window._ultJustFired = false; }, 1000);

    runStats.ultCount++;
    ultReadySoundPlayed = false;

    const shotList = targets.map(t => ({
      t,
      center: getElCenter(t.el)
    }));

    const AIM_TIME = 60;
    const FIRE_DELAY = 30;
    const BULLET_SPEED = 4200;

    playSfx('ult');
    const soundRef = SFX.ult;
    const totalShots = shotList.length;
    const totalTime = totalShots * (AIM_TIME + FIRE_DELAY) + 400;
    setTimeout(() => {
      try {
        soundRef.pause();
        soundRef.currentTime = 0;
      } catch(e){}
    }, totalTime);

    let total = 0;
    shotList.forEach(s => total += TYPES[s.t.type].base);
    targets = [];
    addScore(total * comboMult() * 3);
    ultHits = 0;
    updateUI();

    const msg = document.getElementById('message');
    msg.textContent = 'ULT ×3';
    msg.className = 'pop';
    setTimeout(() => { msg.textContent = ''; msg.className = ''; }, 600);

    if (shotList.length === 0) return;

    shotList.sort((a, b) => a.center.y - b.center.y);

    ultAiming = true;
    rifle.classList.add('ult-aiming');

    let idx = 0;

    function nextShot(){
      if (idx >= shotList.length){
        setTimeout(() => {
          ultAiming = false;
          ultAimTarget = null;
          rifle.classList.remove('ult-aiming');
          updateRifle();
        }, 300);
        return;
      }

      const shot = shotList[idx];
      idx++;

      ultAimTarget = { x: shot.center.x, y: shot.center.y };
      updateRifle();

      setTimeout(() => {
        if (!game){
          if (shot.t && shot.t.el && shot.t.el.parentNode) shot.t.el.remove();
          ultAiming = false;
          ultAimTarget = null;
          rifle.classList.remove('ult-aiming');
          return;
        }

        rifleWrap.classList.remove('recoil');
        void rifleWrap.offsetWidth;
        rifleWrap.classList.add('recoil');
        flash.classList.remove('fire');
        void flash.offsetWidth;
        flash.classList.add('fire');

        const g = getAimGeom();
        const dx = shot.center.x - g.mx;
        const dy = shot.center.y - g.my;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const duration = Math.max(0.08, Math.min(0.3, dist / BULLET_SPEED));

        const b = document.createElement('div');
        b.className = 'bullet ult-bullet';
        b.style.left = g.mx + 'px';
        b.style.top = g.my + 'px';
        b.style.setProperty('--dx', dx + 'px');
        b.style.setProperty('--dy', dy + 'px');
        b.style.setProperty('--angle', (angle + 90) + 'deg');
        b.style.animation = `bulletTravel ${duration}s linear forwards`;
        range.appendChild(b);

        setTimeout(() => {
          b.remove();
          if (shot.t && shot.t.el && shot.t.el.parentNode){
            const c = getElCenter(shot.t.el);
            shatterTarget(shot.t.el, c.x, c.y);
            shot.t.el.remove();
          }
        }, duration * 1000);

        setTimeout(nextShot, FIRE_DELAY);

      }, AIM_TIME);
    }

    nextShot();
  }

/* ═══════════════════════════════════════════════════════════════
   СТОП. ВСТАВЬ ЧАСТЬ 6 НИЖЕ
   ═══════════════════════════════════════════════════════════════ */
     /* ═══════════════════════════════════════════════════════════════
     ИСТОРИЯ
     ═══════════════════════════════════════════════════════════════ */
  function saveToHistory(win){
    const history = Storage.getHistory();
    history.unshift({
      score: Math.floor(score),
      win,
      duration: runStats.duration,
      shots: runStats.shotCount,
      ults: runStats.ultCount,
      maxCombo: +runStats.maxComboMult.toFixed(1),
      mode: runStats.mode,
      laser: runStats.laser,
      date: new Date().toLocaleDateString('ru-RU')
    });
    Storage.setHistory(history.slice(0, 10));
  }

  /* ═══════════════════════════════════════════════════════════════
     СТАРТ
     ═══════════════════════════════════════════════════════════════ */
  function start(){
    score = 0; comboHits = 0; ultHits = 0; targets = [];
    bullets.forEach(b => b.remove()); bullets = [];
    nextId = 1; missCount = 0; prevComboFloor = 1;
    ultReadySoundPlayed = false;
    sawTenCombo = false;
    isFiring = false;
    totalShotCount = 0;
    recentShotTimestamps = [];
    stopHeat();
    ultAiming = false;
    ultAimTarget = null;
    if (rifle) rifle.classList.remove('ult-aiming');
    game = true;

    laserEnabled = Storage.isLaserEnabled();
    personalBest = Storage.getPersonalBest();

    runStats = {
      shotCount: 0, ultCount: 0, maxComboMult: 1,
      startTime: performance.now(), duration: 0,
      mode: Storage.isInfiniteMode() ? 'infinite' : 'normal',
      laser: laserEnabled
    };

    updateUI();
    endScreen.classList.add('hidden');
    document.querySelectorAll('.target').forEach(e => e.remove());
    document.querySelectorAll('.akc-shell').forEach(e => e.remove());
    document.querySelectorAll('.akc-smoke-particle').forEach(e => e.remove());
    aimX = 50; aimY = 40;
    updateRifle();

    const pb = document.getElementById('pauseBtn');
    if (pb) pb.classList.remove('hidden');
    paused = false;
    modeBadge.classList.toggle('hidden', !Storage.isInfiniteMode());

    const stickerBtn = document.getElementById('stickerBtn');
    const coinsEarned = document.getElementById('coinsEarned');
    if (stickerBtn) stickerBtn.classList.add('hidden');
    if (coinsEarned) coinsEarned.classList.add('hidden');

    for (let i = 0; i < 3; i++) setTimeout(spawn, 250 + i * 250);
    clearInterval(spawnTimer);
    spawnTimer = setInterval(() => { if (game) spawn(); }, 1000);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  /* ═══════════════════════════════════════════════════════════════
     ФИНИШ
     ═══════════════════════════════════════════════════════════════ */
  async function finish(win){
    game = false;
    isFiring = false;
    clearInterval(spawnTimer);
    cancelAnimationFrame(raf);
    stopHeat();
    ultAiming = false;
    ultAimTarget = null;
    if (rifle) rifle.classList.remove('ult-aiming');
    laser.classList.add('hidden');
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.classList.add('hidden');
    modeBadge.classList.add('hidden');

    if (win) playSfx('win');

    runStats.duration = Math.round((performance.now() - runStats.startTime) / 1000);
    const coinsEarnedLocal = Math.floor(score / COINS_PER_POINTS);

    if (score > personalBest){
      personalBest = Math.floor(score);
      Storage.setPersonalBest(personalBest);
    }
    if (win && !Storage.isInfiniteUnlocked()) Storage.unlockInfinite();

    saveToHistory(win);

    document.getElementById('endTitle').textContent = win ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА';
    document.getElementById('endReason').textContent = win
      ? '10 000 очков достигнуто. Забери награду!'
      : (runStats.mode === 'infinite' ? MAX_MISSES + ' промахов исчерпано.' : 'Игра завершена.');
    document.getElementById('finalScore').textContent = Math.floor(score);

    const ce = document.getElementById('coinsEarned');
    if (coinsEarnedLocal > 0){
      ce.textContent = '🪙 +' + coinsEarnedLocal + ' монет';
      ce.classList.remove('hidden');
    }

    const stickerBtn = document.getElementById('stickerBtn');
    if (stickerBtn) stickerBtn.classList.toggle('hidden', !win);

    const catwifeEl = document.getElementById('catwifeImage');
    if (catwifeEl){
      const showCatwife = !win && runStats.mode === 'infinite' && sawTenCombo;
      catwifeEl.classList.toggle('hidden', !showCatwife);
    }

    endScreen.classList.remove('hidden');

    try {
      const serverResp = await Sync.submitRun({
        score: Math.floor(score),
        duration: runStats.duration,
        shots: runStats.shotCount,
        ults: runStats.ultCount,
        maxCombo: runStats.maxComboMult,
        isWin: win,
        mode: runStats.mode,
        laser: runStats.laser
      });
      if (serverResp && typeof serverResp.coins_earned === 'number'){
        ce.textContent = '🪙 +' + serverResp.coins_earned + ' монет';
        ce.classList.remove('hidden');
      }
    } catch(e){
      console.warn('[finish] submit failed:', e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ПАУЗА
     ═══════════════════════════════════════════════════════════════ */
  let paused = false;

  function pause(){
    if (!game || paused) return;
    paused = true;
    cancelAnimationFrame(raf);
    clearInterval(spawnTimer);
    stopHeat();

    const screen = document.getElementById('pauseScreen');
    if (screen) screen.classList.remove('hidden');

    const sl = document.getElementById('pauseVolSlider');
    const vl = document.getElementById('pauseVolVal');
    if (sl){
      sl.value = Storage.getVolume();
      if (vl) vl.textContent = Storage.getVolume() + '%';
      sl.oninput = () => {
        const v = parseInt(sl.value, 10);
        if (vl) vl.textContent = v + '%';
        Storage.setVolume(v);
        setVolume(v / 100);
      };
    }
  }

  function resume(){
    if (!game || !paused) return;
    paused = false;
    const screen = document.getElementById('pauseScreen');
    if (screen) screen.classList.add('hidden');
    spawnTimer = setInterval(() => { if (game) spawn(); }, 1000);
    raf = requestAnimationFrame(loop);
    updateHeat();
  }

  function exitFromPause(){
    if (!paused) return;
    paused = false;
    const screen = document.getElementById('pauseScreen');
    if (screen) screen.classList.add('hidden');
    exitToMenu();
  }

  /* ═══════════════════════════════════════════════════════════════
     ВЫХОД В МЕНЮ
     ═══════════════════════════════════════════════════════════════ */
  function exitToMenu(){
    if (!game) return;

    runStats.duration = Math.round((performance.now() - runStats.startTime) / 1000);

    if (score > personalBest){
      personalBest = Math.floor(score);
      Storage.setPersonalBest(personalBest);
    }

    saveToHistory(false);
    Sync.submitRun({
      score: Math.floor(score), duration: runStats.duration,
      shots: runStats.shotCount, ults: runStats.ultCount,
      maxCombo: runStats.maxComboMult, isWin: false,
      mode: runStats.mode, laser: runStats.laser
    });

    game = false;
    isFiring = false;
    clearInterval(spawnTimer);
    cancelAnimationFrame(raf);
    stopHeat();
    ultAiming = false;
    ultAimTarget = null;
    if (rifle) rifle.classList.remove('ult-aiming');

    [...targets].forEach(t => t.el.remove());
    targets = [];
    bullets.forEach(b => b.remove());
    bullets = [];
    document.querySelectorAll('.akc-shell').forEach(e => e.remove());
    document.querySelectorAll('.akc-smoke-particle').forEach(e => e.remove());

    laser.classList.add('hidden');
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.classList.add('hidden');
    modeBadge.classList.add('hidden');

    if (typeof Menu !== 'undefined' && Menu.showMain){
      Menu.showMain();
    } else {
      document.getElementById('screenMain').classList.remove('hidden');
    }

    updateRifle();
  }

  /* ═══════════════════════════════════════════════════════════════
     ГЛАВНЫЙ ЦИКЛ
     ═══════════════════════════════════════════════════════════════ */
  function loop(now){
    if (!game || paused) return;

    for (const t of [...targets]){
      const dt = (now - t.last) / 1000;
      t.last = now;

      if (t.dx){
        const rr = range.getBoundingClientRect();
        t.x += t.dx * dt / rr.width * 100;
        if (t.x < 5 || t.x > 95){ t.dx *= -1; t.x = Math.max(5, Math.min(95, t.x)); }
        t.el.style.left = t.x + '%';
      }

      if (t.type === 'maneuver' && now > t.jumpAt){
        if (!t.telegraphing){
          const candidates = [0, 1, 2].filter(l => l !== t.lane);
          const canJump = candidates.some(ln => {
            const laneSlots = targets
              .filter(x => x !== t && x.lane === ln)
              .reduce((n, x) => n + x.slots, 0);
            return laneSlots + t.slots <= 2;
          });

          if (!canJump){
            t.jumpAt = now + 700;
          } else {
            t.telegraphing = true;
            t.el.style.animation = 'none';
            void t.el.offsetHeight;
            t.el.style.animation = 'telegraph .42s ease-in-out';
            t.jumpAt = now + 450;
          }
        } else {
          t.telegraphing = false;
          const candidates = [0, 1, 2].filter(l => l !== t.lane);
          candidates.sort(() => Math.random() - 0.5);
          let newLane = null;
          for (const ln of candidates){
            const laneSlots = targets
              .filter(x => x !== t && x.lane === ln)
              .reduce((n, x) => n + x.slots, 0);
            if (laneSlots + t.slots <= 2){
              newLane = ln;
              break;
            }
          }
          if (newLane !== null){
            t.lane = newLane;
            document.querySelectorAll('.lane')[newLane].appendChild(t.el);
            t.el.style.animation = 'none';
            void t.el.offsetHeight;
            t.el.style.animation = 'jumpLine .34s cubic-bezier(.2,.8,.2,1)';
          }
          t.jumpAt = now + 1300 + Math.random() * 1500;
        }
      }
    }

    if (game && targets.length === 0 && !window._ultJustFired){
      spawn();
    }

    /* ★ Обновляем счётчик ULT при КД (throttle 200 мс) */
    if (window._lastUltTick === undefined) window._lastUltTick = 0;
    if (now - window._lastUltTick > 200){
      window._lastUltTick = now;
      updateUltCounter();
    }

    if (!Storage.isInfiniteMode() && score >= WIN_SCORE){
      finish(true);
    } else {
      updateRifle();
      raf = requestAnimationFrame(loop);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ОБРАБОТЧИКИ
     ═══════════════════════════════════════════════════════════════ */
  function bindEvents(){
    range.addEventListener('pointerdown', e => {
      if (!game || paused) return;
      if (isOnHomeBtn(e)) return;
      range.setPointerCapture(e.pointerId);
      setAim(e.clientX, e.clientY);
    });
    range.addEventListener('pointermove', e => {
      if (!game) return;
      if (isOnHomeBtn(e)) return;
      if (e.buttons) setAim(e.clientX, e.clientY);
    });

    document.getElementById('fire').onclick = fire;
    document.getElementById('ultimate').onclick = ultimate;

    const againBtn = document.getElementById('again');
    if (againBtn) againBtn.onclick = () => {
      endScreen.classList.add('hidden');
      start();
    };

    if (homeBtn){
      homeBtn.addEventListener('pointerdown', e => e.stopPropagation(), true);
      homeBtn.addEventListener('pointerup', e => {
        e.stopPropagation(); e.preventDefault(); pause();
      });
      homeBtn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault(); pause();
      });
    }

    const pauseResume = document.getElementById('pauseResume');
    if (pauseResume) pauseResume.onclick = resume;
    const pauseExit = document.getElementById('pauseExit');
    if (pauseExit) pauseExit.onclick = exitFromPause;

    const stickerBtn = document.getElementById('stickerBtn');
    if (stickerBtn) stickerBtn.onclick = async () => {
      const reason = document.getElementById('endReason');
      if (!API.isTelegramReady()){
        reason.textContent = 'Открой игру через Telegram-бота.';
        return;
      }
      stickerBtn.disabled = true;
      stickerBtn.textContent = '⏳ Проверяем...';
      const data = await API.claimReward();
      if (data.ok){
        reason.textContent = '🎁 Награда выдана! Скоро придёт в личку.';
        stickerBtn.textContent = '✅ ЗАБРАНО';
        stickerBtn.style.background = '#3a3f4a';
      } else if (data.error === 'already claimed'){
        reason.textContent = '🎁 Ты уже получал эту награду.';
        stickerBtn.textContent = '✅ УЖЕ ЗАБРАНО';
        stickerBtn.style.background = '#3a3f4a';
      } else {
        reason.textContent = 'Ошибка: ' + (data.error || 'unknown');
        stickerBtn.disabled = false;
        stickerBtn.textContent = '🎁 ЗАБРАТЬ СТИКЕРЫ';
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     ОТЛАДКА — спавн мишени
     ═══════════════════════════════════════════════════════════════ */
  function _devSpawn(typeName){
    if (!game) return 'no game';
    if (targets.length >= 5) return 'full (5 targets)';

    const type = typeName || 'normal';
    const d = TYPES[type];
    if (!d) return 'bad type: ' + type;

    const gold = (type === 'gold' || type === 'fastgold');
    if (gold && targets.filter(t => t.gold).length >= 2){
      return 'gold cap (max 2)';
    }

    const lane = Math.floor(Math.random() * 3);
    const laneSlots = targets
      .filter(t => t.lane === lane)
      .reduce((n, t) => n + t.slots, 0);
    if (laneSlots + 1 > 2) return 'lane ' + lane + ' full';

    const el = document.createElement('div');
    el.className = 'target ' + d.color;

    const t = {
      id: nextId++, type, lane,
      x: 12 + Math.random() * 76,
      y: 50,
      hp: d.hp, slots: 1, gold, el,
      dx: (type === 'fast' || type === 'fastgold')
        ? (Math.random() < .5 ? 1 : -1) * d.speed
        : type === 'maneuver'
          ? (Math.random() < .5 ? 1 : -1) * d.speed
          : 0,
      last: performance.now(),
      jumpAt: performance.now() + 1200 + Math.random() * 1500,
      telegraphing: false
    };

    el.style.left = t.x + '%';
    el.style.top  = t.y + '%';
    el.dataset.id = t.id;

    if (t.hp > 1){
      const hp = document.createElement('div');
      hp.className = 'hp';
      hp.textContent = 'HP 2/2';
      el.appendChild(hp);
    }

    document.querySelectorAll('.lane')[lane].appendChild(el);
    targets.push(t);

    return 'ok: ' + type + ' in lane ' + lane;
  }

  /* ═══════════════════════════════════════════════════════════════
     ИНИЦИАЛИЗАЦИЯ
     ═══════════════════════════════════════════════════════════════ */
  function init(){
    bindDom();
    bindEvents();
    Skins.loadFromStorage();
    updateRifle();
    updateUI();
    Sync.updateCoinsUI();
    Sync.fromServer();

    window._devSpawn = _devSpawn;
  }

  /* ═══════════════════════════════════════════════════════════════
     ЭКСПОРТ
     ═══════════════════════════════════════════════════════════════ */
  return {
    init,
    start,
    fire,
    ultimate,
    exitToMenu,
    setVolume,
    isRunning: () => game,
    pause,
    resume,
    exitFromPause,
    _devSpawn,

    /* ★ Публичное API для модулей ульт */
    _internals: {
      getGame:      () => game,
      getTargets:   () => targets,
      getAimGeom,
      addScore,
      updateUI,
      hitTargetLaser,
      getScore:     () => score,
      getCombo:     () => comboHits,
      getUltReq
    }
  };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Game.init());
} else {
  Game.init();
}