/* ═══════════════════════════════════════════════════════════════
   ОРУЖИЕ: АРБАЛЕТ
   • Медленная перезарядка (взвод тетивы), зато болт ПРОБИВАЕТ
     до двух мишеней подряд — по линии «дуло → прицел → дальше».
   • Анимации: щелчок тетивы и дрожь плечей, храповик при взводе,
     новый болт ложится на ложе, блик «готов».
   • Звуки синтезируются в WeaponFX (mp3 не нужны).
   Предложенная цена: 1800 монет (см. NEW_WEAPONS.md)
   ═══════════════════════════════════════════════════════════════ */

(function(){

  /* ─── Настройки (крути под баланс) ─── */
  const COOLDOWN_MS = 1700;    // полный цикл: выстрел → взвод → болт на ложе
  const MAX_PIERCE  = 2;       // сколько мишеней пробивает один болт
  const BOLT_SPEED  = 2400;    // px/сек — скорость болта
  const HIT_PAD     = 0.92;    // доля радиуса мишени, засчитываемая как попадание

  /* ─── Тайминги анимации (мс от выстрела) ─── */
  const T_SNAP        = 70;                 // тетива хлопает вперёд
  const T_CRANK_START = 430;                // дрожь утихла, начинается взвод
  const T_CRANK_END   = COOLDOWN_MS - 380;  // тетива у защёлки
  const T_LOAD_END    = COOLDOWN_MS - 70;   // болт лёг на ложе
  const CRANK_TICKS   = 9;

  /* ─── Геометрия модели (viewBox 190×220) ─── */
  const ROOT_L = { x: 84,  y: 69 }, TIP_L0 = { x: 16,  y: 44 };
  const ROOT_R = { x: 106, y: 69 }, TIP_R0 = { x: 174, y: 44 };
  const FLEX_DEG = 11;       // насколько изгибаются плечи при полном взводе
  const NOCK_Y0  = 50;       // тетива в покое
  const NOCK_Y1  = 102;      // тетива взведена
  const BOLT_LEN = 78;

  const MODEL = `
    <svg class="cb-svg" viewBox="0 0 190 220" width="190" height="220"
         data-muzzle-distance="170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cbWood" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"  stop-color="#3a2110"/>
          <stop offset=".45" stop-color="#8f5a2a"/>
          <stop offset="1"  stop-color="#3e2412"/>
        </linearGradient>
        <linearGradient id="cbSteel" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"  stop-color="#3b424d"/>
          <stop offset=".5" stop-color="#b6c0cd"/>
          <stop offset="1"  stop-color="#454c57"/>
        </linearGradient>
      </defs>

      <!-- ложе (приклад) -->
      <path d="M82 214 L108 214 L105 150 L101 108 L89 108 L85 150 Z"
            fill="url(#cbWood)" stroke="#1f1208" stroke-width="1.2"/>
      <ellipse cx="95" cy="176" rx="12" ry="9" fill="#5a3818" opacity=".55"/>
      <rect x="78" y="210" width="34" height="7" rx="2.5" fill="#2a2f38"/>

      <!-- направляющая (желоб для болта) -->
      <rect x="89" y="22" width="12" height="96" rx="2.5"
            fill="url(#cbSteel)" stroke="#20252c" stroke-width="1"/>
      <rect x="93.8" y="24" width="2.4" height="94" fill="#12151a"/>
      <rect x="87" y="20" width="16" height="6" rx="2" fill="#2a2f38"/>

      <!-- плечи -->
      <g class="cb-limb-l">
        <path d="M84 69 C60 70 34 62 16 44" fill="none" stroke="#262b33"
              stroke-width="10" stroke-linecap="round"/>
        <path d="M84 67 C60 68 34 60 17 43" fill="none" stroke="#6b7685"
              stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="16" cy="44" r="5.2" fill="#c9a45a" stroke="#6b4f1a"/>
      </g>
      <g class="cb-limb-r">
        <path d="M106 69 C130 70 156 62 174 44" fill="none" stroke="#262b33"
              stroke-width="10" stroke-linecap="round"/>
        <path d="M106 67 C130 68 156 60 173 43" fill="none" stroke="#6b7685"
              stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="174" cy="44" r="5.2" fill="#c9a45a" stroke="#6b4f1a"/>
      </g>

      <!-- корпус плеч -->
      <rect x="76" y="56" width="38" height="26" rx="6"
            fill="url(#cbSteel)" stroke="#20252c"/>
      <rect x="84" y="62" width="22" height="3" rx="1.5" fill="#c9a45a"/>

      <!-- болт -->
      <g class="cb-bolt">
        <rect x="93.6" y="8" width="2.8" height="66" fill="#dccda8" stroke="#8b7a52" stroke-width=".5"/>
        <polygon points="95,0 99.8,12 95,9.5 90.2,12" fill="#e4eaf2" stroke="#606a78" stroke-width=".8"/>
        <polygon points="93.6,62 87.6,77 93.6,72" fill="#d9463a"/>
        <polygon points="96.4,62 102.4,77 96.4,72" fill="#d9463a"/>
        <rect x="93" y="73" width="4" height="4" fill="#2b2b2b"/>
      </g>

      <!-- тетива -->
      <polyline class="cb-string" points="16,44 95,50 174,44" fill="none"
                stroke="#efe6cf" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>

      <!-- защёлка -->
      <rect x="89.5" y="96" width="11" height="12" rx="2.5" fill="#c9a45a" stroke="#6b4f1a"/>
    </svg>`;

  /* ═══════════════ состояние ═══════════════ */
  let lastFire = -1e9;      // performance.now() последнего выстрела
  let raf = 0;
  let tickIdx = 0;          // сколько щелчков храповика уже прозвучало
  let readyDone = true;
  let lastDry = 0;

  const now = () => performance.now();
  const isOnCooldown = () => now() - lastFire < COOLDOWN_MS;

  const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
  const easeInOut    = k => 0.5 - 0.5 * Math.cos(Math.PI * k);

  /* Что показывать через t мс после выстрела */
  function visualState(t){
    if (t >= COOLDOWN_MS) return { pull: 1, bolt: true, slide: 0 };
    if (t < T_SNAP)       return { pull: 1 - t / T_SNAP, bolt: false, slide: 1 };
    if (t < T_CRANK_START){
      const dt  = t - T_SNAP;
      const amp = 0.10 * Math.exp(-dt / 95);
      return { pull: Math.max(-0.1, amp * Math.sin(dt * 0.12)), bolt: false, slide: 1 };
    }
    if (t < T_CRANK_END){
      const k = (t - T_CRANK_START) / (T_CRANK_END - T_CRANK_START);
      return { pull: easeInOut(k), bolt: false, slide: 1 };
    }
    if (t < T_LOAD_END){
      const k = (t - T_CRANK_END) / (T_LOAD_END - T_CRANK_END);
      return { pull: 1, bolt: true, slide: 1 - easeOutCubic(k) };
    }
    return { pull: 1, bolt: true, slide: 0 };
  }

  function rot(p, root, deg){
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const x = p.x - root.x, y = p.y - root.y;
    return { x: root.x + x * c - y * s, y: root.y + x * s + y * c };
  }

  function render(st){
    const svg = document.querySelector('#rifle .cb-svg');
    if (!svg) return;

    const aL = -FLEX_DEG * st.pull;      // левое плечо: кончик уходит назад
    const aR =  FLEX_DEG * st.pull;
    const limbL = svg.querySelector('.cb-limb-l');
    const limbR = svg.querySelector('.cb-limb-r');
    const str   = svg.querySelector('.cb-string');
    const bolt  = svg.querySelector('.cb-bolt');

    if (limbL) limbL.setAttribute('transform', 'rotate(' + aL + ' ' + ROOT_L.x + ' ' + ROOT_L.y + ')');
    if (limbR) limbR.setAttribute('transform', 'rotate(' + aR + ' ' + ROOT_R.x + ' ' + ROOT_R.y + ')');

    const tl = rot(TIP_L0, ROOT_L, aL);
    const tr = rot(TIP_R0, ROOT_R, aR);
    const nockY = NOCK_Y0 + (NOCK_Y1 - NOCK_Y0) * st.pull;
    if (str){
      str.setAttribute('points',
        tl.x.toFixed(1) + ',' + tl.y.toFixed(1) + ' 95,' + nockY.toFixed(1) + ' ' +
        tr.x.toFixed(1) + ',' + tr.y.toFixed(1));
    }

    if (bolt){
      if (!st.bolt){
        bolt.setAttribute('opacity', '0');
      } else {
        const tipY = nockY - BOLT_LEN + 1;
        const s = st.slide;
        bolt.setAttribute('opacity', (1 - s * 0.9).toFixed(2));
        bolt.setAttribute('transform',
          'translate(' + (s * 34).toFixed(1) + ' ' + (tipY + s * 14).toFixed(1) + ') ' +
          'rotate(' + (s * 18).toFixed(1) + ' 95 40)');
      }
    }
  }

  function glint(){
    const bolt = document.querySelector('#rifle .cb-bolt');
    if (!bolt) return;
    bolt.classList.remove('cb-glint');
    void bolt.getBoundingClientRect();
    bolt.classList.add('cb-glint');
    setTimeout(function(){ bolt.classList.remove('cb-glint'); }, 520);
  }

  function tick(){
    raf = 0;
    const t  = now() - lastFire;
    const st = visualState(t);
    render(st);

    /* храповик во время взвода */
    if (t >= T_CRANK_START && t < T_CRANK_END){
      const k = (t - T_CRANK_START) / (T_CRANK_END - T_CRANK_START);
      const want = Math.floor(k * CRANK_TICKS);
      while (tickIdx < want){ tickIdx++; WeaponFX.sfx.crank(); }
    }
    /* болт лёг — «готов» */
    if (t >= T_LOAD_END && !readyDone){
      readyDone = true;
      WeaponFX.sfx.ready();
      glint();
    }

    if (t < COOLDOWN_MS + 40) raf = requestAnimationFrame(tick);
  }

  function startLoop(){
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* ═══════════════ эффекты ═══════════════ */
  function spawnBolt(range, g, ux, uy, len){
    const b = document.createElement('div');
    b.className = 'cb-bolt-fly';
    const angle = Math.atan2(uy, ux) * 180 / Math.PI;
    b.style.left = (g.mx + ux * 14) + 'px';
    b.style.top  = (g.my + uy * 14) + 'px';
    b.style.setProperty('--dx', (ux * len) + 'px');
    b.style.setProperty('--dy', (uy * len) + 'px');
    b.style.setProperty('--angle', (angle + 90) + 'deg');
    const dur = len / BOLT_SPEED;
    b.style.animation = 'bulletTravel ' + dur.toFixed(3) + 's linear forwards';
    range.appendChild(b);
    setTimeout(function(){ b.remove(); }, dur * 1000 + 80);
  }

  function spawnPierce(range, x, y){
    const r = document.createElement('div');
    r.className = 'cb-pierce';
    r.style.left = x + 'px';
    r.style.top  = y + 'px';
    range.appendChild(r);
    setTimeout(function(){ r.remove(); }, 450);
  }

  /* ═══════════════ регистрация ═══════════════ */
  Weapons.register('crossbow', {

    name: 'Арбалет',
    price: 1800,
    category: 'weapon',
    model: MODEL,

    onEquip: function(){
      /* если переключились посреди взвода — состояние восстановится по времени */
      const t = now() - lastFire;
      readyDone = t >= T_LOAD_END;
      tickIdx = t >= T_CRANK_START
        ? Math.min(CRANK_TICKS, Math.floor(((t - T_CRANK_START) / (T_CRANK_END - T_CRANK_START)) * CRANK_TICKS))
        : 0;
      render(visualState(t));
      if (t < COOLDOWN_MS) startLoop();
    },

    canFire: function(){ return !isOnCooldown(); },

    fire: function(){
      const G = Game._internals;
      if (!G || !G.getGame()) return;
      if (window._laserActive) return;

      /* ещё взводим — сухой щелчок (не чаще раза в 220 мс) */
      if (isOnCooldown()){
        if (now() - lastDry > 220){ lastDry = now(); WeaponFX.sfx.dry(); }
        return;
      }

      const range = document.getElementById('range');
      if (!range) return;

      lastFire  = now();
      readyDone = false;
      tickIdx   = 0;
      startLoop();

      G.addShot();
      G.addRecentShot();
      WeaponFX.sfx.twang();

      const rifleWrap = document.getElementById('rifleWrap');
      if (rifleWrap){
        rifleWrap.classList.remove('recoil');
        void rifleWrap.offsetWidth;
        rifleWrap.classList.add('recoil');
      }

      /* луч: дуло → прицел → дальше */
      const g  = G.getAimGeom();
      const rr = range.getBoundingClientRect();
      let ux = g.tx - g.mx, uy = g.ty - g.my;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul; uy /= ul;

      /* до края поля + запас, чтобы болт улетел за экран */
      let tExit = 1e9;
      if (ux > 1e-6)  tExit = Math.min(tExit, (rr.width  - g.mx) / ux);
      if (ux < -1e-6) tExit = Math.min(tExit, (0         - g.mx) / ux);
      if (uy > 1e-6)  tExit = Math.min(tExit, (rr.height - g.my) / uy);
      if (uy < -1e-6) tExit = Math.min(tExit, (0         - g.my) / uy);
      const len = Math.max(80, tExit) + 70;

      spawnBolt(range, g, ux, uy, len);

      /* кого пробьёт: ближайшие к дулу, лежащие на луче */
      const cands = [];
      for (const t of G.getTargets()){
        if (t.hp <= 0) continue;
        const tr = t.el.getBoundingClientRect();
        const cx = tr.left + tr.width  / 2 - rr.left;
        const cy = tr.top  + tr.height / 2 - rr.top;
        const rad = Math.max(tr.width, tr.height) / 2 * HIT_PAD;
        const px = cx - g.mx, py = cy - g.my;
        const along = px * ux + py * uy;            // расстояние вдоль луча
        if (along < 0) continue;
        const perp = Math.abs(px * uy - py * ux);   // расстояние от луча
        if (perp <= rad) cands.push({ t: t, along: along, cx: cx, cy: cy });
      }
      cands.sort(function(a, b){ return a.along - b.along; });
      const victims = cands.slice(0, MAX_PIERCE);

      if (!victims.length){
        G.miss();
        return;
      }

      victims.forEach(function(v){
        setTimeout(function(){
          const GG = Game._internals;
          if (!GG || !GG.getGame()) return;
          if (GG.getTargets().indexOf(v.t) === -1) return;   // уже убрана
          const c = GG.getElCenter(v.t.el);
          spawnPierce(range, c.x, c.y);
          WeaponFX.sfx.thunk();
          GG.hitTargetNoMiss(v.t);
        }, (v.along / BOLT_SPEED) * 1000);
      });
    },

    isOnCooldown: isOnCooldown,
    getCooldownLeft: function(){ return Math.max(0, COOLDOWN_MS - (now() - lastFire)); },

    reset: function(){
      lastFire = -1e9;
      readyDone = true;
      tickIdx = 0;
      if (raf){ cancelAnimationFrame(raf); raf = 0; }
      render(visualState(COOLDOWN_MS));
    }
  });

})();
