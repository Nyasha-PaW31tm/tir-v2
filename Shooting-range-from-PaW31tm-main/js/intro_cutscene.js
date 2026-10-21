/* ═══════════════════════════════════════════════════════════════
   INTRO_CUTSCENE.JS v2 — вступление перед забегом (canvas, без ассетов)

   ЧАСТЬ 1 — вид СО СТОРОНЫ (3-е лицо). Чёрный безликий силуэт
   с СНАРЯЖЕНИЕМ берёт ТВОЁ оружие и всё нужное достаёт откуда надо:
     pistol  — любой обычный скин: револьвер из кобуры на поясе,
               прокрутка на пальце, вскидывает
     shotgun — патроны берёт из патронташа (петли на поясе),
               ломает ружьё, заряжает ДВА, закрывает, вскидывает
     akc     — рожок из подсумка на разгрузке, вставляет, дёргает
               затвор (гильза), вскидывает
   ПЕРЕХОД — камера «ныряет» в чёрную голову (безликий силуэт).
   ЧАСТЬ 2 — вид ОТ ПЕРВОГО ЛИЦА: оружие выезжает снизу, мушка и
   целик, взгляд скользит по мишеням и замирает на центральной.

   Цвета оружия берутся из CSS-переменных активного скина (--r-*).

   API:  IntroCutscene.play(overlayEl) → Promise (резолвится в конце
         или по кнопке «Пропустить»)
         IntroCutscene.stop()
         IntroCutscene.detect() → 'pistol' | 'shotgun' | 'akc'
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const SW = 360, SH = 640;                          // виртуальная сцена
const A_DUR = { pistol: 3.1, shotgun: 3.7, akc: 3.5 };   // часть 1 (сбоку)
const ZOOM = 0.55;                                  // «нырок» в голову
const FP_DUR = 2.8;                                 // часть 2 (от 1-го лица)
const DURATION = {};
Object.keys(A_DUR).forEach(k => DURATION[k] = A_DUR[k] + ZOOM + FP_DUR);

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, u) => a + (b - a) * u;
const ease  = u => u * u * (3 - 2 * u);
const seg   = (t, a, b) => clamp((t - a) / (b - a));
const mix   = (A, B, u) => ({ x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u) });
const mixP  = (A, B, u) => ({ x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), r: lerp(A.r, B.r, u) });

/* Интерполяция по ключевым кадрам [t, v1, v2, ...] */
function track(t, kf){
  if (t <= kf[0][0]) return kf[0].slice(1);
  for (let i = 1; i < kf.length; i++){
    if (t <= kf[i][0]){
      const u = ease((t - kf[i - 1][0]) / (kf[i][0] - kf[i - 1][0]));
      return kf[i - 1].slice(1).map((v, j) => lerp(v, kf[i][j + 1], u));
    }
  }
  return kf[kf.length - 1].slice(1);
}

/* Двухзвенная рука: плечо → локоть → кисть */
function ik(S, Hd, l1, l2){
  const dx = Hd.x - S.x, dy = Hd.y - S.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1, l1 + l2 - 0.5);
  const a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const e1 = { x: S.x + l1 * Math.cos(a + b), y: S.y + l1 * Math.sin(a + b) };
  const e2 = { x: S.x + l1 * Math.cos(a - b), y: S.y + l1 * Math.sin(a - b) };
  return {
    e: e1.y >= e2.y ? e1 : e2,                      // локоть всегда «вниз» — рука не выворачивается
    h: { x: S.x + d * Math.cos(a),      y: S.y + d * Math.sin(a) }
  };
}

/* ───────────── палитра из активного скина ───────────── */
function cssVar(name, fb){
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fb;
}
function palette(type){
  if (type === 'shotgun') return {
    body: '#3a2a1c', barrel: '#2b2f36', accent: '#c9a45a', sight: '#ffd27a', grip: '#6b4423'
  };
  if (type === 'akc') return {
    body: '#23272d', barrel: '#1a1d22', accent: '#8a6a3a', sight: '#d8d8d8', grip: '#5a3a1e'
  };
  return {
    body:   cssVar('--r-receiver', '#2a2f38'),
    barrel: cssVar('--r-barrel', '#3a404a'),
    accent: cssVar('--r-barrel-sh', cssVar('--r-muzzle', '#9aa4b2')),
    sight:  cssVar('--r-front-sight', '#ffd24a'),
    grip:   cssVar('--r-grip', cssVar('--r-stock', '#14171c'))
  };
}

function detect(){
  const cl = Array.from(document.body.classList);
  if (cl.some(c => /shotgun|drob/i.test(c))) return 'shotgun';
  if (cl.some(c => /akc|ak74|ak-74/i.test(c))) return 'akc';
  return 'pistol';
}

