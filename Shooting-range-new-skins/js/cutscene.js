/* ═══════════════════════════════════════════════════════════════
   CUTSCENE.JS — катсцена МЛРС (canvas, без внешних ассетов)

   ОДИН ТАЙМЛАЙН (TL) управляет и картинкой, и звуком:
   выстрелы, пуски ракет, вспышки и тряска камеры берутся из TL.SHOTS,
   поэтому они физически не могут разойтись со звуком.

   Тайминги звука — те же, что были в игре:
     engine 0 · mechanism 2000 · выстрелы 4480…5740 · конец 7000 мс

   Подключение: <script src="js/cutscene.js"></script> до ult.mlrs.js
   API:  MLRSCutscene.play(overlayEl)  → Promise (резолвится в конце)
         MLRSCutscene.stop()           → прервать
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ─────────────────────────────────────────────────────────────
   ТАЙМЛАЙН (мс) — ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ЖИВУТ ТАЙМИНГИ
   ───────────────────────────────────────────────────────────── */
const TL = {
  DURATION: 7000,
  ENGINE: 0,                         // звук двигателя
  MECH: 2000,                        // звук гидравлики (длится ~2.7 с)
  ARRIVE: { main: 1540, back: 1750 },// машины остановились
  JACKS:  [2000, 2650],              // выпуск упоров
  RAISE:  [2100, 4450],              // подъём пусковой (идёт под звук механизма)
  FADE:   [6600, 7000],              // затемнение в конце
  SHOTS: [                           // v — машина, i — труба (сверху вниз)
    { t: 4480, v: 'main', i: 0 }, { t: 4690, v: 'back', i: 0 },
    { t: 4830, v: 'main', i: 1 }, { t: 5040, v: 'back', i: 1 },
    { t: 5180, v: 'main', i: 2 }, { t: 5390, v: 'back', i: 2 },
    { t: 5530, v: 'main', i: 3 }, { t: 5740, v: 'back', i: 3 }
  ]
};

const ELEV = 0.74;                   // угол возвышения пусковой (~42°)
const PIV  = { x: -30, y: -44 };     // ось качания пусковой (в координатах машины)
const AUDIO_BASE = { engine: 0.8, mech: 0.9, shot: 1.0 };

/* ─────────────────────────────────────────────────────────────
   УТИЛИТЫ
   ───────────────────────────────────────────────────────────── */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, u) => a + (b - a) * u;
const easeOut   = u => 1 - Math.pow(1 - u, 3);
const easeInOut = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const prog = (t, a, b) => clamp((t - a) / (b - a));

function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function mkCanvas(w, h){
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

function rr(c, x, y, w, h, r){           // roundRect без зависимости от браузера
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}

function vgrad(c, y0, y1, stops){
  const g = c.createLinearGradient(0, y0, 0, y1);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  return g;
}

/* ─────────────────────────────────────────────────────────────
   СОСТОЯНИЕ
   ───────────────────────────────────────────────────────────── */
let W = 0, H = 0, S = 1, DPR = 1;
let host = null, cv = null, ctx = null;
let bg = null, vig = null, clouds = [], spr = {}, vc = {};
let geo = null, puffs = [], rockets = [];
let raf = 0, startT = 0, running = false, resolveFn = null, safety = 0;
let audio = null, audioEvents = [], audioNext = 0;

const rowY = i => -8.25 + i * 5.5;       // центр трубы i в системе пусковой

/* ─────────────────────────────────────────────────────────────
   РАСКЛАДКА
   ───────────────────────────────────────────────────────────── */
function layout(){
  S = Math.min(W, H * 0.8) / 100;     // в альбомной ориентации машины меньше — больше неба
  const mk = 0.60 * S, bk = mk * 0.78;
  const Lm = 100 * mk, Lb = 100 * bk;
  const cxm = W - 56 * mk - W * 0.025;      // правый край (бампер) внутри кадра

  geo = {
    hy: H * 0.47, roadTop: H * 0.575, roadBot: H * 0.80,
    main: { key: 'main', k: mk, y: H * 0.768, cx: cxm,            x0: -Lm * 0.6, arrive: TL.ARRIVE.main, len: Lm },
    back: { key: 'back', k: bk, y: H * 0.628, cx: cxm - Lm * 0.40, x0: -Lb * 0.6, arrive: TL.ARRIVE.back, len: Lb }
  };

  const xl = cxm - 52 * mk;               // левый край основной машины
  geo.crew = [
    { fx: xl - 3.0 * S,  y: geo.main.y + 1.2 * S, run: [1500, 2300] },
    { fx: xl - 10.5 * S, y: geo.main.y + 3.2 * S, run: [1650, 2450] },
    { fx: xl - 18.0 * S, y: geo.main.y + 0.6 * S, run: [1800, 2600] }
  ];
}

/* ─────────────────────────────────────────────────────────────
   СПРАЙТЫ (мягкие круги для дыма / огня / пыли)
   ───────────────────────────────────────────────────────────── */
function makeSprites(){
  function soft(r, g, b, core){
    const s = 64, c = mkCanvas(s, s), x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0,   `rgba(${r},${g},${b},${core})`);
    gr.addColorStop(.35, `rgba(${r},${g},${b},${core * .55})`);
    gr.addColorStop(.7,  `rgba(${r},${g},${b},${core * .16})`);
    gr.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, s, s);
    return c;
  }
  spr.smoke  = soft(214, 200, 190, .62);
  spr.smokeD = soft(70, 66, 66, .7);
  spr.dust   = soft(214, 172, 120, .62);

  const s = 64, f = mkCanvas(s, s), x = f.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,   'rgba(255,255,240,1)');
  g.addColorStop(.18, 'rgba(255,226,140,.95)');
  g.addColorStop(.45, 'rgba(255,140,40,.6)');
  g.addColorStop(1,   'rgba(220,40,10,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  spr.fire = f;
}

/* ─────────────────────────────────────────────────────────────
   ФОН (рисуется один раз): небо, солнце, горы, дорога, земля
   ───────────────────────────────────────────────────────────── */
