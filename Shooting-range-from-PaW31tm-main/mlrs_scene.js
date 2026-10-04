/* =========================================================
   MLRS CUTSCENE AUDIO
   ========================================================= */

const CUTSCENE_DURATION = 7000;

const engineSound = new Audio("sounds/engine.mp3");
const mechanismSound = new Audio("sounds/mechanism_MLRS.mp3");

const activeShots = [];

engineSound.volume = 0.8;
mechanismSound.volume = 0.9;

/* ─── Плей ─── */
function playEngine(){
  try {
    engineSound.currentTime = 0;
    engineSound.play().catch(() => {});
  } catch(e){}
}

function playMechanism(){
  try {
    mechanismSound.currentTime = 0;
    mechanismSound.play().catch(() => {});
  } catch(e){}
}

function playMLRSShot(){
  try {
    const shot = new Audio("sounds/MLRS_shot.mp3");
    shot.volume = 1.0;
    activeShots.push(shot);
    shot.play().catch(() => {});
    shot.addEventListener("ended", () => {
      const i = activeShots.indexOf(shot);
      if (i !== -1) activeShots.splice(i, 1);
    }, { once: true });
  } catch(e){}
}

function stopAllAudio(){
  try { engineSound.pause(); engineSound.currentTime = 0; } catch(e){}
  try { mechanismSound.pause(); mechanismSound.currentTime = 0; } catch(e){}
  activeShots.forEach((shot) => {
    try { shot.pause(); shot.currentTime = 0; } catch(e){}
  });
  activeShots.length = 0;
}

/* ─── Тайминги запуска ─── */
let _timers = [];

function clearTimers(){
  _timers.forEach(t => clearTimeout(t));
  _timers = [];
}

function startCutsceneAudio(){
  clearTimers();

  _timers.push(setTimeout(playEngine, 0));
  _timers.push(setTimeout(playMechanism, 2000));

  _timers.push(setTimeout(playMLRSShot, 4480));
  _timers.push(setTimeout(playMLRSShot, 4690));
  _timers.push(setTimeout(playMLRSShot, 4830));
  _timers.push(setTimeout(playMLRSShot, 5040));
  _timers.push(setTimeout(playMLRSShot, 5180));
  _timers.push(setTimeout(playMLRSShot, 5390));
  _timers.push(setTimeout(playMLRSShot, 5530));
  _timers.push(setTimeout(playMLRSShot, 5740));

  _timers.push(setTimeout(stopAllAudio, CUTSCENE_DURATION));
}

/* ═══════════════════════════════════════════════════════════════
   ПУБЛИЧНОЕ API
   ═══════════════════════════════════════════════════════════════ */

window.MLRSCutscene = {
  start(){ startCutsceneAudio(); },
  stop(){ clearTimers(); stopAllAudio(); }
};

console.log('[mlrs.cutscene] loaded');

/* Автозапуск, если открыто НАПРЯМУЮ (не из игры) */
if (window.location.pathname.endsWith('scene.html')){
  startCutsceneAudio();
  console.log('[mlrs.cutscene] autostart (standalone mode)');
}