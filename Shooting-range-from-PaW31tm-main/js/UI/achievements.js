/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENTS — экран достижений
   BETA 0.11.0
   ═══════════════════════════════════════════════════════════════ */

const Achievements = (() => {

  let currentFilter = 'all';
  let cachedList = [];
  let cachedStats = { total: 0, unlocked: 0, unclaimed: 0 };
  let loading = false;

  const CAT_NAMES = {
    all:      'Все',
    general:  '🎯 Основные',
    win:      '🏆 Победы',
    combo:    '🔥 Комбо',
    score:    '💯 Очки',
    ult:      '⚡ Ульты',
    targets:  '🎯 Мишени',
    shop:     '🛒 Магазин',
    spin:     '🎰 Рулетка',
    boss:     '💀 Боссы',
    daily:    '📅 Заходы'
  };

  /* ─── Тост ─── */
  function showToast(text, ms = 2200){
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#171c25;color:#fff;padding:14px 22px;border-radius:14px;' +
      'border:1px solid #ffd23c;font-weight:700;font-size:14px;z-index:9999;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:90vw;text-align:center;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  /* ─── Формат чисел ─── */
  function fmt(n){
    return Number(n || 0).toLocaleString('ru-RU');
  }

  /* ═══════════════════════════════════════════════════════════════
     РЕНДЕР
     ═══════════════════════════════════════════════════════════════ */

  async function render(){
    if (loading) return;
    loading = true;

    const list = document.getElementById('achList');
    if (list) list.innerHTML = '<div class="ach-empty">Загрузка...</div>';

    try {
      const data = await API.getAchievements();

      if (!data || !data.ok){
        if (list) list.innerHTML = '<div class="ach-empty">Ошибка загрузки</div>';
        loading = false;
        return;
      }

      cachedList = data.list || [];
      cachedStats = data.stats || { total: 0, unlocked: 0, unclaimed: 0 };

      renderStats();
      renderList();
      initFilter();

    } catch(e){
      console.error('[achievements]', e);
      if (list) list.innerHTML = '<div class="ach-empty">Ошибка сети</div>';
    }

    loading = false;
  }

  function renderStats(){
    const countEl = document.getElementById('achCount');
    if (countEl) countEl.textContent = cachedStats.unlocked + ' / ' + cachedStats.total;

    const unclaimedEl = document.getElementById('achUnclaimed');
    if (unclaimedEl) unclaimedEl.textContent = cachedStats.unclaimed;
  }

  function renderList(){
    const list = document.getElementById('achList');
    if (!list) return;

    const filtered = currentFilter === 'all'
      ? cachedList
      : cachedList.filter(a => a.category === currentFilter);

    if (!filtered.length){
      list.innerHTML = '<div class="ach-empty">В этой категории пусто</div>';
      return;
    }

    /* Сортировка: сначала незабранные, потом открытые, потом закрытые */
    const sorted = [...filtered].sort((a, b) => {
      const rank = (x) => {
        if (x.unlocked && !x.claimed) return 0;
        if (x.unlocked && x.claimed) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });

    list.innerHTML = sorted.map(a => {
      /* Закрытое и скрытое — не показываем имя */
      if (a.hidden && !a.unlocked){
        return `
          <div class="ach-row">
            <div class="ach-icon">🔒</div>
            <div class="ach-info">
              <div class="ach-name">???</div>
              <div class="ach-desc">Скрытое достижение</div>
            </div>
            <div class="ach-reward locked">—</div>
          </div>
        `;
      }

      const cls = [];
      if (a.unlocked) cls.push('unlocked');
      if (a.claimed) cls.push('claimed');

      /* Правая часть: забрано / кнопка / замочек */
      let right = '';
      if (a.claimed){
        right = `<div class="ach-reward claimed">✅ Забрано</div>`;
      } else if (a.unlocked){
        right = `<button class="ach-claim-btn" data-id="${a.id}">ЗАБРАТЬ</button>`;
      } else {
        const rewardTxt = [];
        if (a.reward_coins) rewardTxt.push('🪙' + fmt(a.reward_coins));
        if (a.reward_gems)  rewardTxt.push('💎' + a.reward_gems);
        right = `<div class="ach-reward locked">${rewardTxt.join(' · ') || '—'}</div>`;
      }

      return `
        <div class="ach-row ${cls.join(' ')}">
          <div class="ach-icon">${a.unlocked ? a.icon : '🔒'}</div>
          <div class="ach-info">
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.description || ''}</div>
          </div>
          ${right}
        </div>
      `;
    }).join('');

    /* Кнопки «Забрать» */
    list.querySelectorAll('.ach-claim-btn').forEach(btn => {
      btn.onclick = () => onClaim(btn.dataset.id);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ЗАБРАТЬ НАГРАДУ
     ═══════════════════════════════════════════════════════════════ */

  async function onClaim(achId){
    const ach = cachedList.find(a => a.id === achId);
    if (!ach || ach.claimed) return;

    const resp = await API.claimAchievement(achId);

    if (resp && resp.ok){
      ach.claimed = true;
      cachedStats.unclaimed = Math.max(0, cachedStats.unclaimed - 1);

      const parts = [];
      if (resp.coins_earned) parts.push('+' + fmt(resp.coins_earned) + ' 🪙');
      if (resp.gems_earned)  parts.push('+' + resp.gems_earned + ' 💎');
      showToast('✅ ' + (parts.join(' · ') || 'Награда получена'));

      /* Обновляем монеты локально */
      if (resp.total_coins !== undefined){
        Storage.setCoins(resp.total_coins);
        Sync.updateCoinsUI();
      }

      renderStats();
      renderList();
      updateProfileBadge();
    } else {
      showToast('❌ Ошибка получения награды');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ФИЛЬТР
     ═══════════════════════════════════════════════════════════════ */

  function initFilter(){
    const filterBtn = document.getElementById('achFilterBtn');
    const filterMenu = document.getElementById('achFilterMenu');
    const filterLabel = document.getElementById('achFilterLabel');
    const resetBtn = document.getElementById('achResetBtn');

    if (!filterBtn || !filterMenu) return;

    /* Открыть/закрыть меню */
    filterBtn.onclick = () => {
      const isOpen = !filterMenu.classList.contains('hidden');
      if (isOpen){
        filterMenu.classList.add('hidden');
        filterBtn.classList.remove('open');
      } else {
        filterMenu.classList.remove('hidden');
        filterBtn.classList.add('open');
      }
    };

    /* Выбор категории */
    filterMenu.querySelectorAll('.ach-filter-item').forEach(item => {
      item.onclick = () => {
        const cat = item.dataset.cat;
        currentFilter = cat;

        /* Подсветка активного */
        filterMenu.querySelectorAll('.ach-filter-item').forEach(i => {
          i.classList.toggle('active', i === item);
        });

        /* Обновляем label */
        if (filterLabel) filterLabel.textContent = CAT_NAMES[cat] || cat;

        /* Показываем/скрываем кнопку сброса */
        if (resetBtn){
          resetBtn.classList.toggle('hidden', cat === 'all');
        }

        /* Закрываем меню */
        filterMenu.classList.add('hidden');
        filterBtn.classList.remove('open');

        renderList();
      };
    });

    /* Кнопка сброса */
    if (resetBtn){
      resetBtn.onclick = () => {
        currentFilter = 'all';
        if (filterLabel) filterLabel.textContent = 'Все';

        filterMenu.querySelectorAll('.ach-filter-item').forEach(i => {
          i.classList.toggle('active', i.dataset.cat === 'all');
        });

        resetBtn.classList.add('hidden');
        renderList();
      };
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     КРАСНАЯ ТОЧКА НА КНОПКЕ В ПРОФИЛЕ
     ═══════════════════════════════════════════════════════════════ */

  function updateProfileBadge(){
    const btn = document.getElementById('achievementsBtn');
    if (!btn) return;

    if (cachedStats.unclaimed > 0){
      btn.classList.add('has-badge');
      btn.dataset.badge = cachedStats.unclaimed;
    } else {
      btn.classList.remove('has-badge');
      btn.removeAttribute('data-badge');
    }
  }

  /* ─── Проверка при входе (без полного рендера) ─── */
  async function checkBadge(){
    try {
      const data = await API.getAchievements();
      if (data && data.ok){
        cachedStats = data.stats || { total: 0, unlocked: 0, unclaimed: 0 };
        cachedList = data.list || [];
        updateProfileBadge();
      }
    } catch(e){}
  }

  return { render, checkBadge };
})();