function ridge(c, base, amp, c0, c1, seed, n){
  const R = rng(seed);
  const p = [R() * 6, R() * 6, R() * 6, R() * 6];
  const gr = c.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(0, base + 40);
  for (let x = 0; x <= W + 3; x += 3){
    const u = x / W * Math.PI * 2;
    const h = .5 + .5 * (.5 * Math.sin(u * n + p[0]) + .3 * Math.sin(u * n * 2.3 + p[1]) +
                         .15 * Math.sin(u * n * 5.1 + p[2])) + (R() - .5) * .05;
    c.lineTo(x, base - amp * clamp(h, 0, 1.2));
  }
  c.lineTo(W, base + 40); c.closePath(); c.fill();
}

function buildBG(){
  bg = mkCanvas(W * DPR, H * DPR);
  const c = bg.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const hy = geo.hy, R = rng(21);

  /* небо */
  c.fillStyle = vgrad(c, 0, hy + 6, [
    [0, '#1d3868'], [.32, '#46659a'], [.60, '#cf8a7e'], [.85, '#f5b56c'], [1, '#ffdca0']
  ]);
  c.fillRect(0, 0, W, hy + 6);

  /* солнце */
  const sx = W * .77, sy = hy - H * .035;
  let g = c.createRadialGradient(sx, sy, 0, sx, sy, W * .66);
  g.addColorStop(0,   'rgba(255,236,176,.95)');
  g.addColorStop(.10, 'rgba(255,196,116,.60)');
  g.addColorStop(.35, 'rgba(255,140,96,.20)');
  g.addColorStop(1,   'rgba(255,120,90,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, hy + 6);
  c.fillStyle = '#fff4d2'; c.beginPath(); c.arc(sx, sy, W * .042, 0, 7); c.fill();

  /* горы: дальние → ближние */
  ridge(c, hy + 4, H * .095, '#6f6490', '#b48298', 5, 1.4);
  ridge(c, hy + 5, H * .062, '#4b4268', '#86597a', 9, 2.1);
  ridge(c, hy + 6, H * .030, '#35304f', '#5d4466', 14, 3.6);

  /* дымка у горизонта */
  c.fillStyle = vgrad(c, hy - H * .05, hy + H * .05, [
    [0, 'rgba(255,200,150,0)'], [.55, 'rgba(255,200,150,.30)'], [1, 'rgba(255,200,150,0)']
  ]);
  c.fillRect(0, hy - H * .05, W, H * .10);

  /* земля */
  c.fillStyle = vgrad(c, hy, H, [[0, '#caa070'], [.28, '#a87a4e'], [1, '#4e3826']]);
  c.fillRect(0, hy + 3, W, H - hy);
  for (let i = 0; i < 1400; i++){
    const y = hy + 6 + Math.pow(R(), 1.5) * (H - hy), d = (y - hy) / (H - hy);
    c.fillStyle = R() < .5 ? 'rgba(40,24,10,.10)' : 'rgba(255,220,160,.07)';
    c.fillRect(R() * W, y, 1 + R() * 5 * (.3 + d), 1 + R() * 1.6);
  }
  /* сухая трава на обочине */
  for (let i = 0; i < 260; i++){
    const y = geo.roadBot + 6 + R() * (H - geo.roadBot);
    const x = R() * W, h = (3 + R() * 6) * S * .35;
    c.strokeStyle = R() < .5 ? 'rgba(110,92,48,.7)' : 'rgba(150,120,60,.55)';
    c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - .5) * 3, y - h); c.stroke();
  }

  /* дорога */
  const rt = geo.roadTop, rb = geo.roadBot;
  c.fillStyle = vgrad(c, rt, rb, [[0, '#58565e'], [1, '#2c2b32']]);
  c.fillRect(0, rt, W, rb - rt);
  for (let i = 0; i < 900; i++){
    c.fillStyle = R() < .5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)';
    c.fillRect(R() * W, rt + R() * (rb - rt), 1 + R() * 3, 1);
  }
  c.fillStyle = 'rgba(255,230,190,.30)'; c.fillRect(0, rt, W, 2);
  c.fillStyle = 'rgba(0,0,0,.35)';       c.fillRect(0, rb, W, 3);
  c.fillStyle = 'rgba(236,214,150,.55)';
  const dl = 3.4 * S, dy = (rt + rb) / 2 - 1.2;
  for (let x = -dl; x < W; x += dl * 2) c.fillRect(x, dy, dl, 2.4);

  /* передний план: тёмные кусты */
  for (let i = 0; i < 26; i++){
    const x = (i < 13 ? R() * .22 : .78 + R() * .22) * W, y = H - R() * H * .035;
    const r = (6 + R() * 12) * S * .4;
    c.fillStyle = `rgba(${28 + R() * 16 | 0},${22 + R() * 12 | 0},${16},.95)`;
    c.beginPath(); c.ellipse(x, y, r * 1.7, r, 0, 0, 7); c.fill();
  }

  /* виньетка */
  vig = mkCanvas(W * DPR, H * DPR);
  const v = vig.getContext('2d'); v.setTransform(DPR, 0, 0, DPR, 0, 0);
  const vg = v.createRadialGradient(W / 2, H * .52, Math.min(W, H) * .25, W / 2, H * .52, Math.max(W, H) * .78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,16,.62)');
  v.fillStyle = vg; v.fillRect(0, 0, W, H);

  /* облака */
  clouds = [];
  [[.10, .07, .46, 31], [.52, .17, .34, 32], [.80, .27, .30, 33], [.30, .33, .26, 34]].forEach(d => {
    const cw = W * d[2], ch = cw * .26, cc = mkCanvas(cw * DPR, ch * DPR), x = cc.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    const Rr = rng(d[3]);
    for (let i = 0; i < 18; i++){
      const px = cw * (.08 + Rr() * .84), py = ch * (.46 + Rr() * .16), pr = ch * (.16 + Rr() * .26);
      const gg = x.createRadialGradient(px, py - pr * .25, 0, px, py, pr);
      gg.addColorStop(0,  'rgba(255,238,224,.95)');
      gg.addColorStop(.6, 'rgba(244,170,140,.62)');
      gg.addColorStop(1,  'rgba(220,120,120,0)');
      x.fillStyle = gg; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill();
    }
    clouds.push({ c: cc, w: cw, h: ch, x: d[0] * W, y: d[1] * H, sp: .6 + Rr() * 1.4 });
  });
}

/* ─────────────────────────────────────────────────────────────
   СОСТОЯНИЕ МАШИНЫ в момент t (чистая функция времени)
   ───────────────────────────────────────────────────────────── */
