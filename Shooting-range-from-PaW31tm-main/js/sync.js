/* ═══════════════════════════════════════════════════════════════
   SYNC — синхронизация профиля игрока с сервером
   Тянет монеты, скин, рекорд, статистику. Обновляет UI.
   ═══════════════════════════════════════════════════════════════ */

const Sync = (() => {

  /* ─── Обновление UI монет (шапка игры + меню + магазин) ─── */
  function updateCoinsUI(){
    const coins = Storage.getCoins();

    const el1 = document.getElementById('coins');       // шапка игры
    const el2 = document.getElementById('menuCoins');    // главное меню
    const el3 = document.getElementById('shopCoins');    // магазин

    if (el1) el1.textContent = coins;
    if (el2) el2.textContent = coins;
    if (el3) el3.textContent = coins;
  }

  /* ─── Обновить UI всех остальных данных (рекорд и т.д.) ─── */
  function updateProfileUI(){
    // пока ничего — задел на будущее
  }

  /* ─── Главный метод: синхронизация с сервером ─── */
  async function fromServer(){
    if (!API.isTelegramReady()){
      console.log('[sync] Telegram context not ready, skipping');
      return null;
    }

    const data = await API.getProfile();
    if (!data || !data.ok){
      console.warn('[sync] server error:', data?.error);
      return null;
    }

    // Обновляем локальный кэш из сервера (сервер — источник истины)
    if (typeof data.coins === 'number'){
      Storage.setCoins(data.coins);
    }
 const localActive = Storage.getActiveSkin();
const isEasterSkin = (localActive === 'china');

if (data.active_skin && !isEasterSkin){
  Storage.setActiveSkin(data.active_skin);
  Skins.apply(data.active_skin);
} else if (isEasterSkin){
  Skins.apply(localActive);
}
    if (typeof data.personal_best === 'number'){
      Storage.setPersonalBest(data.personal_best);
    }

    // Обновляем UI
    updateCoinsUI();
    updateProfileUI();

    console.log('[sync] profile synced:', data);
    return data;
  }

  /* ─── Отправить результат забега на сервер ─── */
  async function submitRun({ score, duration, shots, ults, maxCombo, isWin, mode, laser }){
    if (!API.isTelegramReady()){
      console.log('[sync] Telegram context not ready, skipping submit');
      return null;
    }

    const payload = {
      score: Math.floor(score),
      duration: Math.floor(duration),
      shots: Math.floor(shots),
      ults: Math.floor(ults),
      max_combo: Number(maxCombo),
      is_win: !!isWin,
      mode: mode || 'normal',
      laser: laser ? 1 : 0
    };

    const data = await API.submitRun(payload);
    if (!data || !data.ok){
      console.warn('[sync] submit failed:', data?.error);
      return null;
    }

    // Обновляем монеты из ответа сервера (авторитет)
    if (typeof data.total_coins === 'number'){
      Storage.setCoins(data.total_coins);
      updateCoinsUI();
    }
    if (typeof data.personal_best === 'number'){
      Storage.setPersonalBest(data.personal_best);
    }

    console.log('[sync] run submitted:', data);
    return data;
  }

  return {
    fromServer,
    submitRun,
    updateCoinsUI,
    updateProfileUI
  };
})();