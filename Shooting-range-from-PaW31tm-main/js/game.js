/* ═══════════════════════════════════════════════════════════════
   ТИР — BETA 0.9.1 — ядро игры
   Использует: Storage, API, Skins, Sync, Menu
   ЧАСТЬ 1 из 2
   ═══════════════════════════════════════════════════════════════ */

const Game = (() => {

  const WIN_SCORE = 10000;
  const MAX_MISSES = 8;
  const LASER_PENALTY = 0.65;
  const COINS_PER_POINTS = 250;

  const TYPES = {
    normal:   {base: 25, hp:1, speed:  0, color:'normal'},
    fast:     {base: 55, hp:1, speed:150, color:'fast'},
    armored:  {base: 80, hp:2, speed:  0, color:'armored'},
    maneuver: {base:120, hp:1, speed: 70, color:'maneuver'},
    gold:     {base:200, hp:1, speed:  0, color:'gold'},
    fastgold: {base:350, hp:1, speed:160, color:"black_gold"}
  };

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

  let runStats = {
    shotCount: 0, ultCount: 0, maxComboMult: 1,
    startTime: 0, duration: 0, mode: 'normal', laser: false
  };

  /* ═══════════════════════════════════════════════════════════════
     ЗВУКИ
     ═══════════════════════════════════════════════════════════════ */
  const SFX = {
    shot:     new Audio('sounds/fire.mp3'),
    hit:      new Audio('sounds/armor.mp3'),
    ult:      new Audio('sounds/series_of_shots.mp3'),
    ultReady: new Audio('sounds/ult.mp3'),
    win:      new Audio('sounds/win.mp3'),
    miss:     new Audio('sounds/miss.mp3')
  };

  let masterVolume = Storage.getVolume() / 100;

  function playSfx(name){
    const a = SFX[name];
    if (!a || masterVolume <= 0) return;
    try {
      a.currentTime = 0;
      a.volume = masterVolume;
      a.play().catch(() => {});
    } catch(e){}
  }

  function setVolume(v){
    masterVolume = Math.max(0, Math.min(1, v));
  }

  /* ═══════════════════════════════════════════════════════════════
     DOM
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
    homeBtn     = document.getElementById('homeBtn');
    modeBadge   = document.getElementById('modeBadge');
    missesBlock = document.getElementById('missesBlock');
    missesEl    = document.getElementById('misses');
    scoreBox    = document.querySelector('.score');
  }

  /* ═══════════════════════════════════════════════════════════════
     ПРОВЕРКА: китайский скин активен?
     ═══════════════════════════════════════════════════════════════ */
  function isChinaActive(){
    return document.body.classList.contains('skin-china');
  }

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

  function comboMult(){ return 1 + Math.max(0, comboHits - 1) * 0.1; }

  /* ═══════════════════════════════════════════════════════════════
     UI
     ═══════════════════════════════════════════════════════════════ */
  function updateUI(){
    scoreEl.textContent = Math.floor(score);
    comboEl.textContent = '×' + comboMult().toFixed(1);
    ultEl.textContent = ultHits + '/5';
    ultBtn.classList.toggle('ready', ultHits >= 5);
    missesEl.textContent = missCount + '/' + MAX_MISSES;
    missesBlock.classList.toggle('hidden', !Storage.isInfiniteMode());

    if (comboMult() > runStats.maxComboMult) runStats.maxComboMult = comboMult();

    const isRecord = Storage.isInfiniteMode() && personalBest > 0 && score > personalBest;
    if (scoreBox) scoreBox.classList.toggle('gold-record', isRecord);
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

  function removeTarget(t){ t.el.remove(); targets = targets.filter(x => x !== t); }

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

/* ═══════════════ ★★★ СТОП. ВСТАВЬ СЮДА ЧАСТЬ 2 ★★★ ═══════════════ */


  /* ═══════════════════════════════════════════════════════════════
     ★ КИТАЙСКИЕ ПОПАПЫ
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
    }
    else if (floor % 5 === 0){
      chinaPopup(x, y, 'miska', '+ Миска Рис');
    }
    else {
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
     ОЧКИ И ПОПАДАНИЕ
     ═══════════════════════════════════════════════════════════════ */
  function addScore(points){
    score += points * (laserEnabled ? LASER_PENALTY : 1);
  }

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

    const wasUltReady = ultHits >= 5;
    ultHits = Math.min(5, ultHits + 1);
    if (!wasUltReady && ultHits >= 5 && !ultReadySoundPlayed){
      playSfx('ultReady');
      ultReadySoundPlayed = true;
    }

    let center = null;
    if (!alive){
      center = getElCenter(t.el);
      shatterTarget(t.el, center.x, center.y);
    }

    const newFloor = Math.floor(comboMult());
if (newFloor > prevComboFloor){
  prevComboFloor = newFloor;
  const c = center || getElCenter(t.el);

  // ★ Флаг для картинки кошки-жены при проигрыше в бесконечном
  if (newFloor >= 10 && runStats.mode === 'infinite') sawTenCombo = true;

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

  /* ═══════════════════════════════════════════════════════════════
     ПРИЦЕЛ
     ═══════════════════════════════════════════════════════════════ */
  function setAim(clientX, clientY){
    const r = range.getBoundingClientRect();
    aimX = Math.max(8, Math.min(92, (clientX - r.left) / r.width * 100));
    aimY = Math.max(5, Math.min(62, (clientY - r.top) / r.height * 100));
    updateRifle();
  }

  function getAimGeom(){
    const r = range.getBoundingClientRect();
    const pivotX = r.width / 2, pivotY = r.height - 18;
    const tx = aimX / 100 * r.width, ty = aimY / 100 * r.height;
    const angle = Math.atan2(tx - pivotX, pivotY - ty) * 180 / Math.PI;
    const mx = pivotX + Math.sin(angle * Math.PI / 180) * 176;
    const my = pivotY - Math.cos(angle * Math.PI / 180) * 176;
    return { pivotX, pivotY, tx, ty, angle, mx, my };
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
      if (el.id === 'homeBtn') return true;
      el = el.parentElement;
    }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════════
     ПУЛЯ
     ═══════════════════════════════════════════════════════════════ */
  function spawnBullet(){
    const g = getAimGeom();
    const dx = g.tx - g.mx, dy = g.ty - g.my;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const b = document.createElement('div');
    b.className = 'bullet';
    b.style.left = g.mx + 'px';
    b.style.top = g.my + 'px';
    b.style.setProperty('--dx', dx + 'px');
    b.style.setProperty('--dy', dy + 'px');
    b.style.setProperty('--angle', (angle + 90) + 'deg');
    b.style.animation = `bulletTravel ${Math.max(.09, Math.min(.28, dist/1700))}s linear forwards`;
    range.appendChild(b);
    bullets.push(b);
    setTimeout(() => { b.remove(); bullets = bullets.filter(x => x !== b); }, 320);
  }

  /* ═══════════════════════════════════════════════════════════════
     ВЫСТРЕЛ
     ═══════════════════════════════════════════════════════════════ */
  function fire(){
    if (!game) return;
    runStats.shotCount++;
    playSfx('shot');

    rifleWrap.classList.remove('recoil');
    void rifleWrap.offsetWidth;
    rifleWrap.classList.add('recoil');
    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');
    spawnBullet();

    const r = range.getBoundingClientRect();
    const tx = aimX / 100 * r.width, ty = aimY / 100 * r.height;
    let hit = null, best = 1e9;
    for (const t of targets){
      const tr = t.el.getBoundingClientRect();
      const cx = tr.left + tr.width / 2 - r.left, cy = tr.top + tr.height / 2 - r.top;
      const dist = Math.hypot(tx - cx, ty - cy);
      const rad = Math.max(tr.width, tr.height) / 2;
      if (dist <= rad && dist < best){ best = dist; hit = t; }
    }
    if (hit) hitTarget(hit); else miss();
  }

  /* ═══════════════════════════════════════════════════════════════
     ULT
     ═══════════════════════════════════════════════════════════════ */
  function ultimate() {
  if (!game || ultHits < 5) return;
  window._ultJustFired = true;
  setTimeout(() => { window._ultJustFired = false; }, 800);
  runStats.ultCount++;
    playSfx('ult');
    ultReadySoundPlayed = false;

    [...targets].forEach(t => {
      const c = getElCenter(t.el);
      shatterTarget(t.el, c.x, c.y);
    });

    let total = 0;
    [...targets].forEach(t => { total += TYPES[t.type].base; removeTarget(t); });
    addScore(total * comboMult() * 3);
    ultHits = 0;
    updateUI();

    const msg = document.getElementById('message');
    msg.textContent = 'ULT ×3';
    msg.className = 'pop';
    setTimeout(() => { msg.textContent = ''; msg.className = ''; }, 600);
  }

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
    aimX = 50; aimY = 40;
    updateRifle();

    homeBtn.classList.remove('hidden');
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
    clearInterval(spawnTimer);
    cancelAnimationFrame(raf);
    laser.classList.add('hidden');
    homeBtn.classList.add('hidden');
    modeBadge.classList.add('hidden');

    if (win) playSfx('win');

    runStats.duration = Math.round((performance.now() - runStats.startTime) / 1000);
    const coinsEarnedLocal = Math.floor(score / COINS_PER_POINTS);

    if (score > personalBest){
      personalBest = Math.floor(score);
      Storage.setPersonalBest(personalBest);
    }

    if (win && !Storage.isInfiniteUnlocked()){
      Storage.unlockInfinite();
    }

    saveToHistory(win);

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

    const finalCoins = (serverResp && typeof serverResp.coins_earned === 'number')
      ? serverResp.coins_earned : coinsEarnedLocal;

    document.getElementById('endTitle').textContent = win ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА';
    document.getElementById('endReason').textContent = win
      ? '10 000 очков достигнуто. Забери награду!'
      : (runStats.mode === 'infinite' ? MAX_MISSES + ' промахов исчерпано.' : 'Игра завершена.');
    document.getElementById('finalScore').textContent = Math.floor(score);

    if (finalCoins > 0){
      const ce = document.getElementById('coinsEarned');
      ce.textContent = '🪙 +' + finalCoins + ' монет';
      ce.classList.remove('hidden');
    }

    const stickerBtn = document.getElementById('stickerBtn');
    if (stickerBtn) stickerBtn.classList.toggle('hidden', !win);

    // ★ Картинка кошки-жены: при проигрыше в бесконечном с комбо ×10+
const catwifeEl = document.getElementById('catwifeImage');
if (catwifeEl) {
  const showCatwife = !win && runStats.mode === 'infinite' && sawTenCombo;
  catwifeEl.classList.toggle('hidden', !showCatwife);
}

endScreen.classList.remove('hidden');
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
    clearInterval(spawnTimer);
    cancelAnimationFrame(raf);

    [...targets].forEach(t => t.el.remove());
    targets = [];
    bullets.forEach(b => b.remove());
    bullets = [];

    laser.classList.add('hidden');
    homeBtn.classList.add('hidden');
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
    if (!game) return;
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

    // ★ Если мишеней 0 и игра идёт — срочно спавним (кроме окна после ULT)
if (game && targets.length === 0 && !window._ultJustFired){
  spawn();
}

if (!Storage.isInfiniteMode() && score >= WIN_SCORE){
  finish(true);
} else {
  updateRifle();
  raf = requestAnimationFrame(loop);
}
  }   // ← ЭТА СКОБКА ЗАКРЫВАЕТ ФУНКЦИЮ loop()



  /* ═══════════════════════════════════════════════════════════════
     ОБРАБОТЧИКИ
     ═══════════════════════════════════════════════════════════════ */
  function bindEvents(){
    range.addEventListener('pointerdown', e => {
      if (!game) return;
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

    homeBtn.addEventListener('pointerdown', e => e.stopPropagation(), true);
    homeBtn.addEventListener('pointerup', e => {
      e.stopPropagation(); e.preventDefault(); exitToMenu();
    });
    homeBtn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault(); exitToMenu();
    });

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
  }

  return {
    init,
    start,
    fire,
    ultimate,
    exitToMenu,
    setVolume,
    isRunning: () => game
  };
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Game.init());
} else {
  Game.init();
}