function veh(key, t){
  const g = geo[key], k = g.k, ph = key === 'back' ? 1.7 : 0;
  const u = prog(t, 0, g.arrive), x = lerp(g.x0, g.cx, 1 - (1 - u) * (1 - u));
  const sp = 2 * (1 - u), moving = Math.min(1, sp);

  let y = g.y, tilt = 0;
  y += (Math.sin(t * .034 + ph) * .45 + Math.sin(t * .057 + ph * 2) * .3) * k * moving;
  if (t < TL.MECH + 1300) y += Math.sin(t * .09 + ph) * .12 * k * (1 - moving * .5);
  tilt += Math.sin(t * .011 + ph) * .003 * moving;
  if (u < 1) tilt += .012 * Math.sin(Math.PI * clamp((u - .55) / .45));   // клевок при торможении

  let rec = 0;                                                            // отдача от своих пусков
  for (const s of TL.SHOTS){
    if (s.v !== key) continue;
    const d = t - s.t;
    if (d >= 0 && d < 1200) rec += Math.exp(-d / 190) * Math.cos(d / 55);
  }
  y += rec * k; tilt -= rec * .006;

  const r0 = TL.RAISE[0] + (key === 'back' ? 150 : 0);
  let pod = -ELEV * easeInOut(prog(t, r0, TL.RAISE[1]));
  if (t > TL.RAISE[1]) pod += Math.sin((t - TL.RAISE[1]) / 70) * Math.exp(-(t - TL.RAISE[1]) / 200) * .012;
  pod -= rec * .004;

  const jo = key === 'back' ? 120 : 0;
  const jack = easeOut(prog(t, TL.JACKS[0] + jo, TL.JACKS[1] + jo));

  return { x, y, tilt, pod, jack, rot: (x - g.x0) / (11 * k), k, sp, rec };
}

function vpt(v, lx, ly){                 // координаты машины → мир
  const c = Math.cos(v.tilt), s = Math.sin(v.tilt);
  return { x: v.x + (lx * c - ly * s) * v.k, y: v.y + (lx * s + ly * c) * v.k };
}
function ppt(v, px, py){                 // координаты пусковой → мир
  const c = Math.cos(v.pod), s = Math.sin(v.pod);
  return vpt(v, PIV.x + px * c - py * s, PIV.y + px * s + py * c);
}

/* ─────────────────────────────────────────────────────────────
   ЧАСТИЦЫ: всё посчитано заранее (позиция = функция возраста)
   ───────────────────────────────────────────────────────────── */
function buildPuffs(){
  puffs = []; rockets = [];
  const R = rng(7);

  for (const key of ['back', 'main']){
    const g = geo[key], k = g.k, layer = key === 'back' ? 0 : 1;

    /* пыль из-под колёс при заезде */
    for (let t0 = 0; t0 < 1900; t0 += 34){
      const v = veh(key, t0), u = prog(t0, 0, g.arrive), sp = 2 * (1 - u);
      if (sp < .12) continue;
      const p = vpt(v, -44 + R() * 12, -1);
      puffs.push({ t0, x: p.x, y: p.y - R() * 2 * k, vx: -S * (8 + R() * 10) * Math.min(sp, 2), vy: -S * (1 + R() * 3),
        drag: 2.2, rise: S * 1.5, r0: 1.5 * k, r1: (9 + R() * 8) * k, life: 1 + R() * .5,
        a: Math.min(.5, .16 * sp + .1), spr: 'dust', layer });
    }
    /* выхлоп */
    for (let t0 = 0; t0 < 3300; t0 += 70){
      const v = veh(key, t0), p = vpt(v, 18, -63);
      puffs.push({ t0, x: p.x, y: p.y, vx: -S * (4 + R() * 4), vy: -S * (6 + R() * 5),
        drag: 1.2, rise: S * 2, r0: 1.4 * k, r1: (5 + R() * 4) * k, life: 1 + R() * .5,
        a: t0 < 1700 ? .5 : .28, spr: 'smokeD', layer });
    }
    /* дым и пыль при пусках */
    for (const sh of TL.SHOTS.filter(s => s.v === key)){
      const v = veh(key, sh.t), m = ppt(v, 54, rowY(sh.i)), b = ppt(v, -12, 8);
      const dx = Math.cos(v.pod), dy = Math.sin(v.pod), lay = key === 'back' ? 1 : 2;
      for (let i = 0; i < 6; i++)
        puffs.push({ t0: sh.t + i * 10, x: m.x, y: m.y, vx: dx * S * (10 + R() * 26), vy: dy * S * (10 + R() * 26),
          drag: 3, rise: S * 3, r0: 3 * k, r1: (13 + R() * 10) * k, life: 2.2 + R() * 1.2, a: .62, spr: 'smoke', layer: lay });
      for (let i = 0; i < 5; i++)
        puffs.push({ t0: sh.t + i * 12, x: b.x, y: b.y, vx: -dx * S * (20 + R() * 16), vy: -dy * S * (18 + R() * 12) + S * 4,
          drag: 3.2, rise: S * 2.2, r0: 3 * k, r1: (14 + R() * 12) * k, life: 1.9 + R(), a: .42, spr: i % 2 ? 'dust' : 'smoke', layer: lay });
      for (let i = 0; i < 5; i++)
        puffs.push({ t0: sh.t + i * 15, x: v.x + (-48 + R() * 44) * k, y: g.y - R() * k, vx: (R() < .5 ? -1 : 1) * S * (8 + R() * 18),
          vy: -S * (1 + R() * 3), drag: 2.4, rise: S * 1.2, r0: 4 * k, r1: (10 + R() * 9) * k, life: 1.7 + R() * .6,
          a: .6, spr: 'dust', layer: lay });

      rockets.push({ sh, k, a: v.pod, p0: ppt(v, 38, rowY(sh.i)), mz: m, gx: v.x - 14 * k, gy: g.y, key });
    }
  }
}

