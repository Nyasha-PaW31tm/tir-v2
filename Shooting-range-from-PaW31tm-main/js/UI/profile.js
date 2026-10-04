/* ═══════════════════════════════════════════════════════════════
   PROFILE — профиль игрока
   BETA 0.11.0
   ═══════════════════════════════════════════════════════════════ */

const Profile = (() => {
      
      let cachedData = null;
      let cachedBgs = null;
      let cachedFrames = null;
      
      /* ═══════════════════════════════════════════════════════════════
         ЛОКАЛЬНЫЙ КАТАЛОГ АВАТАРОК — 9 ШТУК
         Файлы: images/ava01.png ... images/ava09.png
         ═══════════════════════════════════════════════════════════════ */
      const AVATARS = [
        { id: 'ava01', name: 'Тень', price: 0, owned: true },
        { id: 'ava02', name: 'Неко', price: 300, owned: false },
        { id: 'ava03', name: 'Спецназ', price: 300, owned: false },
        { id: 'ava04', name: 'Богач', price: 400, owned: false },
        { id: 'ava05', name: 'Геймер', price: 300, owned: false },
        { id: 'ava06', name: 'Эльф', price: 300, owned: false },
        { id: 'ava07', name: 'Турист', price: 300, owned: false },
        { id: 'ava08', name: 'Хакер', price: 300, owned: false },
        { id: 'ava09', name: 'Снайпер', price: 300, owned: false }
      ];

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

  /* ─── Редкость ─── */
  function getRarity(value){
    if (!value) return '';
    if (value <= 50)  return 'common';
    if (value <= 100) return 'uncommon';
    if (value <= 200) return 'rare';
    if (value <= 500) return 'epic';
    if (value <= 800) return 'legendary';
    return 'mythic';
  }

  /* ─── Дата ─── */
  function formatDate(unix){
    if (!unix) return '—';
    const d = new Date(unix * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${mon}.${year}`;
  }

  function fmt(n){
    return Number(n || 0).toLocaleString('ru-RU');
  }

  /* ═══════════════════════════════════════════════════════════════
     РЕНДЕР ПРОФИЛЯ
     ═══════════════════════════════════════════════════════════════ */

  function render(){
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = 'Загрузка...';

    API.getProfileExtended().then(data => {
      if (!data || !data.ok){
        if (nameEl) nameEl.textContent = 'Ошибка';
        showToast('Не удалось загрузить профиль');
        return;
      }
      cachedData = data;
      applyData(data);
    }).catch(e => {
      console.error('[profile]', e);
      if (nameEl) nameEl.textContent = 'Ошибка';
    });
  }

  function applyData(p){
    const name = p.display_name || p.custom_name || p.username || p.first_name || 'Игрок';
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = name;

    const uidEl = document.getElementById('profileUid');
    if (uidEl) uidEl.textContent = p.telegram_id || '—';

    const regEl = document.getElementById('profileReg');
    if (regEl) regEl.textContent = formatDate(p.created_at);

    /* Аватар */
    const avEl = document.getElementById('profileAvatar');
    const iconEl = document.getElementById('profileAvatarIcon');

    if (avEl && iconEl){
      const oldImg = avEl.querySelector('img');
      if (oldImg) oldImg.remove();

      if (p.avatar_url){
        const img = document.createElement('img');
        img.src = p.avatar_url;
        img.alt = '';
        img.onerror = () => { img.remove(); if (iconEl) iconEl.style.display = ''; };
        iconEl.style.display = 'none';
        avEl.appendChild(img);
      } else if (p.avatar_id){
  const img = document.createElement('img');
  img.src = 'images/' + p.avatar_id + '.png';
        img.alt = '';
        img.onerror = () => { img.remove(); if (iconEl) iconEl.style.display = ''; };
        iconEl.style.display = 'none';
        avEl.appendChild(img);
      } else {
        iconEl.style.display = '';
      }

      avEl.dataset.frame = p.profile_frame || 'default';
    }

    setText('profRuns',  fmt(p.total_runs));
    setText('profCoins', fmt(p.coins));
    setText('profBest',  fmt(p.personal_best));
    setText('profCombo', '×' + Number(p.best_combo || 1).toFixed(1));
    setText('profSpins', fmt(p.spin_total));

    const prizeEl = document.getElementById('profBestPrize');
    if (prizeEl){
      if (p.spin_best && p.spin_best > 0){
        prizeEl.textContent = '🪙 ' + fmt(p.spin_best);
        prizeEl.className = 'profile-stat-value rarity-' + getRarity(p.spin_best);
      } else {
        prizeEl.textContent = '—';
        prizeEl.className = 'profile-stat-value';
      }
    }

    /* Фон профиля — применяем к карточке */
    const card = document.querySelector('#screenProfile .profile-card');
    if (card && p.profile_bg){
      /* Просто оставляем на будущее — визуал пока в разработке */
      card.dataset.pbg = p.profile_bg;
    }
  }

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ═══════════════════════════════════════════════════════════════
     НАСТРОЙКИ ПРОФИЛЯ
     ═══════════════════════════════════════════════════════════════ */

  function renderSettings(){
    if (!cachedData){
      API.getProfileExtended().then(d => {
        if (d && d.ok){ cachedData = d; checkNameCooldown(); }
      });
    } else {
      checkNameCooldown();
    }

    bind('changeNameBtn', onNameClick);
    bind('changeAvatarBtn', openAvatarPicker);
    bind('changeBgBtn', openBgPicker);
    bind('changeFrameBtn', openFramePicker);
  }

  function bind(id, handler){
    const el = document.getElementById(id);
    if (el) el.onclick = handler;
  }

  function checkNameCooldown(){
    const cdEl = document.getElementById('nameCooldown');
    if (!cdEl || !cachedData) return;

    const changes = cachedData.name_changes_count || 0;
    const lastChange = cachedData.name_last_change || 0;

    if (changes === 0){
      cdEl.textContent = '✏️ Первая смена имени — бесплатно';
      cdEl.classList.remove('hidden');
      return;
    }

    const CD = 259200;
    const left = CD - (Math.floor(Date.now() / 1000) - lastChange);

    if (left > 0){
      const h = Math.floor(left / 3600);
      const m = Math.floor((left % 3600) / 60);
      cdEl.textContent = `⏳ Следующая смена через ${h}ч ${m}м · 500 🪙`;
    } else {
      cdEl.textContent = '💸 Смена имени: 500 🪙';
    }
    cdEl.classList.remove('hidden');
  }

  async function onNameClick(){
    const current = cachedData?.display_name || '';
    const newName = prompt('Введи новое имя (1–16 символов):', current);
    if (!newName) return;

    const trimmed = newName.trim();
    if (trimmed.length < 1 || trimmed.length > 16){
      showToast('Имя должно быть 1–16 символов');
      return;
    }

    showToast('⏳ Проверяем...', 800);

    const resp = await API.changeName(trimmed);

    if (resp && resp.ok){
      showToast(resp.free ? '✅ Имя изменено (бесплатно)' : '✅ Имя изменено · −' + resp.cost + ' 🪙');
      if (cachedData){
        cachedData.custom_name = trimmed;
        cachedData.display_name = trimmed;
        cachedData.name_changes_count = (cachedData.name_changes_count || 0) + 1;
        cachedData.name_last_change = Math.floor(Date.now() / 1000);
      }
      checkNameCooldown();
      applyData(cachedData || {});
    } else if (resp && resp.error === 'cooldown'){
      const left = resp.next_in || 0;
      const h = Math.floor(left / 3600);
      const m = Math.floor((left % 3600) / 60);
      showToast(`⏳ Смена через ${h}ч ${m}м`);
    } else if (resp && resp.error === 'not enough coins'){
      showToast('🪙 Не хватает монет (нужно 500)');
    } else if (resp && resp.error === 'invalid name'){
      showToast('❌ Имя содержит запрещённые слова');
    } else {
      showToast('❌ Ошибка смены имени');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PICKER — АВАТАРКА
     ═══════════════════════════════════════════════════════════════ */

  function openAvatarPicker(){
  Menu.showScreen('avatarPicker');

  const grid = document.getElementById('avatarGrid');
  if (!grid) return;

  renderAvatarGrid();
}

  function renderAvatarGrid(){
  const grid = document.getElementById('avatarGrid');
  if (!grid) return;

  const current = cachedData?.avatar_id || null;

  grid.innerHTML = AVATARS.map(a => {
    const active = current === a.id;
    const cls = ['picker-item'];
    if (active) cls.push('active');
    if (!a.owned) cls.push('locked');

    const imgPath = 'images/' + a.id + '.png';
    const priceHtml = a.owned
      ? `<span class="picker-item-price owned">✓</span>`
      : `<span class="picker-item-price">🪙 ${a.price}</span>`;

    return `
      <div class="${cls.join(' ')}" data-id="${a.id}" data-owned="${a.owned}">
        <img src="${imgPath}" alt="" onerror="this.style.display='none';this.parentNode.style.background='#2a3039'">
        ${priceHtml}
        <div class="picker-item-name">${a.name}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.picker-item').forEach(el => {
    el.onclick = () => onAvatarPick(el.dataset.id, el.dataset.owned === 'true');
  });

  const closeBtn = document.getElementById('avatarPickerClose');
  if (closeBtn){
    closeBtn.onclick = () => {
      Menu.showScreen('screenProfileSettings');
      renderSettings();
    };
  }
}

  async function onAvatarPick(id, owned){
  if (!owned){
    showToast('🪙 Покупка аватарок — скоро');
    return;
  }

  /* Локально применяем (пока без сервера для теста) */
  if (cachedData){
    cachedData.avatar_id = id;
    cachedData.avatar_url = null;
  } else {
    cachedData = { avatar_id: id, avatar_url: null };
  }
  applyData(cachedData);

  /* Пробуем сохранить на сервер, но не падаем если ошибка */
  try {
    const resp = await API.setProfile({ avatar_id: id, avatar_url: null });
    if (resp && resp.ok){
      showToast('✅ Аватарка изменена');
    } else {
      showToast('⚠️ Сохранено локально');
    }
  } catch(e){
    showToast('⚠️ Сохранено локально');
  }

  renderAvatarGrid();
}

  /* ═══════════════════════════════════════════════════════════════
     PICKER — ФОН ПРОФИЛЯ
     ═══════════════════════════════════════════════════════════════ */

  async function openBgPicker(){
    Menu.showScreen('bgPicker');

    const grid = document.getElementById('bgGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8893a3;padding:20px">Загрузка...</p>';

    if (!cachedBgs){
      const resp = await API.getProfileBgs();
      cachedBgs = (resp && resp.ok) ? resp.bgs : [];
    }

    renderBgGrid();
  }

  function renderBgGrid(){
    const grid = document.getElementById('bgGrid');
    if (!grid) return;

    if (!cachedBgs || !cachedBgs.length){
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8893a3;padding:20px">Пусто</p>';
      return;
    }

    const current = cachedData?.profile_bg || 'dark';

    grid.innerHTML = cachedBgs.map(b => {
      const active = current === b.id;
      const cls = ['picker-item', 'bg-item'];
      if (active) cls.push('active');
      if (!b.owned) cls.push('locked');

      const priceHtml = b.owned
        ? `<span class="picker-item-price owned">✓</span>`
        : `<span class="picker-item-price">🪙 ${b.price}</span>`;

      return `
        <div class="${cls.join(' ')}" data-bg="${b.id}" data-id="${b.id}" data-owned="${b.owned}">
          ${priceHtml}
          <div class="picker-item-name">${b.name}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.picker-item').forEach(el => {
      el.onclick = () => onBgPick(el.dataset.id, el.dataset.owned === 'true');
    });

    const closeBtn = document.getElementById('bgPickerClose');
    if (closeBtn){
      closeBtn.onclick = () => {
        Menu.showScreen('screenProfileSettings');
        renderSettings();
      };
    }
  }

  async function onBgPick(id, owned){
    if (!owned){
      showToast('🪙 Покупка фонов — скоро');
      return;
    }

    const resp = await API.setProfile({ profile_bg: id });
    if (resp && resp.ok){
      showToast('✅ Фон профиля изменён');
      if (cachedData) cachedData.profile_bg = id;
      applyData(cachedData || {});
      renderBgGrid();
    } else {
      showToast('❌ Ошибка');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PICKER — РАМКА
     ═══════════════════════════════════════════════════════════════ */

  async function openFramePicker(){
    Menu.showScreen('framePicker');

    const grid = document.getElementById('frameGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8893a3;padding:20px">Загрузка...</p>';

    if (!cachedFrames){
      const resp = await API.getProfileFrames();
      cachedFrames = (resp && resp.ok) ? resp.frames : [];
    }

    renderFrameGrid();
  }

  function renderFrameGrid(){
    const grid = document.getElementById('frameGrid');
    if (!grid) return;

    if (!cachedFrames || !cachedFrames.length){
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8893a3;padding:20px">Пусто</p>';
      return;
    }

    const current = cachedData?.profile_frame || 'default';

/* ★ Скрываем Рамиила, добавляем Хэллоуин локально (нет в воркере) */
const visibleFrames = cachedFrames.filter(f => f.id !== 'ramiel');

/* Ивент-рамка Хэллоуин — добавляем если ещё нет в списке */
if (!visibleFrames.some(f => f.id === 'halloween')) {
  visibleFrames.push({
    id: 'halloween',
    name: 'Хэллоуин',
    price: 169,
    owned: Storage.get('owned_frame_halloween', '0') === '1'
  });
}

grid.innerHTML = visibleFrames.map(f => {
  
      const active = current === f.id;
      const cls = ['picker-item', 'frame-item'];
      if (active) cls.push('active');
      if (!f.owned) cls.push('locked');

      const priceHtml = f.owned
        ? `<span class="picker-item-price owned">✓</span>`
        : `<span class="picker-item-price">🪙 ${f.price}</span>`;

      return `
        <div class="${cls.join(' ')}" data-id="${f.id}" data-owned="${f.owned}">
          ${priceHtml}
          <div class="frame-preview" data-frame="${f.id}"></div>
          <div class="picker-item-name">${f.name}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.picker-item').forEach(el => {
      el.onclick = () => onFramePick(el.dataset.id, el.dataset.owned === 'true');
    });

    const closeBtn = document.getElementById('framePickerClose');
    if (closeBtn){
      closeBtn.onclick = () => {
        Menu.showScreen('screenProfileSettings');
        renderSettings();
      };
    }
  }

  async function onFramePick(id, owned){
    if (!owned){
      showToast('🪙 Покупка рамок — скоро');
      return;
    }

    const resp = await API.setProfile({ profile_frame: id });
    if (resp && resp.ok){
      showToast('✅ Рамка изменена');
      if (cachedData) cachedData.profile_frame = id;
      applyData(cachedData || {});
      renderFrameGrid();
    } else {
      showToast('❌ Ошибка');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ИНИЦИАЛИЗАЦИЯ
     ═══════════════════════════════════════════════════════════════ */

  function init(){
    const shareBtn = document.getElementById('profileShareBtn');
    if (shareBtn){
      shareBtn.onclick = async () => {
        if (!cachedData){ showToast('Профиль не загружен'); return; }

        const name = cachedData.display_name || 'Игрок';
        const score = fmt(cachedData.personal_best);
        const runs = fmt(cachedData.total_runs);
        const combo = '×' + Number(cachedData.best_combo || 1).toFixed(1);

        const text =
          `🎯 Мой профиль в Тире\n\n` +
          `👤 ${name}\n` +
          `🏆 Рекорд: ${score}\n` +
          `📊 Забегов: ${runs}\n` +
          `🔥 Комбо: ${combo}`;

        const url = 'https://t.me/Hen_Nyasha_bot';

        try {
          if (navigator.share){
            await navigator.share({ text, url });
          } else {
            await navigator.clipboard.writeText(text + '\n' + url);
            showToast('✅ Скопировано в буфер');
          }
        } catch(e){}
      };
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { render, renderSettings, applyData };
})();