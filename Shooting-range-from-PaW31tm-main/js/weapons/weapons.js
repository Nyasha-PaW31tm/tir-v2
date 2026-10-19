/* ═══════════════════════════════════════════════════════════════
   WEAPONS — реестр оружий + подмена модели
   ═══════════════════════════════════════════════════════════════ */

const Weapons = (() => {

  const registry = {};

  /* HTML-модели оружия (innerHTML для #rifle) */
  const MODELS = {
    shotgun: `
      <div class="sg-inner" data-muzzle-distance="148">
        <div class="sg-barrels">
          <div class="sg-barrel-l"></div>
          <div class="sg-barrel-r"></div>
        </div>
        <div class="sg-rib"></div>
        <div class="sg-front-sight"></div>
        <div class="sg-highlight"></div>
        <div class="sg-forearm"></div>
        <div class="sg-hinge"></div>
        <div class="sg-receiver"></div>
        <div class="sg-rear-sight"></div>
        <div class="sg-pin sg-pin-left"></div>
        <div class="sg-pin sg-pin-right"></div>
        <div class="sg-trigger-guard"></div>
        <div class="sg-trigger-l"></div>
        <div class="sg-trigger-r"></div>
        <div class="sg-stock"></div>
      </div>
    `
  };

  /* Стандартная модель — сохранена из старого index.html */
  const DEFAULT_MODEL = `
    <div class="rifle-stock"></div>
    <div class="rifle-grip"></div>
    <div class="rifle-receiver">
      <div class="rifle-bolt-handle"></div>
    </div>
    <div class="rifle-barrel"></div>
    <div class="rifle-front-sight"></div>
    <div class="rifle-rear-sight"></div>
    <div class="rifle-muzzle"></div>
  `;

  function register(id, config){
    registry[id] = Object.assign({ id }, config);
    console.log('[weapons] registered:', id);
  }

  function getActive(){
    for (const id in registry){
      if (document.body.classList.contains('skin-' + id)) return id;
    }
    return null;
  }

  function apply(id){
    const rifle = document.getElementById('rifle');
    if (!rifle) return;

    /* Снять старые классы weapon-* */
    Array.from(rifle.classList).forEach(c => {
      if (c.startsWith('weapon-')) rifle.classList.remove(c);
    });

    /* Вставить нужную модель */
    if (id && MODELS[id]){
      rifle.innerHTML = MODELS[id];
      rifle.classList.add('weapon-' + id);
    } else {
      rifle.innerHTML = DEFAULT_MODEL;
    }

    /* Сброс кэша длины дула */
    if (typeof Game !== 'undefined' && Game._internals && Game._internals.resetMuzzleCache){
      Game._internals.resetMuzzleCache();
    }

    console.log('[weapons] model applied:', id || 'default');
  }

  function applyFromBody(){
    const id = getActive();
    apply(id);
  }

  function fire(){
    const id = getActive();
    if (!id) return false;
    const w = registry[id];
    if (w && typeof w.fire === 'function'){
      w.fire();
      return true;
    }
    return false;
  }

  function canFire(){
    const id = getActive();
    if (!id) return true;
    const w = registry[id];
    if (w && typeof w.canFire === 'function') return w.canFire();
    return true;
  }

  function getConfig(){
    const id = getActive();
    return id ? registry[id] : null;
  }

  function reset(){
    for (const id in registry){
      const w = registry[id];
      if (typeof w.reset === 'function') w.reset();
    }
  }

  return {
    register,
    apply,
    applyFromBody,
    getActive,
    fire,
    canFire,
    getConfig,
    reset
  };
})();