function drawPuffs(c, t, layer){
  for (const p of puffs){
    if (p.layer !== layer) continue;
    const age = (t - p.t0) / 1000;
    if (age < 0 || age > p.life) continue;
    const u = age / p.life, q = age / (1 + p.drag * age);
    const r = p.r0 + (p.r1 - p.r0) * easeOut(u);
    c.globalAlpha = p.a * Math.pow(1 - u, 1.4) * clamp(age / .05);
    c.drawImage(spr[p.spr], p.x + p.vx * q - r, p.y + p.vy * q - p.rise * age * age * .5 - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
}

/* ─────────────────────────────────────────────────────────────
   МАШИНА
   ───────────────────────────────────────────────────────────── */
function vehicleBody(c, v, t, key){
  const k = v.k;
  c.save(); c.translate(v.x, v.y); c.rotate(v.tilt); c.scale(k, k);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const edge = 'rgba(8,10,6,.55)';

  /* упоры */
  if (v.jack > 0){
    const ext = v.jack * 22;
    c.fillStyle = '#2a2d26'; c.fillRect(-52.6, -23, 3.2, ext);
    c.fillStyle = '#4a4f47'; c.fillRect(-52.6, -23, 1.2, ext);
    c.fillStyle = '#1c1e1a'; rr(c, -55, -23 + ext - 1, 8, 2.4, 1); c.fill();
  }

  /* колёса */
  const WX = [-37, -15, 11, 33];
  WX.forEach((wx, i) => {
    const jit = Math.sin(t * .05 + i * 1.7) * .5 * Math.min(1, v.sp);
    c.save(); c.translate(wx, -11 + jit);
    c.fillStyle = '#15171a'; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
    c.strokeStyle = '#25282c'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 9.4, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,196,140,.30)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 10.4, -1.0, -.1); c.stroke();
    c.rotate(v.rot);
    for (let a = 0; a < 6; a++){
      c.strokeStyle = '#32363b'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a * 1.047) * 8.6, Math.sin(a * 1.047) * 8.6); c.stroke();
    }
    const hg = c.createRadialGradient(-1, -1, 0, 0, 0, 5.4);
    hg.addColorStop(0, '#9aa0a8'); hg.addColorStop(1, '#4a4f56');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 5.2, 0, 7); c.fill();
    c.fillStyle = '#1b1d20';
    for (let a = 0; a < 6; a++){ c.beginPath(); c.arc(Math.cos(a * 1.047) * 3.2, Math.sin(a * 1.047) * 3.2, .8, 0, 7); c.fill(); }
    c.restore();
  });

  /* рама */
  c.fillStyle = vgrad(c, -28, -16, [[0, '#566340'], [1, '#2f3925']]);
  rr(c, -51, -28, 102, 11, 2.2); c.fill();
  c.strokeStyle = edge; c.lineWidth = .6; c.stroke();

  /* крылья */
  c.fillStyle = '#4b5835';
  WX.forEach(wx => {
    c.beginPath(); c.arc(wx, -11, 14.2, Math.PI, 0); c.arc(wx, -11, 11.6, 0, Math.PI, true); c.closePath(); c.fill();
  });

  /* ящики и палуба */
  c.fillStyle = '#3b4730'; rr(c, -49, -36, 40, 9, 1.5); c.fill(); c.strokeStyle = edge; c.stroke();
  c.fillStyle = '#323d29'; rr(c, -8, -33, 29, 6, 1.2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .5;
  for (let x = -40; x < -10; x += 9){ c.beginPath(); c.moveTo(x, -36); c.lineTo(x, -27); c.stroke(); }

  /* кабина */
  c.beginPath();
  c.moveTo(21, -28); c.lineTo(21, -56); c.lineTo(40, -56); c.quadraticCurveTo(47, -55, 49, -45);
  c.lineTo(51.5, -34); c.lineTo(51.5, -28); c.closePath();
  c.fillStyle = vgrad(c, -56, -28, [[0, '#71814f'], [.55, '#566339'], [1, '#3d482c']]);
  c.fill(); c.strokeStyle = edge; c.lineWidth = .7; c.stroke();
  c.strokeStyle = 'rgba(255,214,160,.55)'; c.lineWidth = .9;
  c.beginPath(); c.moveTo(22, -55.4); c.lineTo(40, -55.4); c.stroke();

  /* стёкла */
  const glass = vgrad(c, -52, -42, [[0, '#2a4258'], [1, '#101c28']]);
  c.fillStyle = glass; rr(c, 24, -52, 9.5, 10, 1.4); c.fill();
  c.beginPath(); c.moveTo(35.5, -52); c.lineTo(41.5, -52); c.quadraticCurveTo(46.5, -51, 48, -43); c.lineTo(35.5, -43); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.20)';
  c.beginPath(); c.moveTo(26, -52); c.lineTo(30, -52); c.lineTo(26, -43); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(38, -52); c.lineTo(42, -52); c.lineTo(37, -43); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = .6;
  c.beginPath(); c.moveTo(34.4, -28); c.lineTo(34.4, -53); c.stroke();
  c.fillStyle = '#20241a'; rr(c, 30.4, -39, 3, 1.2, .5); c.fill();
  /* решётка, бампер, фара */
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .6;
  for (let y = -40; y < -30; y += 2.2){ c.beginPath(); c.moveTo(48.4, y); c.lineTo(51.2, y + .4); c.stroke(); }
  c.fillStyle = '#262a1f'; rr(c, 47, -31, 7, 4, 1); c.fill();
  c.fillStyle = '#ffeaa8'; c.beginPath(); c.arc(50.4, -34.6, 2.2, 0, 7); c.fill();
  /* выхлопная труба и антенна */
  c.fillStyle = '#2b2b2b'; c.fillRect(17, -64, 2.6, 38); c.fillStyle = '#444'; c.fillRect(16.4, -65, 3.8, 1.6);
  const sway = Math.sin(t * .012) * 2 * Math.min(1, v.sp) + Math.sin(t * .05) * .3;
  c.strokeStyle = '#1d1d1d'; c.lineWidth = .6;
  c.beginPath(); c.moveTo(23, -56); c.quadraticCurveTo(21 + sway * .4, -72, 16 + sway, -88); c.stroke();

  /* гидроцилиндр подъёма */
  const cp = Math.cos(v.pod), sp = Math.sin(v.pod);
  const ax = -9, ay = -31;
  const bx = PIV.x + 20 * cp - 12 * sp, by = PIV.y + 20 * sp + 12 * cp;
  const mx = lerp(ax, bx, .55), my = lerp(ay, by, .55);
  c.lineCap = 'round';
  c.strokeStyle = '#2c2f33'; c.lineWidth = 4.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(mx, my); c.stroke();
  c.strokeStyle = '#6c7178'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(mx, my); c.stroke();
  c.strokeStyle = '#b3b8be'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(mx, my); c.lineTo(bx, by); c.stroke();
  c.fillStyle = '#222'; c.beginPath(); c.arc(ax, ay, 1.8, 0, 7); c.fill(); c.beginPath(); c.arc(bx, by, 1.8, 0, 7); c.fill();

  /* пусковая установка */
  c.save(); c.translate(PIV.x, PIV.y); c.rotate(v.pod);
  c.fillStyle = vgrad(c, -12, 12, [[0, '#6a7a49'], [.4, '#505e37'], [1, '#323d27']]);
  rr(c, -10, -12, 64, 24, 2.4); c.fill(); c.strokeStyle = edge; c.lineWidth = .7; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.40)'; c.lineWidth = .5;
  for (let i = 1; i < 4; i++){ c.beginPath(); c.moveTo(-10, -11 + i * 5.5); c.lineTo(54, -11 + i * 5.5); c.stroke(); }
  c.fillStyle = '#2b3423'; c.fillRect(8, -13, 3, 26); c.fillRect(34, -13, 3, 26);
  c.fillStyle = 'rgba(255,224,170,.38)'; c.fillRect(-10, -12, 64, 1.2);
  c.fillStyle = '#1f261a'; c.fillRect(-15, -10, 5, 20);
  c.fillStyle = '#2a2f22'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill();
  c.fillStyle = '#c8b25a'; c.fillRect(20, -12, 2, 24);                      // жёлтая полоса
  c.fillStyle = '#242b1d'; c.fillRect(51, -12, 3.2, 24);

  for (let i = 0; i < 4; i++){
    const cy = rowY(i), sh = TL.SHOTS.find(s => s.v === key && s.i === i), fired = sh && t >= sh.t;
    c.fillStyle = '#0b0c0d'; c.beginPath(); c.ellipse(53.2, cy, 1.7, 2.45, 0, 0, 7); c.fill();
    if (!fired){                                                              // носик ракеты в трубе
      c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(53, cy - 2); c.lineTo(59, cy); c.lineTo(53, cy + 2); c.closePath(); c.fill();
      c.fillStyle = '#e8e8e8'; c.fillRect(54, cy - 1.8, 1, 3.6);
    } else {                                                                  // раскалённая труба после пуска
      const heat = Math.exp(-(t - sh.t) / 420);
      if (heat > .02){ c.fillStyle = `rgba(255,150,50,${heat * .9})`; c.beginPath(); c.ellipse(53.2, cy, 1.9, 2.6, 0, 0, 7); c.fill(); }
    }
  }
  c.restore();
  c.restore();
}

