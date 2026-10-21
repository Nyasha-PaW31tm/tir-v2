/* ═══════════════════════════════════════════════════════════════
   ОРУЖИЕ: РОГАТКА
   Каждый выстрел заряжен случайным боеприпасом (виден в кожанке рогатки):
   • 🪨 КАМЕНЬ (60%)      — урон как у пули, 3 вида камней. Откат короткий.
   • 🔴 РЕЗИНОВЫЙ ШАРИК (22%) — урон 1, РИКОШЕТИТ ОДИН РАЗ: от края экрана
        или от мишени (промах/попадание — не важно). После рикошета
        может ударить ещё одну мишень.
   • 🧨 ПЕТАРДА «Корсар 5» (18%) — летит в точку прицела и взрывается
        (попал/промазал — всё равно). Все мишени в радиусе взрыва — ВАНШОТ.
        Если взрыв кого-то задел — комбо НЕ сбивается.
   Звуки синтезируются (WeaponFX), mp3 не нужны. Нужен weapon.fx.js ДО этого файла.
   Предложенная цена: 1700 монет (см. инструкцию)
   ═══════════════════════════════════════════════════════════════ */

(function(){

  /* ─── Настройки (крути под баланс) ─── */
  const CD = { stone: 420, ball: 620, cracker: 1150 };  // откат после выстрела, мс
  const P_STONE   = 0.60;     // шанс камня
  const P_BALL    = 0.22;     // шанс шарика (остальное — петарда)
  const STONE_SPEED   = 2000; // px/сек
  const BALL_SPEED    = 1500;
  const CRACKER_SPEED = 1000;
  const BALL_R    = 11;       // радиус шарика (он больше камня)
  const HIT_PAD   = 0.95;     // доля радиуса мишени для попадания шарика
  const BOOM_RADIUS = 92;     // радиус взрыва петарды, px

  /* ─── Тайминги анимации (мс от выстрела) ─── */
  const T_SNAP = 50;          // кожанка «щёлкает» вперёд
  const T_WOBBLE_END = 200;   // дрожь утихла, начинается натяжение
  const T_LOAD = 170;         // в кожанку лёг новый боеприпас

  /* ─── Геометрия модели (viewBox 190×220) ─── */
  const TIP_L = { x: 56,  y: 42 };
  const TIP_R = { x: 134, y: 42 };
  const Y_REL = 52;           // кожанка в момент выстрела
  const Y_PULL = 102;         // кожанка натянута

  const MODEL = `
    <svg class="sl-svg" viewBox="0 0 190 220" width="190" height="220"
         data-muzzle-distance="146" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="slWood" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#3a2110"/>
          <stop offset=".5" stop-color="#9a5f2c"/>
          <stop offset="1" stop-color="#40250f"/>
        </linearGradient>
        <radialGradient id="slRubber" cx=".34" cy=".3" r=".8">
          <stop offset="0" stop-color="#ff9d8f"/>
          <stop offset=".35" stop-color="#ff3d2e"/>
          <stop offset="1" stop-color="#8a0c07"/>
        </radialGradient>
      </defs>

      <!-- рукоять -->
      <path d="M84 217 L106 217 L102 152 L98 124 L92 124 L88 152 Z"
            fill="url(#slWood)" stroke="#1f1208" stroke-width="1.3"/>
      <rect x="86" y="168" width="18" height="6" rx="2" fill="#5a2a14" opacity=".9"/>
      <rect x="86.5" y="180" width="17" height="6" rx="2" fill="#5a2a14" opacity=".9"/>
      <ellipse cx="95" cy="216" rx="12" ry="4" fill="#2a1a0c"/>

      <!-- рогатина (вилка) -->
      <path d="M95 132 C92 102 70 82 56 42" fill="none" stroke="#2a170a" stroke-width="13" stroke-linecap="round"/>
      <path d="M95 132 C98 102 120 82 134 42" fill="none" stroke="#2a170a" stroke-width="13" stroke-linecap="round"/>
      <path d="M95 132 C92 102 70 82 56 42" fill="none" stroke="#a8692f" stroke-width="8" stroke-linecap="round"/>
      <path d="M95 132 C98 102 120 82 134 42" fill="none" stroke="#a8692f" stroke-width="8" stroke-linecap="round"/>
      <path d="M93 128 C90 100 70 80 57 44" fill="none" stroke="#d09a58" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <circle cx="95" cy="130" r="8" fill="#8a5224" stroke="#2a170a" stroke-width="1.2"/>
      <circle cx="56" cy="42" r="6" fill="#3a2a1a" stroke="#14100a"/>
      <circle cx="134" cy="42" r="6" fill="#3a2a1a" stroke="#14100a"/>
      <circle cx="56" cy="42" r="2.4" fill="#c9a45a"/>
      <circle cx="134" cy="42" r="2.4" fill="#c9a45a"/>

      <!-- резинки -->
      <polyline class="sl-band-l" points="56,42 84,100" fill="none" stroke="#e8c27a" stroke-width="3.2" stroke-linecap="round"/>
      <polyline class="sl-band-r" points="134,42 106,100" fill="none" stroke="#e8c27a" stroke-width="3.2" stroke-linecap="round"/>

      <!-- кожанка + боеприпас -->
      <g class="sl-pouch" transform="translate(95 102)">
        <path d="M-14 0 Q-15 -11 -6 -12 L6 -12 Q15 -11 14 0 Q13 10 0 11 Q-13 10 -14 0Z"
              fill="#7a4a24" stroke="#2e1a0a" stroke-width="1.4"/>
        <g class="sl-ammo"></g>
        <path d="M-12 2 Q0 13 12 2 L12 6 Q0 15 -12 6Z" fill="#5e3a1c" stroke="#2e1a0a" stroke-width="1"/>
      </g>
    </svg>`;

  /* ═══════════════ состояние ═══════════════ */
  let lastFire = -1e9;
  let lastCd = CD.stone;
  let nextAmmo = rollAmmo();
  let raf = 0, readyDone = true, stretchDone = true, lastDry = 0;
  let shownKey = '';

  const now = () => performance.now();
  const isOnCooldown = () => now() - lastFire < lastCd;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const easeInOut = k => 0.5 - 0.5 * Math.cos(Math.PI * k);

  function rollAmmo(){
    const r = Math.random();
    if (r < P_STONE) return { type: 'stone', v: Math.floor(Math.random() * 3) };
    if (r < P_STONE + P_BALL) return { type: 'ball' };
    return { type: 'cracker' };
  }

  /* ═══════════════ звуки (синтез, поверх WeaponFX) ═══════════════ */
  if (typeof WeaponFX !== 'undefined'){
    const FX = WeaponFX;
    Object.assign(FX.sfx, {
      sling: function(){
        FX.tone({ type:'triangle', f0:340, f1:120, dur:.17, gain:.32 });
        FX.noise({ dur:.04, filter:'highpass', freq:3000, gain:.16 });
      },
      stretch: function(){
        FX.tone({ type:'sine', f0:130, f1:240, dur:.16, gain:.05 });
      },
      rock: function(){
        FX.tone({ type:'sine', f0:210, f1:70, dur:.09, gain:.36 });
        FX.noise({ dur:.05, filter:'lowpass', freq:1300, gain:.22 });
      },
      boing: function(){
        FX.tone({ type:'sine', f0:560, f1:190, dur:.22, gain:.30 });
        FX.tone({ type:'sine', f0:400, f1:160, dur:.18, gain:.18, delay:.06 });
      },
      fuse: function(){
        FX.noise({ dur:.24, filter:'highpass', freq:4500, gain:.09 });
      },
      boom: function(){
        FX.noise({ dur:.5, filter:'lowpass', freq:900, gain:.7 });
        FX.tone({ type:'sine', f0:150, f1:34, dur:.46, gain:.62 });
        FX.noise({ dur:.12, filter:'highpass', freq:2200, gain:.3 });
      }
    });
  }
  function sfx(n){
    try { if (typeof WeaponFX !== 'undefined' && WeaponFX.sfx[n]) WeaponFX.sfx[n](); } catch(e){}
  }

  /* ═══════════════ вид боеприпаса в кожанке ═══════════════ */
  const STONE_COL = ['#8d9096', '#8a7561', '#60646c'];

  function ammoSVG(a){
    if (a.type === 'stone'){
      const c = STONE_COL[a.v % 3];
      return '<g transform="translate(0,-4)">' +
        '<path d="M-8 2 L-6 -6 L0 -9 L7 -6 L9 1 L5 7 L-4 7Z" fill="' + c + '" stroke="#1c1c1c" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M-4 -4 L1 -7 L4 -3 L-1 -2Z" fill="#fff" opacity=".3"/>' +
        '<circle cx="3" cy="3" r="1.2" fill="#000" opacity=".3"/></g>';
    }
    if (a.type === 'ball'){
      return '<g transform="translate(0,-5)">' +
        '<circle r="10.5" fill="url(#slRubber)" stroke="#5a0805" stroke-width="1"/>' +
        '<path d="M-9 -3 Q0 4 9 -3" fill="none" stroke="#7a0a06" stroke-width="1" opacity=".55"/>' +
        '<ellipse cx="-4" cy="-4.5" rx="3.8" ry="2.1" fill="#fff" opacity=".5" transform="rotate(-30 -4 -4.5)"/></g>';
    }
    return '<g transform="translate(0,-6) rotate(-12)">' +
      '<rect x="-5" y="-10" width="10" height="20" rx="2" fill="#d4281f" stroke="#4a0805" stroke-width="1"/>' +
      '<rect x="-5" y="-5" width="10" height="3" fill="#f2c230"/>' +
      '<rect x="-5" y="3" width="10" height="2.4" fill="#f2c230"/>' +
      '<path d="M0 -10 C4 -14 -3 -16 1 -21" fill="none" stroke="#3fb83a" stroke-width="2" stroke-linecap="round"/>' +
      '<circle class="sl-spark" cx="1" cy="-21.5" r="2.4" fill="#ffe27a"/></g>';
  }

  /* ═══════════════ анимация кожанки ═══════════════ */
  function visualState(t){
    if (t >= lastCd) return { pull: 1, ammo: nextAmmo };
    let pull;
    if (t < T_SNAP) pull = 1 - 1.08 * (t / T_SNAP);                 // 1 → -0.08 (щелчок вперёд)
    else if (t < T_WOBBLE_END){
      const dt = t - T_SNAP;
      pull = -0.08 * Math.exp(-dt / 45) * Math.cos(dt * 0.045);      // дрожь
    } else {
      pull = easeInOut((t - T_WOBBLE_END) / (lastCd - T_WOBBLE_END)); // натяжение
    }
    return { pull: pull, ammo: t >= T_LOAD ? nextAmmo : null };
  }

  function render(st){
    const svg = document.querySelector('#rifle .sl-svg');
    if (!svg) return;
    const py = Y_REL + (Y_PULL - Y_REL) * st.pull;
    const pouch = svg.querySelector('.sl-pouch');
    const bl = svg.querySelector('.sl-band-l');
    const br = svg.querySelector('.sl-band-r');
    const ag = svg.querySelector('.sl-ammo');
    if (pouch) pouch.setAttribute('transform', 'translate(95 ' + py.toFixed(1) + ')');
    if (bl) bl.setAttribute('points', TIP_L.x + ',' + TIP_L.y + ' 84,' + (py - 2).toFixed(1));
    if (br) br.setAttribute('points', TIP_R.x + ',' + TIP_R.y + ' 106,' + (py - 2).toFixed(1));
    const key = st.ammo ? st.ammo.type + (st.ammo.v || 0) : '';
    if (ag && key !== shownKey){
      shownKey = key;
      ag.innerHTML = st.ammo ? ammoSVG(st.ammo) : '';
    }
  }

  function tick(){
    raf = 0;
    const t = now() - lastFire;
    render(visualState(t));
    if (t >= T_WOBBLE_END && !stretchDone){ stretchDone = true; sfx('stretch'); }
    if (t >= lastCd && !readyDone){ readyDone = true; }
    if (t < lastCd + 40) raf = requestAnimationFrame(tick);
  }
  function startLoop(){ if (!raf) raf = requestAnimationFrame(tick); }

  /* ═══════════════ помощники эффектов ═══════════════ */
  function el(cls, html){
    const d = document.createElement('div');
    d.className = cls;
    if (html) d.innerHTML = html;
    return d;
  }

  /* Полёт по ломаной через Web Animations: pts = [{x,y}, …] */
  function fly(range, node, pts, speed, minMs){
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1] || 1;
    const dur = Math.max(minMs || 0, total / speed * 1000);
    node.style.left = '0px';
    node.style.top = '0px';
    range.appendChild(node);
    if (node.animate){
      const frames = pts.map(function(p, i){
        return { transform: 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)',
                 offset: i === pts.length - 1 ? 1 : cum[i] / total };
      });
      node.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
    } else {
      const l = pts[pts.length - 1];
      node.style.transform = 'translate(' + l.x + 'px,' + l.y + 'px)';
    }
    setTimeout(function(){ node.remove(); }, dur + 60);
    return dur;
  }

  function chips(range, x, y, color, n){
    for (let i = 0; i < n; i++){
      const c = el('sl-chip');
      const a = rnd(0, Math.PI * 2), d = rnd(14, 34);
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.setProperty('--c', color);
      c.style.setProperty('--dx', Math.cos(a) * d + 'px');
      c.style.setProperty('--dy', Math.sin(a) * d + 'px');
      range.appendChild(c);
      setTimeout(function(){ c.remove(); }, 460);
    }
  }

  function bounceRing(range, x, y){
    const r = el('sl-bounce');
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    range.appendChild(r);
    setTimeout(function(){ r.remove(); }, 360);
  }

  function boom(range, x, y){
    const b = el('sl-boom');
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.setProperty('--R', BOOM_RADIUS + 'px');
    let sp = '';
    for (let i = 0; i < 12; i++){
      sp += '<i class="sl-b-sp" style="--a:' + (i * 30 + rnd(-10, 10)).toFixed(0) + 'deg;--d:' + rnd(40, BOOM_RADIUS).toFixed(0) + 'px"></i>';
    }
    b.innerHTML = '<i class="sl-b-flash"></i><i class="sl-b-ring"></i>' + sp;
    range.appendChild(b);
    setTimeout(function(){ b.remove(); }, 700);

    for (let i = 0; i < 3; i++){
      const s = el('sl-smoke');
      s.style.left = (x + rnd(-22, 22)) + 'px';
      s.style.top = (y + rnd(-14, 14)) + 'px';
      s.style.animationDelay = (i * 0.07) + 's';
      range.appendChild(s);
      setTimeout(function(){ s.remove(); }, 1300);
    }
    const sc = el('sl-scorch');
    sc.style.left = x + 'px';
    sc.style.top = y + 'px';
    sc.style.setProperty('--R', BOOM_RADIUS + 'px');
    range.appendChild(sc);
    setTimeout(function(){ sc.remove(); }, 1700);

    range.classList.remove('sl-shake');
    void range.offsetWidth;
    range.classList.add('sl-shake');
    setTimeout(function(){ range.classList.remove('sl-shake'); }, 280);
  }

  function stillAlive(GG, t){
    return GG && GG.getGame() && t.hp > 0 && GG.getTargets().indexOf(t) !== -1;
  }

  /* ═══════════════ 🪨 КАМЕНЬ ═══════════════ */
  function fireStone(G, range, g, ammo){
    const o = el('sl-fly');
    o.appendChild(el('sl-stone sl-v' + ammo.v));
    const dur = fly(range, o, [{ x: g.mx, y: g.my }, { x: g.tx, y: g.ty }], STONE_SPEED, 70);

    const aim = G.getAim();
    const hit = G.findHit(aim.x, aim.y);
    if (hit) G.hitTarget(hit); else G.miss();

    setTimeout(function(){
      chips(range, g.tx, g.ty, hit ? '#b8bcc4' : '#a08a6a', hit ? 6 : 4);
      sfx('rock');
    }, dur);
  }

  /* ═══════════════ 🔴 РЕЗИНОВЫЙ ШАРИК (1 рикошет) ═══════════════ */
  function simBall(G, range, g){
    const rr = range.getBoundingClientRect();
    const W = rr.width, H = rr.height, R = BALL_R;
    const circles = [];
    G.getTargets().forEach(function(t){
      if (t.hp <= 0 || !t.el || !t.el.parentNode) return;
      const c = G.getElCenter(t.el);
      const b = t.el.getBoundingClientRect();
      circles.push({ t: t, x: c.x, y: c.y, r: Math.max(b.width, b.height) / 2 * HIT_PAD + R * 0.6 });
    });

    let o = { x: g.mx, y: g.my };
    let ux = g.tx - g.mx, uy = g.ty - g.my;
    const l = Math.hypot(ux, uy) || 1;
    ux /= l; uy /= l;

    const pts = [{ x: o.x, y: o.y }];
    const events = [];
    let acc = 0, bounce = null, skip = null;

    for (let seg = 0; seg < 2; seg++){
      let best = { d: Infinity };

      circles.forEach(function(c){
        if (c.t === skip) return;
        const ocx = c.x - o.x, ocy = c.y - o.y;
        const tca = ocx * ux + ocy * uy;
        if (tca <= 0) return;
        const d2 = ocx * ocx + ocy * ocy - tca * tca;
        if (d2 > c.r * c.r) return;
        const d = tca - Math.sqrt(c.r * c.r - d2);
        if (d > 0.5 && d < best.d) best = { d: d, kind: 't', c: c };
      });

      let wd = Infinity, axis = '';
      if (ux > 1e-6){ const d = (W - R - o.x) / ux; if (d > 0.5 && d < wd){ wd = d; axis = 'x'; } }
      else if (ux < -1e-6){ const d = (R - o.x) / ux; if (d > 0.5 && d < wd){ wd = d; axis = 'x'; } }
      if (uy > 1e-6){ const d = (H - R - o.y) / uy; if (d > 0.5 && d < wd){ wd = d; axis = 'y'; } }
      else if (uy < -1e-6){ const d = (R - o.y) / uy; if (d > 0.5 && d < wd){ wd = d; axis = 'y'; } }
      if (wd < best.d) best = { d: wd, kind: 'w', axis: axis };

      if (!isFinite(best.d)) best = { d: 400, kind: 'w', axis: 'y' };

      const p = { x: o.x + ux * best.d, y: o.y + uy * best.d };
      pts.push(p);
      acc += best.d;
      if (best.kind === 't') events.push({ t: best.c.t, d: acc, x: p.x, y: p.y });
      if (seg === 1) break;                 // второго рикошета нет

      if (best.kind === 't'){
        let nx = p.x - best.c.x, ny = p.y - best.c.y;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        const dot = ux * nx + uy * ny;
        ux -= 2 * dot * nx;
        uy -= 2 * dot * ny;
        skip = best.c.t;
      } else if (best.axis === 'x') ux = -ux;
      else uy = -uy;

      bounce = { x: p.x, y: p.y, d: acc };
      o = p;
    }
    return { pts: pts, events: events, bounce: bounce, total: acc };
  }

  function fireBall(G, range, g){
    const sim = simBall(G, range, g);
    const o = el('sl-fly');
    o.appendChild(el('sl-ball'));
    fly(range, o, sim.pts, BALL_SPEED, 80);

    const ms = d => d / BALL_SPEED * 1000;
    let hits = 0;

    if (sim.bounce){
      setTimeout(function(){
        bounceRing(range, sim.bounce.x, sim.bounce.y);
        sfx('boing');
      }, ms(sim.bounce.d));
    }

    sim.events.forEach(function(ev){
      setTimeout(function(){
        const GG = Game._internals;
        if (!stillAlive(GG, ev.t)) return;
        hits++;
        chips(range, ev.x, ev.y, '#ff6a5a', 5);
        GG.hitTargetNoMiss(ev.t);
      }, ms(ev.d));
    });

    /* шарик закончил путь, никого не задел — промах */
    setTimeout(function(){
      const GG = Game._internals;
      if (!GG || !GG.getGame()) return;
      const last = sim.pts[sim.pts.length - 1];
      chips(range, last.x, last.y, '#ff6a5a', 4);
      if (hits === 0) GG.miss();
    }, ms(sim.total) + 30);
  }

  /* ═══════════════ 🧨 ПЕТАРДА «КОРСАР 5» ═══════════════ */
  function fireCracker(G, range, g){
    sfx('fuse');
    const o = el('sl-fly');
    o.appendChild(el('sl-cracker'));
    const dur = fly(range, o, [{ x: g.mx, y: g.my }, { x: g.tx, y: g.ty }], CRACKER_SPEED, 150);

    /* искры от фитиля по пути */
    const t0 = now();
    const iv = setInterval(function(){
      const k = Math.min(1, (now() - t0) / dur);
      const s = el('sl-tspark');
      s.style.left = (g.mx + (g.tx - g.mx) * k + rnd(-3, 3)) + 'px';
      s.style.top  = (g.my + (g.ty - g.my) * k + rnd(-3, 3)) + 'px';
      range.appendChild(s);
      setTimeout(function(){ s.remove(); }, 340);
      if (k >= 1) clearInterval(iv);
    }, 40);

    setTimeout(function(){
      clearInterval(iv);
      const GG = Game._internals;
      if (!GG || !GG.getGame()) return;

      boom(range, g.tx, g.ty);
      sfx('boom');

      const victims = GG.getTargets().filter(function(t){
        if (t.hp <= 0 || !t.el || !t.el.parentNode) return false;
        const c = GG.getElCenter(t.el);
        return Math.hypot(c.x - g.tx, c.y - g.ty) <= BOOM_RADIUS;
      });

      if (!victims.length){ GG.miss(); return; }

      victims.forEach(function(t, i){
        setTimeout(function(){
          const G2 = Game._internals;
          if (!stillAlive(G2, t)) return;
          t.hp = 1;                      // ВАНШОТ (броня тоже)
          G2.hitTargetNoMiss(t);         // обычные очки/комбо, без сброса
        }, i * 45);
      });
    }, dur);
  }

  /* ═══════════════ регистрация ═══════════════ */
  Weapons.register('slingshot', {

    name: 'Рогатка',
    price: 1700,
    category: 'weapon',
    model: MODEL,

    onEquip: function(){
      shownKey = '\u0000';
      const t = now() - lastFire;
      readyDone = t >= lastCd;
      stretchDone = t >= T_WOBBLE_END;
      render(visualState(t));
      if (t < lastCd) startLoop();
    },

    canFire: function(){ return !isOnCooldown(); },

    fire: function(){
      const G = Game._internals;
      if (!G || !G.getGame()) return;
      if (window._laserActive) return;

      if (isOnCooldown()){
        if (now() - lastDry > 220){ lastDry = now(); WeaponFX.sfx.dry(); }
        return;
      }

      const range = document.getElementById('range');
      if (!range) return;

      const ammo = nextAmmo;
      nextAmmo = rollAmmo();
      lastFire = now();
      lastCd = CD[ammo.type];
      readyDone = false;
      stretchDone = false;
      startLoop();

      G.addShot();
      G.addRecentShot();
      sfx('sling');

      const rifleWrap = document.getElementById('rifleWrap');
      if (rifleWrap){
        rifleWrap.classList.remove('recoil');
        void rifleWrap.offsetWidth;
        rifleWrap.classList.add('recoil');
      }

      const g = G.getAimGeom();
      if (ammo.type === 'stone') fireStone(G, range, g, ammo);
      else if (ammo.type === 'ball') fireBall(G, range, g);
      else fireCracker(G, range, g);
    },

    isOnCooldown: isOnCooldown,
    getCooldownLeft: function(){ return Math.max(0, lastCd - (now() - lastFire)); },

    reset: function(){
      lastFire = -1e9;
      lastCd = CD.stone;
      nextAmmo = rollAmmo();
      readyDone = true;
      stretchDone = true;
      shownKey = '\u0000';
      if (raf){ cancelAnimationFrame(raf); raf = 0; }
      render(visualState(lastCd));
    }
  });

})();
