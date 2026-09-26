/* ═══════════════════════════════════════════════════════════════
   STORAGE — обёртки localStorage
   ═══════════════════════════════════════════════════════════════ */

const Storage = (() => {
  const PREFIX = 'tir_';

  function get(key, fallback = null){
    try { const v = localStorage.getItem(PREFIX + key); return v === null ? fallback : v; } catch(e){ return fallback; }
  }
  function set(key, value){
    try { localStorage.setItem(PREFIX + key, String(value)); } catch(e){}
  }
  function remove(key){
    try { localStorage.removeItem(PREFIX + key); } catch(e){}
  }
  function getJSON(key, fallback){
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch(e){ return fallback; }
  }
  function setJSON(key, value){
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch(e){}
  }

  return {
    get, set, remove, getJSON, setJSON,

    getBackground: () => get('bg', 'dark'),
    setBackground: (v) => set('bg', v),

    getVolume: () => parseInt(get('volume', '70'), 10),
    setVolume: (v) => set('volume', v),

    isLaserEnabled: () => get('laser', '0') === '1',
    setLaserEnabled: (v) => set('laser', v ? '1' : '0'),
    
    isFpsEnabled: () => get('fps', '0') === '1',
setFpsEnabled: (v) => set('fps', v ? '1' : '0'),

getAuroraSnow: () => get('auroraSnow', '0') === '1',
setAuroraSnow: (v) => set('auroraSnow', v ? '1' : '0'),

getActiveUlt: () => get('activeUlt', 'classic'),
setActiveUlt: (v) => set('activeUlt', v),

    isInfiniteUnlocked: () => get('infiniteUnlocked', '0') === '1',
    unlockInfinite: () => set('infiniteUnlocked', '1'),
    isInfiniteMode: () => get('infiniteMode', '0') === '1',
    setInfiniteMode: (v) => set('infiniteMode', v ? '1' : '0'),

    getCoins: () => parseInt(get('coins', '0'), 10),
    setCoins: (v) => set('coins', String(v)),

    getActiveSkin: () => get('activeSkin', 'default'),
    setActiveSkin: (v) => set('activeSkin', v),
    
    getActiveTargetSkin: () => get('targetSkin', 'default'),
setActiveTargetSkin: (v) => set('targetSkin', v),

    getPersonalBest: () => parseInt(get('personalBest', '0'), 10),
    setPersonalBest: (v) => set('personalBest', String(v)),

    isEasterEggFound: () => get('easterEgg', '0') === '1',
    setEasterEggFound: () => set('easterEgg', '1'),

    /* ★ Китайская пасхалка */
    isChinaUnlocked: () => get('chinaUnlocked', '0') === '1',
    unlockChina: () => set('chinaUnlocked', '1'),

    getHistory: () => getJSON('history', []),
    setHistory: (arr) => setJSON('history', arr),

    clearAll(){
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
      } catch(e){}
    }
  };
})();