function drawVehicle(c, key, t){
  const g = geo[key], v = veh(key, t), L = vc[key], k = g.k;

  c.fillStyle = 'rgba(24,12,14,.40)';
  c.beginPath(); c.ellipse(v.x - 2 * k, g.y + .6 * k, 52 * k, 5.6 * k, 0, 0, 7); c.fill();

  const l = L.ctx;
  l.setTransform(DPR, 0, 0, DPR, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, L.bw, L.bh);
  vehicleBody(l, Object.assign({}, v, { x: L.ox, y: L.oy + (v.y - g.y) }), t, key);

  /* свет заката поверх машины (только по её пикселям) */
  l.globalCompositeOperation = 'source-atop';
  let gr = l.createLinearGradient(0, 0, L.bw, 0);
  gr.addColorStop(0, 'rgba(30,18,60,.20)'); gr.addColorStop(.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,170,80,.34)');
  l.fillStyle = gr; l.fillRect(0, 0, L.bw, L.bh);
  gr = l.createLinearGradient(0, L.oy - 46 * k, 0, L.oy + 4 * k);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(16,8,26,.34)');
  l.fillStyle = gr; l.fillRect(0, 0, L.bw, L.bh);
  if (key === 'back'){ l.fillStyle = 'rgba(196,150,150,.17)'; l.fillRect(0, 0, L.bw, L.bh); }
  l.globalCompositeOperation = 'source-over';

  c.drawImage(L.cv, v.x - L.ox, g.y - L.oy, L.bw, L.bh);
}

/* ─────────────────────────────────────────────────────────────
   РАКЕТЫ, ВСПЫШКИ
   ───────────────────────────────────────────────────────────── */
function rpos(r, tau){
  const s = S * (14 * tau + 170 * tau * tau);
  return { x: r.p0.x + Math.cos(r.a) * s, y: r.p0.y + Math.sin(r.a) * s - S * 28 * tau * tau };
}

function drawRockets(c, t, key){
  for (const r of rockets){
    if (r.key !== key) continue;
    const tau = (t - r.sh.t) / 1000;
    if (tau < 0) continue;
    const k = r.k;

    /* дымный след */
    c.globalCompositeOperation = 'source-over';
    const maxAge = Math.min(tau, 2.0);
    for (let j = 0; j < 64; j++){
      const age = .008 * j * (1 + j * .04);
      if (age > maxAge) break;
      const p = rpos(r, tau - age), u = age / 2.0;
      const rad = (2.8 + age * 10) * k;
      c.globalAlpha = .55 * Math.pow(1 - u, 1.2) * clamp(age / .03);
      c.drawImage(spr.smoke, p.x - age * S * 1.4 - rad, p.y - age * S * 3.2 - rad, rad * 2, rad * 2);
    }
    c.globalAlpha = 1;

    /* корпус */
    const p = rpos(r, tau), p2 = rpos(r, tau + .01);
    if (p.x - 40 * k > W + 60 || p.y < -60 * k) continue;
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
    c.save(); c.translate(p.x, p.y); c.rotate(ang); c.scale(k, k);

    const fl = (22 + Math.sin(t * .11 + r.sh.i * 2) * 4 + Math.sin(t * .23) * 2) * clamp(tau / .05);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .9; c.drawImage(spr.fire, -24 - 12, -12, 24, 24);
    const fg = c.createLinearGradient(-24, 0, -24 - fl, 0);
    fg.addColorStop(0, 'rgba(255,255,230,.95)'); fg.addColorStop(.35, 'rgba(255,176,60,.8)'); fg.addColorStop(1, 'rgba(255,70,20,0)');
    c.fillStyle = fg; c.globalAlpha = 1;
    c.beginPath(); c.moveTo(-24, -2.1); c.quadraticCurveTo(-24 - fl * .6, -3.4, -24 - fl, 0);
    c.quadraticCurveTo(-24 - fl * .6, 3.4, -24, 2.1); c.fill();
    c.globalCompositeOperation = 'source-over';

    c.fillStyle = '#3a3d40'; c.beginPath();
    c.moveTo(-22, -2.2); c.lineTo(-28, -6.4); c.lineTo(-16, -2.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-22, 2.2); c.lineTo(-28, 6.4); c.lineTo(-16, 2.2); c.closePath(); c.fill();
    c.fillStyle = '#22252a'; c.fillRect(-24.6, -1.6, 2.8, 3.2);
    c.fillStyle = vgrad(c, -2.3, 2.3, [[0, '#f0f3f5'], [.5, '#b7bec4'], [1, '#5d646b']]);
    c.fillRect(-22, -2.3, 26, 4.6);
    c.fillStyle = '#c9a23a'; c.fillRect(-12, -2.3, 1.7, 4.6);
    c.fillStyle = '#2a2d31'; c.fillRect(-18, -2.3, .8, 4.6);
    c.fillStyle = vgrad(c, -2.3, 2.3, [[0, '#e0614f'], [1, '#8a2418']]);
    c.beginPath(); c.moveTo(4, -2.3); c.quadraticCurveTo(9, -2.1, 12.5, 0); c.quadraticCurveTo(9, 2.1, 4, 2.3); c.closePath(); c.fill();
    c.restore();
  }
}

