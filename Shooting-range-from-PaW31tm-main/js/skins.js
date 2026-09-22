/* ═══════════════════════════════════════════════════════════════
   SKINS — управление активным скином
   Скин = класс на <body> (skin-neon, skin-star и т.д.).
   Стили скинов лежат в skins/*.css — этот файл только переключает.
   ═══════════════════════════════════════════════════════════════ */

const Skins = (() => {

  const DEFAULT_SKIN = 'default';
  let currentSkin = DEFAULT_SKIN;

  /* Убираем все классы вида skin-XXX с body */
  function clearSkinClasses(){
    const body = document.body;
    const toRemove = [];
    body.classList.forEach(cls => {
      if (cls.startsWith('skin-')) toRemove.push(cls);
    });
    toRemove.forEach(cls => body.classList.remove(cls));
  }

  /* Применить скин */
  function apply(skinId) {
  const id = (skinId || DEFAULT_SKIN).toString().trim();
  clearSkinClasses();
  
  if (id && id !== DEFAULT_SKIN) {
    document.body.classList.add('skin-' + id);
  }
  
  currentSkin = id;
  Storage.setActiveSkin(id);
  console.log('[skins] applied:', id);
}

/* ★ Применение скина мишеней */
function applyTargetSkin(targetId) {
  const id = (targetId || 'default').toString().trim();
  
  // Убираем старые классы мишеней
  document.body.classList.forEach(c => {
    if (c.startsWith('target-skin-')) document.body.classList.remove(c);
  });
  
  if (id !== 'default' && id !== 'tg_classic') {
    document.body.classList.add('target-skin-' + id.replace(/^tg_/, ''));
  }
  
  Storage.setActiveTargetSkin(id);
  console.log('[skins] target applied:', id);
}

function loadTargetFromStorage() {
  const saved = Storage.getActiveTargetSkin() || 'default';
  applyTargetSkin(saved);
}

  /* Текущий скин */
  function current(){
    return currentSkin;
  }

  /* Применить скин из localStorage (при старте) */
  function loadFromStorage(){
    const saved = Storage.getActiveSkin() || DEFAULT_SKIN;
    apply(saved);
  }

  return {
  apply,
  current,
  loadFromStorage,
  applyTargetSkin,
  loadTargetFromStorage,
  DEFAULT_SKIN
};
})();