/* ───────────── примитивы ───────────── */
function rr(ctx, x, y, w, h, r){
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function poly(ctx, pts){
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
const RIM = 'rgba(150,180,230,.28)';
const SKIN = '#090b0f';     // «кожа» силуэта
const GEAR = '#141a24';     // снаряжение чуть светлее силуэта, чтобы читалось

/* ───────────── оружие, вид сбоку (локальные координаты) ───────────── */
/* Револьвер. Ось (0,0) — спусковая скоба */
function drawRevolver(ctx, p){
  ctx.fillStyle = p.grip;
  ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(0, -6); ctx.lineTo(-5, 32); ctx.lineTo(-24, 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = p.body; rr(ctx, -18, -17, 30, 14, 3); ctx.fill();
  ctx.fillStyle = p.barrel; rr(ctx, 12, -15, 56, 7, 2); ctx.fill();
  ctx.fillStyle = p.accent; ctx.fillRect(12, -9, 54, 1.6);
  ctx.fillStyle = p.body; rr(ctx, -2, -20, 22, 17, 5); ctx.fill();
  ctx.fillStyle = p.barrel; ctx.fillRect(4, -19, 2, 15); ctx.fillRect(12, -19, 2, 15);
  ctx.fillStyle = p.sight; ctx.fillRect(62, -19, 4, 4);
  ctx.strokeStyle = p.body; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(2, -2, 9, 0.1, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = p.barrel; ctx.beginPath();
  ctx.moveTo(-18, -17); ctx.lineTo(-24, -21); ctx.lineTo(-14, -19); ctx.closePath(); ctx.fill();
}

/* Двустволка. Ось (0,0) — шейка приклада, open — угол слома стволов */
function drawShotgun(ctx, p, open){
  ctx.fillStyle = p.grip;
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-64, -9); ctx.lineTo(-68, 10); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = p.body; rr(ctx, -10, -9, 28, 14, 3); ctx.fill();
  ctx.strokeStyle = p.body; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(2, 5, 8, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.save(); ctx.translate(18, -4); ctx.rotate(open);
  ctx.fillStyle = p.barrel; rr(ctx, -10, -7, 114, 11, 3); ctx.fill();
  ctx.fillStyle = p.accent; ctx.fillRect(-6, -5, 106, 1.6);
  ctx.fillStyle = p.grip; rr(ctx, 4, 4, 34, 8, 3); ctx.fill();
  ctx.fillStyle = p.sight; ctx.fillRect(98, -10, 3, 4);
  ctx.restore();
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(18, -4, 2.6, 0, 7); ctx.fill();
}

/* АКС-74М. Ось (0,0) — центр ствольной коробки у рукояти.
   bolt 0..1 — отвод затвора; ручка затвора на ствольной коробке */
function drawAKC(ctx, p, bolt){
  ctx.fillStyle = p.grip;                                                    // приклад
  ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-58, -6); ctx.lineTo(-60, 10); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(4, 2); ctx.lineTo(-2, 24); ctx.lineTo(-14, 22); ctx.closePath(); ctx.fill(); // рукоять
  ctx.fillStyle = p.body; rr(ctx, -12, -17, 48, 20, 3); ctx.fill();          // ствольная коробка
  ctx.fillStyle = p.barrel; rr(ctx, -10, -15, 26, 5, 2); ctx.fill();         // крышка
  ctx.fillStyle = p.accent; ctx.fillRect(4 - bolt * 20, -20, 7, 5);          // рукоять затвора
  ctx.fillStyle = p.grip; rr(ctx, 36, -14, 44, 14, 4); ctx.fill();           // цевьё
  ctx.fillStyle = p.barrel; ctx.fillRect(34, -22, 46, 4);                    // газовая трубка
  ctx.fillRect(80, -11, 36, 5);                                              // ствол
  ctx.fillStyle = p.body; ctx.fillRect(110, -14, 10, 11);                    // ДТК
  ctx.fillStyle = p.sight; ctx.fillRect(104, -24, 3, 11);                    // мушка
  ctx.strokeStyle = p.body; ctx.lineWidth = 2;                               // скоба
  ctx.beginPath(); ctx.arc(8, 3, 8, 0.1, Math.PI - 0.1); ctx.stroke();
}

/* Рожок АК от точки крепления (0,0). curve 0..1 — изгиб вперёд */
function drawMag(ctx, p, curve){
  const c = 11 * (curve == null ? 1 : curve);
  ctx.fillStyle = '#4a4338';
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(7, 0); ctx.lineTo(7 + c, 34); ctx.lineTo(-5 + c, 36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = p.accent; ctx.fillRect(-3, 2, 8, 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(6 + c * 0.2, 8); ctx.moveTo(-4, 16); ctx.lineTo(6 + c * 0.4, 16); ctx.stroke();
}

/* Патрон 12 калибра, лежит вдоль +x: гильза слева, латунь справа */
function drawShell(ctx, x, y, rot){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#b8352b'; rr(ctx, -9, -3.5, 14, 7, 2); ctx.fill();
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(5, -3.5, 5, 7);
  ctx.restore();
}

/* ───────────── сцена сбоку ───────────── */
const SHOULDER  = { x: 158, y: 305 };
const SHOULDER2 = { x: 150, y: 309 };
const HEAD      = { x: 164, y: 264 };
const HORIZON   = 270;
const TARGETS   = [{ x: 262, y: 268 }, { x: 304, y: 272 }, { x: 344, y: 266 }];
const HOLSTER   = { x: 137, y: 424, w: 30, h: 66 };
const POUCH_A   = { x: 163, y: 332, w: 18, h: 30 };      // подсумок под рожок (ближний)
const POUCH_B   = { x: 142, y: 332, w: 18, h: 30 };
const LOOP_X    = i => 134 + i * 8;                       // петли патронташа

function drawBackground(ctx){
  const g = ctx.createLinearGradient(0, -200, 0, 640);
  g.addColorStop(0, '#05070b'); g.addColorStop(0.42, '#141a26'); g.addColorStop(1, '#0a0d13');
  ctx.fillStyle = g; ctx.fillRect(-900, -900, 2200, 2500);
  const lg = ctx.createRadialGradient(300, 268, 4, 300, 290, 200);
  lg.addColorStop(0, 'rgba(255,255,255,.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(-100, 0, 600, 480);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++){
    ctx.beginPath(); ctx.moveTo(300 + i * 12, HORIZON); ctx.lineTo(300 + i * 150, 760); ctx.stroke();
  }
  for (let k = 0; k < 7; k++){
    const y = HORIZON + Math.pow(k / 6, 2) * 440;
    ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(900, y); ctx.stroke();
  }
  TARGETS.forEach(m => {
    ctx.fillStyle = '#10141b'; ctx.fillRect(m.x - 1.5, m.y, 3, 40);
    [[15, '#e8e8e8'], [11, '#c0392b'], [6.5, '#e8e8e8'], [3, '#c0392b']].forEach(r => {
      ctx.fillStyle = r[1]; ctx.beginPath(); ctx.arc(m.x, m.y, r[0], 0, 7); ctx.fill();
    });
  });
}

/* Тело (без рук): ноги, торс, шея, голова — с контурным светом */
function drawBody(ctx){
  const stroke = (w, pts) => {
    ctx.lineWidth = w + 3; ctx.strokeStyle = RIM;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = SKIN;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  };
  stroke(19, [[146, 432], [128, 520], [122, 600]]);
  stroke(19, [[158, 432], [180, 518], [192, 600]]);
  stroke(11, [[114, 604], [136, 604]]); stroke(11, [[186, 604], [210, 604]]);
  stroke(46, [[152, 428], [156, 318]]);
  stroke(14, [[158, 300], [162, 282]]);
  ctx.beginPath(); ctx.ellipse(HEAD.x, HEAD.y, 19, 22, 0.15, 0, 7);
  ctx.lineWidth = 2.5; ctx.strokeStyle = RIM; ctx.stroke(); ctx.fillStyle = SKIN; ctx.fill();
}

/* Пояс (всегда), патронташ (дробовик), разгрузка (АКС) */
function drawGearBase(ctx, type, slotsGone){
  if (type === 'shotgun'){                                   // патроны в петлях — под поясом
    for (let i = 0; i < 6; i++){
      if (i >= 6 - slotsGone) continue;
      const x = LOOP_X(i);
      ctx.fillStyle = '#b8352b'; rr(ctx, x - 3, 402, 6, 12, 1.5); ctx.fill();
      ctx.fillStyle = '#d9b44a'; ctx.fillRect(x - 3, 413, 6, 6);
    }
  }
  if (type === 'akc'){                                       // плиты разгрузки
    ctx.fillStyle = GEAR; rr(ctx, 132, 320, 52, 52, 8); ctx.fill();
    ctx.strokeStyle = RIM; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = GEAR; ctx.lineWidth = 7;                // лямка через плечо
    ctx.beginPath(); ctx.moveTo(146, 330); ctx.lineTo(156, 304); ctx.stroke();
  }
  ctx.fillStyle = GEAR; rr(ctx, 127, 418, 54, 13, 3); ctx.fill();   // пояс
  ctx.strokeStyle = RIM; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.fillStyle = '#2a313d'; rr(ctx, 165, 420, 10, 9, 2); ctx.fill();  // пряжка
  if (type === 'shotgun'){                                   // кожаная кромка петель поверх низа патронов
    ctx.fillStyle = '#1b222e'; ctx.fillRect(130, 417, 50, 3);
  }
  if (type === 'akc'){                                       // подсумок-утилизатор сзади
    ctx.fillStyle = GEAR; rr(ctx, 122, 432, 16, 22, 3); ctx.fill();
    ctx.strokeStyle = RIM; ctx.lineWidth = 1; ctx.stroke();
  }
}

/* Передние панели подсумков/кобуры — рисуются ПОВЕРХ предметов внутри */
function drawGearFront(ctx, type){
  if (type === 'pistol'){
    ctx.fillStyle = GEAR; rr(ctx, HOLSTER.x, HOLSTER.y, HOLSTER.w, HOLSTER.h, 6); ctx.fill();
    ctx.strokeStyle = RIM; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#2a313d'; ctx.fillRect(HOLSTER.x + 3, HOLSTER.y + 4, HOLSTER.w - 6, 3);   // ремешок
    ctx.beginPath(); ctx.arc(HOLSTER.x + HOLSTER.w / 2, HOLSTER.y + 5.5, 2, 0, 7); ctx.fillStyle = '#4a5160'; ctx.fill();
  }
  if (type === 'akc'){
    [POUCH_B, POUCH_A].forEach(P => {
      ctx.fillStyle = '#19202c'; rr(ctx, P.x, P.y, P.w, P.h, 3); ctx.fill();
      ctx.strokeStyle = RIM; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = '#2a313d'; ctx.fillRect(P.x + 2, P.y + 3, P.w - 4, 3);
    });
  }
}

/* ─────── часть 1: рисуем всё по слоям ─────── */
function drawThird(ctx, type, t, pal){
  const D = A_DUR[type];
  let H, ang, gp = [-5, 12], open = 0, bolt = 0, kick = 0;
  let off = null, offHold = null, item = null, shells = [], brass = 0, casing = null;
  let slotsGone = 0, inHolster = false, magFront = true, magInPouch = false;
  let magPose = null, magCurve = 1;

  /* — позы — */
  if (type === 'pistol'){
    const k = track(t, [
      [0.0, 122, 413, 1.45], [0.3, 122, 413, 1.45],
      [0.62, 124, 346, 1.4],                       // 1) строго ВВЕРХ — ствол выходит из кобуры
      [0.9, 168, 342, 0.3],                        // 2) только потом разворот вперёд
      [1.15, 208, 358, -0.1], [2.05, 212, 354, -0.1], [2.85, 234, 290, -0.03], [D, 234, 290, -0.03]
    ]);
    H = { x: k[0], y: k[1] }; ang = k[2] - Math.PI * 4 * ease(seg(t, 1.15, 2.05));
    const gs = ease(seg(t, 0.95, 1.2)) * (1 - ease(seg(t, 2.05, 2.3)));   // хват: рукоять → палец в скобе → рукоять
    gp = [lerp(-9, 0, gs), lerp(12, 4, gs)];
  } else if (type === 'shotgun'){
    const k = track(t, [
      [0.0, 176, 392, 0.55], [0.7, 190, 374, 1.05], [2.45, 190, 374, 1.05],
      [3.2, 224, 290, -0.03], [D, 224, 290, -0.03]
    ]);
    H = { x: k[0], y: k[1] }; ang = k[2]; gp = [-3, 4];
    open = 0.42 * ease(seg(t, 0.65, 1.0));
    if (t > 2.3) open = 0.42 * (1 - ease(seg(t, 2.3, 2.5)));
    if (t > 2.45 && t < 2.65) kick = 3 * (1 - seg(t, 2.45, 2.65));
  } else {
    const k = track(t, [
      [0.0, 188, 384, -0.3], [2.1, 188, 384, -0.3], [3.0, 222, 290, -0.03], [D, 222, 290, -0.03]
    ]);
    H = { x: k[0], y: k[1] }; ang = k[2]; gp = [-5, 12];
    if (t > 1.5 && t < 1.75) kick = 4 * (1 - seg(t, 1.5, 1.75));
    bolt = ease(seg(t, 1.7, 1.9)) * (1 - ease(seg(t, 1.9, 2.0)));
  }
  H.y += kick;

  const c = Math.cos(ang), s = Math.sin(ang);
  const ox = H.x - (gp[0] * c - gp[1] * s), oy = H.y - (gp[0] * s + gp[1] * c);
  const toW = (lx, ly) => ({ x: ox + lx * c - ly * s, y: oy + lx * s + ly * c });

  /* — дальняя рука и предметы — */
  if (type === 'pistol'){
    const tip = toW(68, -11);
    inHolster = t < 0.7 && tip.y > 426;
    const idle = { x: 143, y: 412 }, sup = toW(-5, 27);
    off = mix(idle, sup, ease(seg(t, 2.15, 2.75)));
  }
  else if (type === 'shotgun'){
    const fore = toW(40, 6), br = toW(30, -2);
    const P1 = { x: LOOP_X(5), y: 406 }, P2 = { x: LOOP_X(4), y: 406 };
    const arc = (A, B, u) => { const q = mix(A, B, ease(u)); q.y -= 34 * Math.sin(Math.PI * u); return q; };
    const shellRot = u => lerp(Math.PI / 2, ang + Math.PI, ease(u));
    if (t < 0.55) off = fore;
    else if (t < 0.95) off = mix(fore, P1, ease(seg(t, 0.55, 0.95)));
    else if (t < 1.55){
      const u = seg(t, 0.95, 1.5); off = arc(P1, br, u);
      if (u < 1) shells.push({ x: off.x, y: off.y, r: shellRot(u) });
    }
    else if (t < 1.7) off = mix(br, P2, ease(seg(t, 1.55, 1.7)));
    else if (t < 2.3){
      const u = seg(t, 1.7, 2.2); off = arc(P2, br, u);
      if (u < 1) shells.push({ x: off.x, y: off.y, r: shellRot(u) });
    }
    else off = mix(br, fore, ease(seg(t, 2.3, 2.8)));
    slotsGone = (t > 0.95 ? 1 : 0) + (t > 1.7 ? 1 : 0);
    brass = (t > 1.5 ? 1 : 0) + (t > 2.2 ? 1 : 0);
    if (t > 2.5) brass = 0;
  }
  else {                                                      // akc
    const guard = toW(52, 6);
    const Mp = { x: POUCH_A.x + 9, y: POUCH_A.y - 6, r: 0 }, Mu = { x: Mp.x, y: Mp.y - 38, r: 0 };
    const Ls = toW(18, 26), Lf = toW(24, 3);
    const Ms = { x: Ls.x, y: Ls.y, r: ang - 0.8 }, Mf = { x: Lf.x, y: Lf.y, r: ang };
    let M;
    if (t < 0.35) M = Mp;
    else if (t < 0.65) M = mixP(Mp, Mu, ease(seg(t, 0.35, 0.65)));
    else if (t < 1.2)  M = mixP(Mu, Ms, ease(seg(t, 0.65, 1.2)));
    else               M = mixP(Ms, Mf, ease(seg(t, 1.2, 1.5)));
    magPose = M;
    magCurve = lerp(0.3, 1, ease(seg(t, 0.35, 0.65)));
    magInPouch = t < 0.65 && (M.y + 36) > POUCH_A.y;
    magFront = t < 1.25;                                      // при вставке рожок уходит «внутрь» ствольной коробки
    const hp = P => ({ x: P.x + 8 * Math.cos(P.r) - 10 * Math.sin(P.r), y: P.y + 8 * Math.sin(P.r) + 10 * Math.cos(P.r) });
    const handle = toW(7.5 - 20 * bolt, -17);
    if (t < 0.3) off = mix(guard, hp(Mp), ease(seg(t, 0, 0.3)));
    else if (t < 1.55) off = hp(M);
    else if (t < 1.7)  off = mix(hp(Mf), handle, ease(seg(t, 1.55, 1.7)));
    else if (t < 2.0)  off = handle;
    else               off = mix(handle, guard, ease(seg(t, 2.0, 2.5)));
    offHold = null;
    if (t > 1.9 && t < 2.9){
      const u = seg(t, 1.9, 2.9);
      casing = { x: 207 - 18 * u, y: 353 - 46 * u + 160 * u * u, r: u * 9 };
    }
  }

  /* — рисуем, слой за слоем — */
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  drawBody(ctx);                                  // 1. тело
  drawGearBase(ctx, type, slotsGone);             // 2. пояс / петли / разгрузка

  const arm = (S, Hd, w) => {                     // 3. руки (только рука, без кисти)
    const r = ik(S, Hd, 62, 58);
    const path = () => { ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(r.e.x, r.e.y); ctx.lineTo(r.h.x, r.h.y); };
    ctx.strokeStyle = RIM; ctx.lineWidth = w + 3; path(); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = w; path(); ctx.stroke();
  };
  if (off) arm(SHOULDER2, off, 14);
  arm(SHOULDER, H, 15);

  /* 4. то, что лежит ВНУТРИ кобуры/подсумка — под передней панелью */
  if (type === 'pistol' && inHolster){
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); drawRevolver(ctx, pal); ctx.restore();
  }
  if (type === 'akc'){
    ctx.save(); ctx.translate(POUCH_B.x + 9, POUCH_B.y - 6); drawMag(ctx, pal, 0.3); ctx.restore();   // запасной в левом подсумке
    if (magInPouch){ ctx.save(); ctx.translate(magPose.x, magPose.y); ctx.rotate(magPose.r); drawMag(ctx, pal, magCurve); ctx.restore(); }
  }

  drawGearFront(ctx, type);                       // 5. панели поверх

  /* 6. рожок до вставки — перед оружием; после — «внутри» ствольной коробки, т.е. позади неё */
  const drawMagFree = () => { ctx.save(); ctx.translate(magPose.x, magPose.y); ctx.rotate(magPose.r); drawMag(ctx, pal, magCurve); ctx.restore(); };
  if (type === 'akc' && !magInPouch && !magFront) drawMagFree();

  /* 7. оружие */
  if (!(type === 'pistol' && inHolster)){
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
    if (type === 'pistol') drawRevolver(ctx, pal);
    else if (type === 'shotgun') drawShotgun(ctx, pal, open);
    else drawAKC(ctx, pal, bolt);
    ctx.restore();
  }

  /* 8. предметы в руках — поверх оружия */
  if (type === 'akc' && !magInPouch && magFront) drawMagFree();
  shells.forEach(sh => drawShell(ctx, sh.x, sh.y, sh.r));
  for (let i = 0; i < brass; i++){
    const b = toW(27, -7 + i * 5);
    ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, 7); ctx.fill();
  }
  if (casing){
    ctx.save(); ctx.translate(casing.x, casing.y); ctx.rotate(casing.r);
    ctx.fillStyle = '#d9b44a'; ctx.fillRect(-4, -1.6, 8, 3.2); ctx.restore();
  }

  /* 9. кисти — самый верхний слой, с контуром, чтобы читались поверх оружия */
  const hand = (P, r) => {
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7);
    ctx.fillStyle = '#0b0e13'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,180,230,.4)'; ctx.lineWidth = 1.3; ctx.stroke();
  };
  if (off) hand(off, 7);
  hand(H, 7.5);

  ctx.restore();
}

/* ═══════════════ часть 2: ОТ ПЕРВОГО ЛИЦА ═══════════════ */
const FCX = 180;                  // ось прицеливания
const FHOR = 300;                 // горизонт
const FTY = 336;                  // центр центральной мишени

function fpTarget(ctx, x, y, r){
  ctx.fillStyle = '#0c1016'; ctx.fillRect(x - 1.8, y, 3.6, r * 3.2);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + r * 3.2, r * 0.9, r * 0.22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#10141b'; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, 7); ctx.fill();
  [[1, '#e9e9e9'], [0.72, '#c0392b'], [0.45, '#e9e9e9'], [0.2, '#c0392b']].forEach(q => {
    ctx.fillStyle = q[1]; ctx.beginPath(); ctx.arc(x, y, r * q[0], 0, 7); ctx.fill();
  });
}

function fpBackground(ctx, px, py){
  let g = ctx.createLinearGradient(0, -300, 0, FHOR);
  g.addColorStop(0, '#04060a'); g.addColorStop(1, '#1c2535');
  ctx.fillStyle = g; ctx.fillRect(-900, -900, 2200, FHOR + 900 + py);
  g = ctx.createLinearGradient(0, FHOR, 0, 760);
  g.addColorStop(0, '#141b27'); g.addColorStop(1, '#06080c');
  ctx.fillStyle = g; ctx.fillRect(-900, FHOR + py, 2200, 1200);
  ctx.fillStyle = '#0a0d13'; ctx.fillRect(-900, FHOR - 34 + py, 2200, 36);        // земляной вал
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(-900, FHOR - 34 + py, 2200, 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  const vx = FCX + px * 0.8, vy = FHOR + py;
  for (let i = -10; i <= 10; i++){ ctx.beginPath(); ctx.moveTo(vx + i * 14, vy); ctx.lineTo(vx + i * 190, 900); ctx.stroke(); }
  for (let k = 1; k < 8; k++){ const y = vy + Math.pow(k / 7, 2.2) * 440; ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(700, y); ctx.stroke(); }
  const lg = ctx.createRadialGradient(FCX + px, FTY + py, 6, FCX + px, FTY + py + 20, 230);
  lg.addColorStop(0, 'rgba(255,255,255,.17)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(-100, 100, 600, 560);
  // потолочные лампы тира
  [-190, 0, 190].forEach(dx => {
    const lx = FCX + dx + px * 0.35, ly = 24 + py * 0.3;
    const cg = ctx.createLinearGradient(0, ly, 0, ly + 190);
    cg.addColorStop(0, 'rgba(255,244,214,.20)'); cg.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = cg; poly(ctx, [[lx - 10, ly + 4], [lx + 10, ly + 4], [lx + 60, ly + 190], [lx - 60, ly + 190]]); ctx.fill();
    ctx.fillStyle = '#e9dfc3'; rr(ctx, lx - 14, ly, 28, 5, 2); ctx.fill();
  });
  // мишени: левая, ЦЕНТРАЛЬНАЯ, правая
  fpTarget(ctx, FCX - 84 + px, FTY - 8 + py, 18);
  fpTarget(ctx, FCX + 84 + px, FTY - 8 + py, 18);
  fpTarget(ctx, FCX + px, FTY + py, 24);
}

/* — «перчатки»/рукава от первого лица — */
function fpHand(ctx, x, y, w, h, rot, seams){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  rr(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.45);
  ctx.fillStyle = '#0a0c10'; ctx.fill(); ctx.strokeStyle = 'rgba(150,180,230,.34)'; ctx.lineWidth = 1.4; ctx.stroke();
  if (seams !== false){                                       // швы пальцев на кулаке
    ctx.strokeStyle = 'rgba(150,180,230,.17)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++){ const xx = -w / 2 + w * i / 4; ctx.beginPath(); ctx.moveTo(xx, -h / 2 + 3); ctx.lineTo(xx, -h / 2 + h * 0.36); ctx.stroke(); }
  }
  ctx.restore();
}
function fpSleeve(ctx, pts){
  poly(ctx, pts); ctx.fillStyle = '#07090c'; ctx.fill(); ctx.strokeStyle = 'rgba(150,180,230,.18)'; ctx.lineWidth = 1.2; ctx.stroke();
}

function fpRevolver(ctx, p){
  const cx = FCX;
  fpSleeve(ctx, [[cx - 110, 650], [cx - 70, 600], [cx - 34, 612], [cx - 52, 650]]);
  fpSleeve(ctx, [[cx + 110, 650], [cx + 70, 600], [cx + 34, 612], [cx + 52, 650]]);
  ctx.fillStyle = p.barrel; poly(ctx, [[cx - 26, 522], [cx + 26, 522], [cx + 9, 434], [cx - 9, 434]]); ctx.fill();     // ствол
  ctx.fillStyle = p.accent; ctx.globalAlpha = 0.55; poly(ctx, [[cx - 4, 522], [cx + 4, 522], [cx + 2, 434], [cx - 2, 434]]); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = p.body; rr(ctx, cx - 11, 428, 22, 9, 3); ctx.fill();                                               // дульный срез
  ctx.fillStyle = p.sight; rr(ctx, cx - 3.2, 402, 6.4, 30, 1.2); ctx.fill();                                          // МУШКА
  ctx.fillStyle = p.body; rr(ctx, cx - 62, 548, 26, 64, 9); ctx.fill(); rr(ctx, cx + 36, 548, 26, 64, 9); ctx.fill(); // барабан
  ctx.fillStyle = p.barrel; ctx.fillRect(cx - 54, 556, 2, 48); ctx.fillRect(cx + 52, 556, 2, 48);
  ctx.fillStyle = p.body; poly(ctx, [[cx - 40, 520], [cx + 40, 520], [cx + 48, 650], [cx - 48, 650]]); ctx.fill();     // рамка
  ctx.fillStyle = p.accent; ctx.globalAlpha = 0.35; ctx.fillRect(cx - 40, 521, 80, 2); ctx.globalAlpha = 1;
  ctx.fillStyle = p.barrel; rr(ctx, cx - 36, 546, 28, 20, 2); ctx.fill(); rr(ctx, cx + 8, 546, 28, 20, 2); ctx.fill();  // ЦЕЛИК с прорезью
  ctx.fillStyle = p.barrel; poly(ctx, [[cx - 8, 596], [cx + 8, 596], [cx + 5, 628], [cx - 5, 628]]); ctx.fill();         // курок
  fpHand(ctx, cx - 42, 624, 54, 50, -0.1);  fpHand(ctx, cx + 42, 624, 54, 50, 0.1);          // ладони на рукояти
  fpHand(ctx, cx - 38, 582, 13, 52, 0.1, false); fpHand(ctx, cx + 38, 582, 13, 52, -0.1, false); // большие пальцы вдоль рамки
}

function fpShotgun(ctx, p){
  const cx = FCX;
  fpSleeve(ctx, [[cx - 150, 650], [cx - 100, 650], [cx - 56, 528], [cx - 90, 510]]);                                  // левая рука под цевьё
  ctx.fillStyle = p.grip; poly(ctx, [[cx - 40, 600], [cx + 40, 600], [cx + 52, 650], [cx - 52, 650]]); ctx.fill();    // шейка приклада
  [-1, 1].forEach(sd => {                                                                                              // два ствола
    ctx.fillStyle = p.barrel;
    poly(ctx, [[cx + sd * 3, 566], [cx + sd * 40, 566], [cx + sd * 14, 424], [cx + sd * 2, 424]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    poly(ctx, [[cx + sd * 14, 566], [cx + sd * 20, 566], [cx + sd * 8, 424], [cx + sd * 5, 424]]); ctx.fill();
    ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.ellipse(cx + sd * 8, 423, 6, 2.4, 0, 0, 7); ctx.fill();            // дуло
  });
  ctx.fillStyle = p.accent; poly(ctx, [[cx - 4, 566], [cx + 4, 566], [cx + 1.6, 422], [cx - 1.6, 422]]); ctx.fill();   // планка
  ctx.fillStyle = p.sight; ctx.beginPath(); ctx.arc(cx, 418, 4.2, 0, 7); ctx.fill();                                   // МУШКА-бусина
  ctx.fillStyle = p.body; poly(ctx, [[cx - 58, 562], [cx + 58, 562], [cx + 70, 650], [cx - 70, 650]]); ctx.fill();     // колодка
  ctx.fillStyle = p.accent; ctx.globalAlpha = 0.45; ctx.fillRect(cx - 58, 563, 116, 2); ctx.globalAlpha = 1;
  ctx.fillStyle = p.barrel; rr(ctx, cx - 5, 570, 10, 36, 4); ctx.fill();                                              // рычаг
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(cx - 36, 586, 3, 0, 7); ctx.arc(cx + 36, 586, 3, 0, 7); ctx.fill();
  fpHand(ctx, cx - 62, 524, 26, 62, 0.14);                                                                             // левая кисть у цевья
  fpHand(ctx, cx + 62, 628, 56, 48, 0.15); fpHand(ctx, cx + 34, 596, 13, 46, -0.45, false);                            // правая и большой палец
}

function fpAKC(ctx, p){
  const cx = FCX;
  fpSleeve(ctx, [[cx - 140, 650], [cx - 96, 650], [cx - 48, 520], [cx - 78, 500]]);
  ctx.fillStyle = p.grip; poly(ctx, [[cx - 27, 580], [cx + 27, 580], [cx + 10, 434], [cx - 10, 434]]); ctx.fill();     // цевьё
  ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 6; i++) ctx.fillRect(cx - 20 + i * 0.5, 470 + i * 18, 40 - i * 4, 2);
  ctx.fillStyle = p.barrel; poly(ctx, [[cx - 13, 580], [cx + 13, 580], [cx + 5, 424], [cx - 5, 424]]); ctx.fill();     // газовая трубка
  ctx.fillStyle = 'rgba(255,255,255,.12)'; poly(ctx, [[cx - 4, 580], [cx + 1, 580], [cx - 1, 424], [cx - 3, 424]]); ctx.fill();
  ctx.fillStyle = p.body; rr(ctx, cx - 13, 420, 26, 13, 3); ctx.fill();                                               // газовый блок
  ctx.fillStyle = p.barrel; rr(ctx, cx - 13, 392, 4, 32, 1); ctx.fill(); rr(ctx, cx + 9, 392, 4, 32, 1); ctx.fill();   // «уши» мушки
  ctx.fillStyle = p.sight; rr(ctx, cx - 2.3, 386, 4.6, 38, 1); ctx.fill();                                            // МУШКА
  ctx.fillStyle = p.body; poly(ctx, [[cx - 34, 570], [cx + 34, 570], [cx + 40, 608], [cx - 40, 608]]); ctx.fill();     // основание целика
  ctx.fillStyle = p.barrel; rr(ctx, cx - 28, 548, 20, 26, 2); ctx.fill(); rr(ctx, cx + 8, 548, 20, 26, 2); ctx.fill(); // ЦЕЛИК (прорезь 16 px)
  ctx.fillStyle = p.accent; ctx.fillRect(cx - 28, 548, 20, 2); ctx.fillRect(cx + 8, 548, 20, 2);
  ctx.fillStyle = p.body; poly(ctx, [[cx - 46, 600], [cx + 46, 600], [cx + 54, 650], [cx - 54, 650]]); ctx.fill();     // крышка ствольной коробки
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(cx - 40, 614, 80, 2); ctx.fillRect(cx - 44, 630, 88, 2);
  fpHand(ctx, cx - 36, 500, 16, 54, 0.12); fpHand(ctx, cx + 36, 500, 16, 54, -0.12);                                  // левая рука держит цевьё снизу
  fpHand(ctx, cx + 64, 630, 50, 46, 0.2); fpHand(ctx, cx + 46, 602, 12, 42, -0.35, false);
}

const FP_DRAW = { pistol: fpRevolver, shotgun: fpShotgun, akc: fpAKC };

const panAt = tf => track(tf, [[0, 125], [0.55, 125], [1.4, -92], [1.95, 10], [2.25, -2], [FP_DUR, 0]])[0];

function drawFP(ctx, type, tf, pal){
  const settle = ease(seg(tf, 1.5, 2.3)), amp = 1 - 0.82 * settle;
  const swx = Math.sin(tf * 2.1) * 2.4 * amp, swy = Math.sin(tf * 1.6 + 0.8) * 2.6 * amp + Math.sin(tf * 5.1) * 0.6 * amp;
  const vel = (panAt(tf) - panAt(Math.max(0, tf - 0.04))) / 0.04;
  const px = panAt(tf) + swx * 1.5, py = swy * 1.2;
  const rise = 1 - Math.pow(1 - seg(tf, 0, 0.65), 3);
  const lag = clamp(-vel * 0.03, -10, 10);

  fpBackground(ctx, px, py);

  // «захват» цели: кольцо сжимается на центральной мишени
  const u = seg(tf, 1.85, 2.5);
  if (u > 0){
    const x = FCX + px, y = FTY + py, r = lerp(58, 30, ease(u));
    ctx.save(); ctx.globalAlpha = Math.min(1, u * 3); ctx.strokeStyle = pal.sight; ctx.lineWidth = 1.6;
    ctx.shadowColor = pal.sight; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => {
      ctx.beginPath(); ctx.moveTo(x + d[0] * (r - 7), y + d[1] * (r - 7)); ctx.lineTo(x + d[0] * (r + 9), y + d[1] * (r + 9)); ctx.stroke();
    });
    ctx.restore();
  }

  // оружие
  ctx.save();
  ctx.translate(lag + swx * 0.35, (1 - rise) * 330 + swy * 0.35);
  const k = { pistol: 1.18, shotgun: 1.19, akc: 1.15 }[type];       // крупнее: ближе к глазу
  ctx.translate(FCX, 660); ctx.scale(k, k); ctx.translate(-FCX, -660);
  FP_DRAW[type](ctx, pal);
  ctx.restore();

  // виньетка — «тоннельное» зрение
  const vg = ctx.createRadialGradient(FCX, 330, 160, FCX, 330, 470);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.62)');
  ctx.fillStyle = vg; ctx.fillRect(-900, -900, 2200, 2500);
}

/* ───────────── жизненный цикл ───────────── */
let host = null, cv = null, ctx = null, raf = 0, startT = 0, running = false;
let resolveFn = null, curType = 'pistol', pal = null, skipBtn = null, safety = 0;

function size(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv._w = w; cv._h = h; cv._dpr = dpr;
}

function render(t){
  const D = DURATION[curType], A = A_DUR[curType];
  const w = cv._w, h = cv._h, dpr = cv._dpr;
  const sc = Math.min(w / SW, h / SH);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate((w - SW * sc) / 2, (h - SH * sc) / 2); ctx.scale(sc, sc);

  if (t < A + ZOOM){
    // часть 1 + «нырок» в голову
    if (t > A){
      const u = seg(t, A, A + ZOOM), z = Math.exp(Math.log(30) * Math.pow(u, 1.5));
      ctx.translate(HEAD.x, HEAD.y); ctx.scale(z, z); ctx.translate(-HEAD.x, -HEAD.y);
    }
    drawBackground(ctx);
    drawThird(ctx, curType, Math.min(t, A), pal);
  } else {
    drawFP(ctx, curType, t - A - ZOOM, pal);
  }
  ctx.restore();

  // затемнения: вход, «нырок→первое лицо», выход
  const z0 = A + ZOOM;
  const fade = Math.max(
    1 - seg(t, 0, 0.35),
    seg(t, z0 - ZOOM * 0.22, z0) * (1 - seg(t, z0, z0 + 0.35)),
    seg(t, D - 0.35, D)
  );
  if (fade > 0){ ctx.fillStyle = 'rgba(0,0,0,' + fade + ')'; ctx.fillRect(0, 0, w, h); }
}

function onResize(){ if (cv) size(); }

function finish(){
  if (!running && !resolveFn) return;
  running = false;
  cancelAnimationFrame(raf); clearTimeout(safety);
  window.removeEventListener('resize', onResize);
  if (host){ host.classList.add('hidden'); host.innerHTML = ''; }
  host = cv = ctx = skipBtn = null;
  const r = resolveFn; resolveFn = null;
  if (r) r();
}

function mount(overlay, forceType){
  host = overlay;
  curType = forceType || detect();
  pal = palette(curType);
  host.classList.remove('hidden');
  host.innerHTML = '';
  cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;background:#000';
  host.appendChild(cv);
  ctx = cv.getContext('2d');
  size();
}

function play(overlay, forceType){
  if (running) finish();
  return new Promise(resolve => {
    resolveFn = resolve;
    mount(overlay, forceType);
    window.addEventListener('resize', onResize);

    skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Пропустить ▸';
    skipBtn.style.cssText = 'position:absolute;right:14px;top:max(14px,env(safe-area-inset-top));' +
      'z-index:2;padding:9px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.35);' +
      'background:rgba(0,0,0,.45);color:#fff;font:600 14px system-ui,sans-serif;' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);cursor:pointer;';
    skipBtn.addEventListener('click', e => { e.stopPropagation(); finish(); });
    host.appendChild(skipBtn);

    running = true; startT = performance.now();
    render(0);
    const D = DURATION[curType];
    const loop = () => {
      if (!running) return;
      const t = (performance.now() - startT) / 1000;
      if (t >= D){ finish(); return; }
      render(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    safety = setTimeout(finish, D * 1000 + 600);
  });
}

window.IntroCutscene = {
  play, stop: finish, detect,
  DURATION, A_DUR, ZOOM, FP_DUR,
  /* для отладки: показать один кадр без анимации */
  debug: { frame: (overlay, type, t) => { mount(overlay, type); render(t); } }
};

})();
