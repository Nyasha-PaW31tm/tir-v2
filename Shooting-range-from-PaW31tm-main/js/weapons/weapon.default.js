/* ═══════════════════════════════════════════════════════════════
   ОРУЖИЕ: СТАНДАРТНОЕ РУЖЬЁ (default)
   1 выстрел = 1 пуля по прямой к прицелу.
   ═══════════════════════════════════════════════════════════════ */

(function(){

  Weapons.register('default', {

    /* Название для UI */
    name: 'Ружьё',

    /* Обработчик выстрела */
    fire(){
      const G = Game._internals;
      if (!G || !G.getGame()) return;

      /* Проверка: лазер сейчас активен — блок */
      if (window._laserActive) return;

      const rifleWrap = document.getElementById('rifleWrap');
      const flash = document.getElementById('muzzleFlash');

      /* Стата */
      G.addShot();
      G.addRecentShot();

      /* Звук */
      G.playSfx('shot');

      /* Анимация отдачи + вспышка */
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

      /* Пуля */
      G.spawnBullet(0, 0, false);

      /* Проверка попадания */
      const aim = G.getAim();
      const hit = G.findHit(aim.x, aim.y);
      if (hit){
        G.hitTarget(hit);
      } else {
        G.miss();
      }
    },

    /* КД нет */
    canFire(){
      return !window._laserActive;
    },

    /* Сброс — нечего сбрасывать */
    reset(){}
  });

})();