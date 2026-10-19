/* ═══════════════════════════════════════════════════════════════
   ОРУЖИЕ: ДРОБОВИК
   Цена: 1500 монет
   ═══════════════════════════════════════════════════════════════ */

(function(){

  const COOLDOWN_MS        = 900;
  const TOTAL_PELLETS      = 10;
  const PELLETS_PER_BARREL = 5;
  const SPREAD_RADIUS      = 65;
  const PELLET_HIT_RADIUS  = 22;
  const BARREL_SHIFT       = 6;

  let lastFireTime = 0;

  function isOnCooldown(){
    return Date.now() - lastFireTime < COOLDOWN_MS;
  }

  function getCooldownLeft(){
    return Math.max(0, COOLDOWN_MS - (Date.now() - lastFireTime));
  }

  function spawnPellet(sx, sy, dx, dy){
    const range = document.getElementById('range');
    if (!range) return;

    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const p = document.createElement('div');
    p.className = 'bullet pv-pellet';
    p.style.left = sx + 'px';
    p.style.top  = sy + 'px';
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    p.style.setProperty('--angle', (angle + 90) + 'deg');
    p.style.animation =
      'bulletTravel ' + Math.max(.08, Math.min(.22, dist / 2200)) + 's linear forwards';

    range.appendChild(p);
    setTimeout(function(){ p.remove(); }, 300);
  }

  Weapons.register('shotgun', {

    name: 'Дробовик',
    price: 1500,
    category: 'weapon',

    canFire: function(){
      return !isOnCooldown();
    },

    fire: function(){
      const G = Game._internals;
      if (!G || !G.getGame()) return;
      if (window._laserActive) return;
      if (isOnCooldown()) return;

      const range = document.getElementById('range');
      if (!range) return;

      lastFireTime = Date.now();

      const rifleWrap = document.getElementById('rifleWrap');
      const flash     = document.getElementById('muzzleFlash');

      G.addShot();
      G.addRecentShot();
      G.playSfx('shotgun');

      if (rifleWrap){
        rifleWrap.classList.remove('recoil', 'pump-action');
        void rifleWrap.offsetWidth;
        rifleWrap.classList.add('recoil', 'pump-action');
      }
      if (flash){
        flash.classList.remove('fire');
        void flash.offsetWidth;
        flash.classList.add('fire');
      }

      const g = G.getAimGeom();
      const r = range.getBoundingClientRect();

      const aimPx = g.tx;
      const aimPy = g.ty;

      let anyHit = false;

      for (let i = 0; i < TOTAL_PELLETS; i++){
        const side      = i < PELLETS_PER_BARREL ? -1 : 1;
        const sideShift = side * BARREL_SHIFT;

        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist  = Math.random() * SPREAD_RADIUS;

        const endX = aimPx + Math.cos(offsetAngle) * offsetDist;
        const endY = aimPy + Math.sin(offsetAngle) * offsetDist;

        const dx = endX - g.mx;
        const dy = endY - g.my;

        spawnPellet(g.mx + sideShift, g.my, dx - sideShift, dy);

        const pxPercent = endX / r.width  * 100;
        const pyPercent = endY / r.height * 100;

        const hit = G.findHit(pxPercent, pyPercent, PELLET_HIT_RADIUS);
        if (hit && hit.hp > 0){
          anyHit = true;
          G.hitTargetNoMiss(hit);
        }
      }

      if (!anyHit) G.miss();
    },

    isOnCooldown: isOnCooldown,
    getCooldownLeft: getCooldownLeft,

    reset: function(){
      lastFireTime = 0;
    }
  });

})();