function drawFlashes(c, t, key){
  for (const r of rockets){
    if (r.key !== key) continue;
    const tau = (t - r.sh.t) / 1000;
    if (tau < 0) continue;
    const k = r.k, m = r.mz;

    /* вспышка у дульного среза */
    const u = tau / .20;
    if (u < 1){
      c.globalCompositeOperation = 'lighter';
      const rad = (16 + 38 * easeOut(u)) * k;
      c.globalAlpha = Math.pow(1 - u, 1.2);
      c.drawImage(spr.fire, m.x - rad, m.y - rad, rad * 2, rad * 2);
      c.save(); c.translate(m.x, m.y); c.rotate(r.a);
      const L = (34 + 50 * u) * k, h = (12 - 6 * u) * k;
      c.globalAlpha = (1 - u) * .85; c.drawImage(spr.fire, 0, -h, L, h * 2);
      c.restore();
      c.globalCompositeOperation = 'source-over';
    }
    /* огненный отсвет на земле + ударная волна */
    const u2 = tau / .9;
    if (u2 < 1){
      const e = easeOut(u2), rx = (8 + 74 * e) * k;
      c.globalAlpha = .5 * (1 - u2);
      c.strokeStyle = 'rgba(255,232,196,1)'; c.lineWidth = Math.max(1, 2.4 * (1 - u2) * k);
      c.beginPath(); c.ellipse(r.gx, r.gy + k, rx, rx * .13, 0, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,170,80,1)'; c.globalAlpha = .16 * (1 - u2);
      c.beginPath(); c.ellipse(r.gx, r.gy + k, rx * .8, rx * .1, 0, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }
}

/* ─────────────────────────────────────────────────────────────
   ЭКИПАЖ (3 бойца: забег → готовность → пальцем на цель → пригнулись)
   ───────────────────────────────────────────────────────────── */
function ik(x0, y0, tx, ty, l1, l2, sign){
  const dx = tx - x0, dy = ty - y0;
  let d = Math.hypot(dx, dy) || .001;
  d = clamp(d, Math.abs(l1 - l2) + .01, l1 + l2 - .01);
  const a = Math.atan2(dy, dx);
  const ang = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * sign;
  return { ex: x0 + Math.cos(a + ang) * l1, ey: y0 + Math.sin(a + ang) * l1,
           hx: x0 + Math.cos(a) * d, hy: y0 + Math.sin(a) * d };
}

function limb(c, pts, w, col){
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
}

function soldier(c, x, y, ks, P){
  c.save(); c.translate(x, y); c.scale(ks, ks);
  c.lineCap = 'round'; c.lineJoin = 'round';

  const leg = (t1, t2) => {
    const kx = Math.sin(t1) * 10, ky = Math.cos(t1) * 10;
    return { kx, ky, fx: kx + Math.sin(t1 + t2) * 10, fy: ky + Math.cos(t1 + t2) * 10 };
  };
  let A, B;
  if (P.run >= 0){
    const s1 = Math.sin(P.run), s2 = Math.sin(P.run + Math.PI);
    A = leg(s1 * .85, -(.35 + .75 * Math.max(0, Math.cos(P.run))));
    B = leg(s2 * .85, -(.35 + .75 * Math.max(0, Math.cos(P.run + Math.PI))));
  } else {
    A = leg(.12 + P.crouch * 1.15, -(.08 + P.crouch * 1.95));
    B = leg(-.08 + P.crouch * 1.0, -(.05 + P.crouch * 1.7));
  }
  const hipX = 0, hipY = -Math.max(A.fy, B.fy);
  const lean = P.run >= 0 ? .22 : .05 + P.crouch * .55;
  const shx = hipX + Math.sin(lean) * 14, shy = hipY - Math.cos(lean) * 14;
  const hx = shx + Math.sin(lean) * 5.5, hy = shy - Math.cos(lean) * 5.5 - .5;

  const pants = '#3a4030', pantsB = '#2c3124', jacket = '#59663f', jacketB = '#434d2f', boot = '#17181a', skin = '#d8a57a';

  limb(c, [[hipX, hipY], [hipX + B.kx, hipY + B.ky], [hipX + B.fx, hipY + B.fy]], 4.2, pantsB);
  limb(c, [[hipX + B.kx, hipY + B.ky + .6], [hipX + B.fx, hipY + B.fy]], 4.6, boot);

  /* дальняя рука */
  let tB, tA;
  const earT = [hx - 1.0, hy + 2.2];
  if (P.run >= 0){
    tB = [shx + Math.sin(P.run) * 7 + 2, shy + 8 - Math.abs(Math.cos(P.run)) * 3.5];
    tA = [shx + Math.sin(P.run + Math.PI) * 7 + 2, shy + 8 - Math.abs(Math.cos(P.run + Math.PI)) * 3.5];
  } else {
    tB = [shx + 5, shy + 9]; tA = [shx + 3, shy + 13 + Math.sin(P.t * .004) * .5];
    if (P.point > 0) tA = [lerp(tA[0], shx + 15, P.point), lerp(tA[1], shy - 1.5, P.point)];
  }
  tA = [lerp(tA[0], earT[0], P.ear), lerp(tA[1], earT[1], P.ear)];
  tB = [lerp(tB[0], earT[0] + .8, P.ear), lerp(tB[1], earT[1] + .4, P.ear)];
  const aB = ik(shx, shy, tB[0], tB[1], 7.2, 7.2, 1);
  limb(c, [[shx, shy], [aB.ex, aB.ey], [aB.hx, aB.hy]], 3.2, jacketB);
  c.fillStyle = skin; c.beginPath(); c.arc(aB.hx, aB.hy, 1.7, 0, 7); c.fill();

  /* торс, рюкзак */
  c.save(); c.translate(hipX, hipY); c.rotate(lean);
  c.fillStyle = jacket; rr(c, -4.6, -14.6, 9.2, 15.4, 2.6); c.fill();
  c.fillStyle = jacketB; rr(c, -7.4, -13, 3.6, 10, 1.4); c.fill();
  c.fillStyle = '#2a2f20'; c.fillRect(-4.6, -3.2, 9.2, 1.4);
  c.restore();

  /* голова и каска */
  c.fillStyle = skin; c.beginPath(); c.arc(hx, hy, 3.6, 0, 7); c.fill();
  c.fillStyle = '#4a5636'; c.beginPath(); c.arc(hx - .3, hy - .6, 4.5, Math.PI * 1.02, Math.PI * 2.04); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,214,160,.55)'; c.beginPath(); c.arc(hx - .3, hy - .6, 4.5, Math.PI * 1.55, Math.PI * 1.95); c.lineTo(hx, hy - 1.6); c.fill();
  c.strokeStyle = '#2c3422'; c.lineWidth = .8; c.beginPath(); c.moveTo(hx - 3.4, hy - .6); c.lineTo(hx + 5, hy - .6); c.stroke();

  /* ближняя нога и рука */
  limb(c, [[hipX, hipY], [hipX + A.kx, hipY + A.ky], [hipX + A.fx, hipY + A.fy]], 4.4, pants);
  limb(c, [[hipX + A.kx, hipY + A.ky + .6], [hipX + A.fx, hipY + A.fy]], 4.8, boot);
  const aA = ik(shx, shy, tA[0], tA[1], 7.2, 7.2, 1);
  limb(c, [[shx, shy], [aA.ex, aA.ey], [aA.hx, aA.hy]], 3.4, jacket);
  c.fillStyle = skin; c.beginPath(); c.arc(aA.hx, aA.hy, 1.8, 0, 7); c.fill();
  c.restore();
}

function drawCrew(c, t){
  const ks = 11 * S / 42;
  const order = geo.crew.map((m, i) => ({ m, i })).sort((a, b) => a.m.y - b.m.y);
  for (const o of order){
    const m = o.m, i = o.i;
    const run = prog(t, m.run[0], m.run[1]), startX = -8 * S;
    let x = lerp(startX, m.fx, run < 1 ? Math.pow(run, .75) : 1), P = { run: -1, crouch: 0, ear: 0, point: 0, t };
    if (run < 1 && t >= m.run[0]) P.run = ((x - startX) / (4.2 * ks * 1.0)) * 1.0;
    if (t < m.run[0]) continue;
    const cr0 = 3700 + i * 90;
    P.crouch = easeInOut(prog(t, cr0, cr0 + 420));
    P.ear = easeInOut(prog(t, cr0 + 150, cr0 + 480));
    if (i === 1) P.point = easeInOut(prog(t, 2850, 3050)) * (1 - easeInOut(prog(t, 3450, 3650)));
    let shx = 0;
    for (const s of TL.SHOTS){ const d = t - s.t; if (d >= 0 && d < 500) shx += Math.exp(-d / 110) * Math.sin(d / 22); }
    c.globalAlpha = 1;
    soldier(c, x + shx * .35 * S * .3, m.y, ks, P);
  }
}

/* ─────────────────────────────────────────────────────────────
   КАДР
   ───────────────────────────────────────────────────────────── */
function render(t){
  if (!ctx) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  /* камера: плавный наезд + тряска от пусков */
  let sh = 0, punch = 0;
  for (const s of TL.SHOTS){ const d = t - s.t; if (d >= 0 && d < 900){ sh += Math.exp(-d / 140) * (s.v === 'main' ? 1 : .8); punch += Math.exp(-d / 110); } }
  const amp = Math.min(sh * 1.25 * S, 8 * S / 3.9) + (t < 3300 ? .35 : 0);
  const z = 1.045 + .06 * easeInOut(prog(t, 1800, 4480)) + punch * .005;
  const fx = W * .6, fy = H * .58;
  ctx.save();
  ctx.translate(fx + amp * Math.sin(t * .083), fy + amp * Math.cos(t * .071) * 1.1);
  ctx.rotate(amp * .0006 * Math.sin(t * .05));
  ctx.scale(z, z); ctx.translate(-fx, -fy);

  ctx.drawImage(bg, 0, 0, W, H);
  for (const cl of clouds) ctx.drawImage(cl.c, cl.x + t * .001 * cl.sp * S * .6 - cl.w * .2, cl.y, cl.w, cl.h);

  drawPuffs(ctx, t, 0);
  drawVehicle(ctx, 'back', t);
  drawRockets(ctx, t, 'back');
  drawFlashes(ctx, t, 'back');

  drawPuffs(ctx, t, 1);
  drawVehicle(ctx, 'main', t);
  drawCrew(ctx, t);
  drawRockets(ctx, t, 'main');
  drawFlashes(ctx, t, 'main');

  drawPuffs(ctx, t, 2);
  ctx.restore();

  /* общий отсвет от пусков */
  let glare = 0;
  for (const s of TL.SHOTS){ const d = t - s.t; if (d >= 0 && d < 400) glare += .20 * Math.exp(-d / 95); }
  if (glare > .004){
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,168,84,${Math.min(.34, glare)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.drawImage(vig, 0, 0, W, H);
  drawHUD(t);

  const f = prog(t, TL.FADE[0], TL.FADE[1]);
  if (f > 0){ ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); }
}

function drawHUD(t){
  const bars = easeOut(prog(t, 0, 450)), bh = H * .075 * bars;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);

  const fs = Math.max(11, 3.3 * S), ff = '"Segoe UI",system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  const env = (a, b, f = 250) => Math.min(prog(t, a, a + f), 1 - prog(t, b - f, b));

  let a = env(500, 1900);
  if (a > 0){
    ctx.globalAlpha = a; ctx.fillStyle = '#e9d9b0'; ctx.font = `800 ${fs}px ${ff}`;
    ctx.fillText('🚀  МЛРС', W / 2, H - bh / 2 - fs * .55);
    ctx.font = `600 ${fs * .62}px ${ff}`; ctx.fillStyle = 'rgba(233,217,176,.7)';
    ctx.fillText('РЕАКТИВНАЯ СИСТЕМА ЗАЛПОВОГО ОГНЯ', W / 2, H - bh / 2 + fs * .6);
  }
  a = env(2300, 4430);
  if (a > 0){
    const pc = Math.round(easeInOut(prog(t, TL.RAISE[0], TL.RAISE[1])) * 100);
    ctx.globalAlpha = a; ctx.fillStyle = '#ffd98a'; ctx.font = `700 ${fs}px ${ff}`;
    ctx.fillText('НАВЕДЕНИЕ  ' + pc + '%', W / 2, H - bh / 2 - fs * .35);
    const bw = W * .42, bx = (W - bw) / 2, by = H - bh / 2 + fs * .55;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(bx, by, bw * pc / 100, 3);
  }
  a = env(4380, 5500, 160);
  if (a > 0){
    const pop = 1 + .35 * (1 - easeOut(prog(t, 4380, 4640)));
    ctx.save(); ctx.translate(W / 2, H * .2); ctx.scale(pop, pop);
    ctx.globalAlpha = a; ctx.font = `900 ${fs * 2.6}px ${ff}`;
    ctx.lineWidth = fs * .22; ctx.strokeStyle = 'rgba(70,10,0,.85)'; ctx.strokeText('ОГОНЬ!', 0, 0);
    ctx.fillStyle = '#ff8a2a'; ctx.fillText('ОГОНЬ!', 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────────────────────
   ЗВУК: триггеры по тому же таймлайну (громкость учитывает слайдер)
   ───────────────────────────────────────────────────────────── */
function masterFactor(){
  let m = 70;
  try { if (typeof Storage !== 'undefined' && Storage.getVolume) m = Storage.getVolume(); } catch(e){}
  return clamp(m / 70, 0, 1);       // 70% (по умолчанию) = как раньше, ниже — тише
}

function audioStart(){
  const mv = masterFactor();
  const mk = (src, vol) => { const a = new Audio(src); a.preload = 'auto'; a.volume = clamp(vol * mv); return a; };
  const eng = mk('sounds/engine.mp3', AUDIO_BASE.engine);
  const mech = mk('sounds/mechanism_MLRS.mp3', AUDIO_BASE.mech);
  const shots = TL.SHOTS.map(() => mk('sounds/MLRS_shot.mp3', AUDIO_BASE.shot));
  audio = { all: [eng, mech].concat(shots) };

  /* «прогрев» (разблокировка автоплея) — только для звуков, которые стартуют позже */
  [mech].concat(shots).forEach(a => {
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
  });

  const play = a => () => { try { a.muted = false; a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch(e){} };
  audioEvents = [{ t: TL.ENGINE, fn: play(eng) }, { t: TL.MECH, fn: play(mech) }];
  TL.SHOTS.forEach((s, i) => audioEvents.push({ t: s.t, fn: play(shots[i]) }));
  audioEvents.sort((a, b) => a.t - b.t);
  audioNext = 0;
}

function audioTick(t){
  while (audioNext < audioEvents.length && t >= audioEvents[audioNext].t) audioEvents[audioNext++].fn();
}

function audioStop(){
  if (!audio) return;
  audio.all.forEach(a => { try { a.pause(); a.currentTime = 0; } catch(e){} });
  audio = null; audioEvents = []; audioNext = 0;
}

/* ─────────────────────────────────────────────────────────────
   ЖИЗНЕННЫЙ ЦИКЛ
   ───────────────────────────────────────────────────────────── */
function size(){
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);   // потолок 1.5 — запас по FPS на слабых телефонах
  W = host.clientWidth || window.innerWidth;
  H = host.clientHeight || window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
}

function build(){
  layout(); makeSprites(); buildBG();
  [geo.main, geo.back].forEach(g => {
    const bw = 132 * g.k, bh = 132 * g.k, c = mkCanvas(bw * DPR, bh * DPR);
    vc[g.key] = { cv: c, ctx: c.getContext('2d'), bw, bh, ox: bw / 2, oy: bh - 14 * g.k };
  });
  buildPuffs();
}

function onResize(){ if (!cv) return; size(); build(); }

function setup(container){
  teardown();
  host = container;
  cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;display:block;background:#000';
  host.appendChild(cv);
  ctx = cv.getContext('2d');
  size(); build();
  window.addEventListener('resize', onResize);
}

function teardown(){
  window.removeEventListener('resize', onResize);
  if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
  cv = ctx = host = null;
}

function finish(){
  if (!running && !resolveFn) return;
  running = false;
  cancelAnimationFrame(raf); clearTimeout(safety);
  audioStop();
  const ov = host;
  teardown();
  if (ov){ ov.classList.add('hidden'); ov.innerHTML = ''; }
  const r = resolveFn; resolveFn = null;
  if (r) r();
}

function play(overlay, opts){
  opts = opts || {};
  if (running) finish();
  return new Promise(resolve => {
    resolveFn = resolve;
    overlay.classList.remove('hidden');
    overlay.innerHTML = '';
    try { setup(overlay); } catch(e){ console.error('[cutscene] setup failed', e); finish(); return; }
    if (opts.audio !== false) audioStart();      // синхронно — внутри жеста пользователя
    running = true; startT = performance.now();
    render(0);
    const loop = () => {
      if (!running) return;
      const t = performance.now() - startT;
      if (opts.audio !== false) audioTick(t);
      if (t >= TL.DURATION){ finish(); return; }
      render(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    safety = setTimeout(finish, TL.DURATION + 400);
  });
}

window.MLRSCutscene = {
  play,
  stop: finish,
  TIMELINE: TL,
  debug: { setup, render, teardown }       // для предпросмотра / скриншотов
};

console.log('[cutscene] loaded');
})();
