/* ═══════════════════════════════════════════════════════════════
   WEAPON FX — общие помощники для новых видов оружия
   • синтезированные звуки (WebAudio) — файлы .mp3 не нужны;
   • громкость берётся из настроек игры (Storage.getVolume).
   ═══════════════════════════════════════════════════════════════ */

const WeaponFX = (() => {

  let ctx = null;

  function ac(){
    if (!ctx){
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function(){});
    return ctx;
  }

  function vol(){
    try { return Math.max(0, Math.min(1, Storage.getVolume() / 100)); }
    catch(e){ return .7; }
  }

  /* Тон со скольжением частоты и затуханием */
  function tone(o){
    const a = ac(); const v = vol();
    if (!a || v <= 0) return;
    const t0 = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    const peak = (o.gain || .3) * v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /* Шумовой всплеск с фильтром */
  function noise(o){
    const a = ac(); const v = vol();
    if (!a || v <= 0) return;
    const t0 = a.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(a.sampleRate * o.dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 1500;
    if (o.q) f.Q.value = o.q;
    const g = a.createGain();
    const peak = (o.gain || .3) * v;
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  }

  const sfx = {
    /* Арбалет: щелчок тетивы */
    twang(){
      tone({ type:'triangle', f0:230, f1:92, dur:.38, gain:.42 });
      tone({ type:'square',   f0:520, f1:190, dur:.10, gain:.12 });
      noise({ dur:.05, filter:'highpass', freq:2400, gain:.25 });
    },
    /* Арбалет: болт пробил мишень */
    thunk(){
      tone({ type:'sine', f0:150, f1:58, dur:.14, gain:.45 });
      noise({ dur:.06, filter:'lowpass', freq:900, gain:.25 });
    },
    /* Арбалет: храповик при взводе */
    crank(){
      noise({ dur:.035, filter:'bandpass', freq:2600, q:6, gain:.22 });
      tone({ type:'square', f0:900, f1:600, dur:.025, gain:.05 });
    },
    /* Арбалет: болт встал на ложе — готов */
    ready(){
      tone({ type:'square', f0:1900, f1:1100, dur:.04, gain:.12 });
      tone({ type:'sine',   f0:1320, f1:1320, dur:.09, gain:.10, delay:.04 });
    },
    /* Сухой щелчок — выстрелить нельзя, ещё взводится */
    dry(){
      tone({ type:'square', f0:700, f1:420, dur:.03, gain:.07 });
    },
    /* Краскопульт: «пфух» воздуха */
    pop(){
      noise({ dur:.10, filter:'lowpass', freq:1500, gain:.38 });
      tone({ type:'sine', f0:300, f1:85, dur:.11, gain:.34 });
    },
    /* Краскопульт: шарик лопнул */
    splat(){
      noise({ dur:.20, filter:'lowpass', freq:1900, gain:.34 });
      tone({ type:'sine', f0:210, f1:55, dur:.16, gain:.30 });
    },
    /* Краскопульт: капля шлёпнулась */
    drip(){
      tone({ type:'sine', f0:520, f1:180, dur:.06, gain:.14 });
    }
  };

  return { sfx, tone, noise, vol };
})();
