/* ═══════════════════════════════════════════════════════════════
   ОРУЖИЕ: КРАСКОПУЛЬТ (пейнтбольный маркер)
   • Выстрел — крупный шарик с краской. Каждый новый выстрел другого цвета
     (цвет следующего шарика виден в магазине-бункере и на кольце дула).
   • Шарик попал → ЛОПАЕТСЯ: пятно краски висит 1.5–3 сек.
   • От пятна в стороны разлетаются 3 капли (недалеко). Каждая капля,
     упавшая на мишень, наносит 1 урон — как обычная пуля.
   • Промазал шариком, но капля задела мишень — комбо не сбрасывается.
   Предложенная цена: 2000 монет (см. NEW_WEAPONS.md)
   ═══════════════════════════════════════════════════════════════ */

(function(){

  /* ─── Настройки (крути под баланс) ─── */
  const COOLDOWN_MS  = 340;      // пауза между выстрелами
  const BALL_SPEED   = 1500;     // px/сек
  const DROPS        = 3;        // капель на выстрел
  const DROP_MIN     = 34;       // дальность разлёта капель, px
  const DROP_MAX     = 62;
  const DROP_FLY_MIN = 120;      // время полёта капли, мс
  const DROP_FLY_MAX = 175;
  const STAIN_MIN    = 1500;     // сколько висит пятно, мс
  const STAIN_MAX    = 3000;
  const MAX_STAINS   = 18;       // защита от лишней нагрузки
  /* Может ли капля добить ту же мишень, в которую попал шарик */
  const DROPS_HIT_MAIN_TARGET = false;

  const GOLDEN_ANGLE = 137.508;  // шаг оттенка → цвета всегда разные

  /* ─── Модель (SVG 190×220, ствол смотрит вверх) ─── */
  const MODEL = `
    <svg class="pb-svg" viewBox="0 0 190 220" width="190" height="220"
         data-muzzle-distance="188" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pbSteel" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"  stop-color="#2c323b"/>
          <stop offset=".5" stop-color="#a9b4c2"/>
          <stop offset="1"  stop-color="#39414c"/>
        </linearGradient>
        <linearGradient id="pbBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0"  stop-color="#3a414c"/>
          <stop offset=".55" stop-color="#1b1f26"/>
          <stop offset="1"  stop-color="#0f1217"/>
        </linearGradient>
        <linearGradient id="pbTank" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"  stop-color="#6c7684"/>
          <stop offset=".45" stop-color="#e3e9f1"/>
          <stop offset="1"  stop-color="#5b6572"/>
        </linearGradient>
        <radialGradient id="pbGlass" cx=".38" cy=".3" r=".85">
          <stop offset="0"  stop-color="rgba(255,255,255,.55)"/>
          <stop offset=".45" stop-color="rgba(170,210,255,.16)"/>
          <stop offset="1"  stop-color="rgba(120,170,230,.28)"/>
        </radialGradient>
      </defs>

      <!-- шланг от баллона -->
      <path d="M137 128 C134 112 122 110 114 116" fill="none" stroke="#14171c" stroke-width="3.4" stroke-linecap="round"/>

      <!-- баллон CO₂ -->
      <rect x="126" y="112" width="22" height="78" rx="9" fill="url(#pbTank)" stroke="#20252c"/>
      <rect class="pb-band" x="126" y="128" width="22" height="10"/>
      <rect x="131" y="105" width="12" height="9" rx="2" fill="#555d69" stroke="#20252c"/>

      <!-- ствол -->
      <rect x="87" y="6" width="16" height="110" rx="4" fill="url(#pbSteel)" stroke="#20252c"/>
      <g fill="#0d1014">
        <circle cx="92" cy="26" r="1.7"/><circle cx="98" cy="26" r="1.7"/>
        <circle cx="92" cy="38" r="1.7"/><circle cx="98" cy="38" r="1.7"/>
        <circle cx="92" cy="50" r="1.7"/><circle cx="98" cy="50" r="1.7"/>
        <circle cx="92" cy="62" r="1.7"/><circle cx="98" cy="62" r="1.7"/>
      </g>
      <rect class="pb-tip" x="83" y="0" width="24" height="12" rx="3.5" stroke="#10131a"/>

      <!-- корпус -->
      <rect x="68" y="96" width="54" height="70" rx="11" fill="url(#pbBody)" stroke="#0b0d11"/>
      <rect x="68" y="108" width="54" height="5" fill="#ff7a1a"/>
      <rect x="68" y="118" width="54" height="2.6" fill="#ff7a1a" opacity=".55"/>
      <circle cx="95" cy="142" r="6" fill="#2a2f38" stroke="#0b0d11"/>
      <circle cx="95" cy="142" r="2.4" fill="#ff7a1a"/>

      <!-- рукоять и скоба -->
      <path d="M80 162 L111 162 L114 213 L77 213 Z" fill="#15181d" stroke="#0b0d11"/>
      <g stroke="#2c323b" stroke-width="2">
        <line x1="80" y1="176" x2="111" y2="176"/><line x1="79" y1="188" x2="112" y2="188"/><line x1="78" y1="200" x2="113" y2="200"/>
      </g>
      <path d="M71 168 C58 170 58 192 73 192" fill="none" stroke="#2a2f38" stroke-width="3.2" stroke-linecap="round"/>

      <!-- магазин-бункер с шариками -->
      <rect x="47" y="104" width="25" height="13" rx="3" fill="#2a2f38" stroke="#0b0d11"/>
      <g class="pb-hopper">
        <circle cx="44" cy="96" r="27" fill="#0d1218" opacity=".55"/>
        <g class="pb-hballs">
          <circle class="pb-hb" style="--d:0s"   cx="35" cy="84"  r="7.4" fill="hsl(8 90% 56%)"/>
          <circle class="pb-hb" style="--d:-.5s" cx="52" cy="85"  r="7.4" fill="hsl(48 95% 55%)"/>
          <circle class="pb-hb" style="--d:-1s"  cx="27" cy="99"  r="7.4" fill="hsl(200 92% 52%)"/>
          <circle class="pb-hb" style="--d:-1.5s" cx="43" cy="98" r="7.4" fill="hsl(285 80% 60%)"/>
          <circle class="pb-hb" style="--d:-.2s" cx="60" cy="99"  r="7.4" fill="hsl(135 75% 48%)"/>
          <circle class="pb-hb" style="--d:-.8s" cx="34" cy="111" r="7.4" fill="hsl(330 88% 60%)"/>
          <circle class="pb-hb" style="--d:-1.2s" cx="46" cy="75" r="6.4" fill="hsl(25 95% 55%)"/>
          <circle class="pb-feed" cx="50" cy="111" r="8"/>
        </g>
        <circle cx="44" cy="96" r="27" fill="url(#pbGlass)" stroke="rgba(190,225,255,.75)" stroke-width="1.6"/>
        <ellipse cx="33" cy="80" rx="9" ry="4.6" fill="#fff" opacity=".35" transform="rotate(-32 33 80)"/>
        <rect x="35" y="66" width="18" height="6" rx="2.5" fill="#2a2f38" stroke="#0b0d11"/>
      </g>
    </svg>`;

  /* ═══════════════ состояние и цвета ═══════════════ */
  let lastFire = -1e9;
  let hue = Math.random() * 360;      // оттенок ЗАРЯЖЕННОГО шарика
  let lastDry = 0;
  let stains = [];

  const now = () => performance.now();
  const isOnCooldown = () => now() - lastFire < COOLDOWN_MS;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const hsl = (h, s, l) => 'hsl(' + (((h % 360) + 360) % 360).toFixed(1) + ' ' + s + '% ' + l + '%)';
  const palette = h => ({ c: hsl(h, 92, 56), l: hsl(h, 100, 78), d: hsl(h, 86, 36), f: hsl(h, 96, 62) });

  /* Цвет заряженного шарика → CSS-переменные (бункер, кольцо дула, баллон) */
  function applyLoadedColor(){
    const p = palette(hue);
    const st = document.body.style;
    st.setProperty('--pb-c',   p.c);
    st.setProperty('--pb-c-l', p.l);
    st.setProperty('--pb-c-d', p.d);
  }

  /* ═══════════════ эффекты ═══════════════ */
  function bumpClass(el, cls, ms){
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    setTimeout(function(){ el.classList.remove(cls); }, ms);
  }

  function spawnPuff(range, x, y, p){
    const el = document.createElement('div');
    el.className = 'pb-puff';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.setProperty('--c', p.c);
    range.appendChild(el);
    setTimeout(function(){ el.remove(); }, 420);
  }

  /* Пятно краски: SVG-клякса + брызги + потёки */
  function makeSplat(range, x, y, p, scale, lifeMs, withDrips){
    const R0 = rnd(20, 26);
    const N = 11;
    const pts = [];
    for (let i = 0; i < N; i++){
      const a = (Math.PI * 2 * i) / N + rnd(-.12, .12);
      const r = R0 * rnd(.74, 1.3);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = '';
    const m0 = mid(pts[N - 1], pts[0]);
    d += 'M' + m0[0].toFixed(1) + ' ' + m0[1].toFixed(1);
    for (let i = 0; i < N; i++){
      const nx = pts[(i + 1) % N];
      const m = mid(pts[i], nx);
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) +
           ' ' + m[0].toFixed(1) + ' ' + m[1].toFixed(1);
    }
    d += 'Z';

    let extra = '';
    /* брызги вокруг */
    const sat = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sat; i++){
      const a = rnd(0, Math.PI * 2);
      const dist = R0 * rnd(1.35, 2.1);
      const r = rnd(1.8, 5.2);
      extra += '<circle cx="' + (Math.cos(a) * dist).toFixed(1) + '" cy="' + (Math.sin(a) * dist).toFixed(1) +
               '" r="' + r.toFixed(1) + '"/>';
    }
    /* потёки вниз */
    if (withDrips){
      const nd = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < nd; i++){
        const dx = rnd(-R0 * .6, R0 * .6);
        const h = rnd(9, 26);
        const delay = rnd(.05, .35) * lifeMs / 1000;
        extra += '<g class="pb-drip" style="--dl:' + delay.toFixed(2) + 's;--life:' + (lifeMs / 1000).toFixed(2) + 's">' +
                 '<rect x="' + (dx - 2.4).toFixed(1) + '" y="' + (R0 * .35).toFixed(1) +
                 '" width="4.8" height="' + (h + R0 * .4).toFixed(1) + '" rx="2.4"/>' +
                 '<circle cx="' + dx.toFixed(1) + '" cy="' + (R0 * .75 + h).toFixed(1) + '" r="3.7"/></g>';
      }
    }

    const size = 150 * scale;
    const el = document.createElement('div');
    el.className = 'pb-splat';
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.setProperty('--life', (lifeMs / 1000).toFixed(2) + 's');
    el.style.setProperty('--rot', rnd(-40, 40).toFixed(0) + 'deg');
    el.innerHTML =
      '<svg viewBox="-75 -75 150 150" width="100%" height="100%" overflow="visible">' +
        '<g fill="' + p.c + '" stroke="' + p.d + '" stroke-width="1.6" stroke-linejoin="round">' +
          '<path d="' + d + '"/>' + extra +
        '</g>' +
        '<ellipse cx="' + (-R0 * .32).toFixed(1) + '" cy="' + (-R0 * .36).toFixed(1) + '" rx="' + (R0 * .34).toFixed(1) +
        '" ry="' + (R0 * .19).toFixed(1) + '" fill="#fff" opacity=".34" transform="rotate(-28)"/>' +
      '</svg>';
    range.appendChild(el);

    stains.push(el);
    while (stains.length > MAX_STAINS){
      const old = stains.shift();
      if (old) old.remove();
    }
    setTimeout(function(){
      el.remove();
      stains = stains.filter(function(s){ return s !== el; });
    }, lifeMs + 60);
  }

  function spawnBall(range, g, tx, ty, p, flightS){
    const dx = tx - g.mx, dy = ty - g.my;
    const el = document.createElement('div');
    el.className = 'pb-ball';
    el.style.left = g.mx + 'px';
    el.style.top  = g.my + 'px';
    el.style.setProperty('--c',  p.c);
    el.style.setProperty('--cl', p.l);
    el.style.setProperty('--cd', p.d);
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--dy', dy + 'px');
    el.style.animation = 'pbBallFly ' + flightS.toFixed(3) + 's linear forwards';
    range.appendChild(el);
    setTimeout(function(){ el.remove(); }, flightS * 1000 + 30);
  }

  function spawnDrop(range, x, y, dx, dy, flightMs, p){
    const el = document.createElement('div');
    el.className = 'pb-drop';
    const s = rnd(8, 12);
    el.style.width = el.style.height = s + 'px';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.setProperty('--c',  p.c);
    el.style.setProperty('--cl', p.l);
    el.style.setProperty('--cd', p.d);
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--dy', dy + 'px');
    el.style.animation = 'pbDropFly ' + (flightMs / 1000).toFixed(3) + 's cubic-bezier(.2,.6,.4,1) forwards';
    range.appendChild(el);
    setTimeout(function(){ el.remove(); }, flightMs + 30);
  }

  /* Ближайшая живая мишень, внутри которой лежит точка (как findHit, но в px) */
  function targetAt(G, range, px, py, skip){
    const rr = range.getBoundingClientRect();
    let best = null, bd = 1e9;
    for (const t of G.getTargets()){
      if (t.hp <= 0 || t === skip) continue;
      const tr = t.el.getBoundingClientRect();
      const cx = tr.left + tr.width  / 2 - rr.left;
      const cy = tr.top  + tr.height / 2 - rr.top;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist <= Math.max(tr.width, tr.height) / 2 && dist < bd){ bd = dist; best = t; }
    }
    return best;
  }

  /* ═══════════════ регистрация ═══════════════ */
  Weapons.register('paintball', {

    name: 'Краскопульт',
    price: 2000,
    category: 'weapon',
    model: MODEL,

    onEquip: function(){ applyLoadedColor(); },

    canFire: function(){ return !isOnCooldown(); },

    fire: function(){
      const G = Game._internals;
      if (!G || !G.getGame()) return;
      if (window._laserActive) return;

      if (isOnCooldown()){
        if (now() - lastDry > 260){ lastDry = now(); WeaponFX.sfx.dry(); }
        return;
      }

      const range = document.getElementById('range');
      if (!range) return;
      lastFire = now();

      /* цвет ЭТОГО выстрела, потом заряжаем следующий (другой оттенок) */
      const p = palette(hue);
      document.body.style.setProperty('--pb-fire', p.f);
      hue = (hue + GOLDEN_ANGLE + rnd(-14, 14)) % 360;
      applyLoadedColor();

      G.addShot();
      G.addRecentShot();
      WeaponFX.sfx.pop();

      /* анимации оружия: отдача, вспышка цвета, тряска бункера, новый шарик в подаче */
      const rifleWrap = document.getElementById('rifleWrap');
      const flash     = document.getElementById('muzzleFlash');
      if (rifleWrap){
        rifleWrap.classList.remove('recoil');
        void rifleWrap.offsetWidth;
        rifleWrap.classList.add('recoil');
      }
      if (flash){
        flash.classList.remove('fire');
        void flash.offsetWidth;
        flash.classList.add('fire');
      }
      bumpClass(document.querySelector('#rifle .pb-svg'), 'pb-fired', 360);

      const g = G.getAimGeom();
      spawnPuff(range, g.mx, g.my, p);

      /* летящий шарик */
      const dist    = Math.hypot(g.tx - g.mx, g.ty - g.my);
      const flightS = Math.max(.07, Math.min(.26, dist / BALL_SPEED));
      spawnBall(range, g, g.tx, g.ty, p, flightS);

      /* попадание шариком — как у обычной пули, сразу */
      const aim = G.getAim();
      const mainHit = G.findHit(aim.x, aim.y);
      if (mainHit) G.hitTarget(mainHit);

      /* шарик долетел: пятно + капли */
      setTimeout(function(){
        const GG = Game._internals;
        if (!GG || !GG.getGame()) return;

        const life = rnd(STAIN_MIN, STAIN_MAX);
        makeSplat(range, g.tx, g.ty, p, 1, life, true);
        WeaponFX.sfx.splat();

        const rr = range.getBoundingClientRect();
        const base = rnd(0, Math.PI * 2);
        let pending = DROPS;
        let dropHit = false;

        function dropDone(){
          pending--;
          if (pending === 0 && !mainHit && !dropHit){
            const G3 = Game._internals;
            if (G3 && G3.getGame()) G3.miss();    // ни шарик, ни капли — промах
          }
        }

        for (let i = 0; i < DROPS; i++){
          const a  = base + (Math.PI * 2 * i) / DROPS + rnd(-.45, .45);
          const dd = rnd(DROP_MIN, DROP_MAX);
          let lx = g.tx + Math.cos(a) * dd;
          let ly = g.ty + Math.sin(a) * dd;
          lx = Math.max(8, Math.min(rr.width  - 8, lx));
          ly = Math.max(8, Math.min(rr.height - 8, ly));
          const fly = rnd(DROP_FLY_MIN, DROP_FLY_MAX);

          spawnDrop(range, g.tx, g.ty, lx - g.tx, ly - g.ty, fly, p);

          setTimeout(function(){
            const G2 = Game._internals;
            if (!G2 || !G2.getGame()) return;
            makeSplat(range, lx, ly, p, .36, rnd(1100, 2100), false);
            WeaponFX.sfx.drip();
            const t = targetAt(G2, range, lx, ly, DROPS_HIT_MAIN_TARGET ? null : mainHit);
            if (t){
              dropHit = true;
              G2.hitTarget(t);     // капля = 1 урон, как пуля
            }
            dropDone();
          }, fly);
        }
      }, flightS * 1000);
    },

    isOnCooldown: isOnCooldown,
    getCooldownLeft: function(){ return Math.max(0, COOLDOWN_MS - (now() - lastFire)); },

    reset: function(){
      lastFire = -1e9;
      stains.forEach(function(s){ s.remove(); });
      stains = [];
    }
  });

})();
