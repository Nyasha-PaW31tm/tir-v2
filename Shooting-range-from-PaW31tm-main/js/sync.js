/* ═══════════════════════════════════════════════════════════════
   SYNC — синхронизация с сервером + очередь на повтор
   BETA 0.9.5
   ═══════════════════════════════════════════════════════════════ */

const Sync = (() => {

  const QUEUE_KEY = 'pendingRuns';
  const MAX_QUEUE = 10;
  const MAX_TRIES = 5;

  function updateCoinsUI(){
    const coins = Storage.getCoins();
    const el1 = document.getElementById('coins');
    const el2 = document.getElementById('menuCoins');
    const el3 = document.getElementById('shopCoins');
    if (el1) el1.textContent = coins;
    if (el2) el2.textContent = coins;
    if (el3) el3.textContent = coins;
  }

  function updateProfileUI(){ /* задел */ }

  /* ─── Очередь ─── */
  function getQueue(){
    try { return JSON.parse(localStorage.getItem('tir_' + QUEUE_KEY) || '[]'); }
    catch(e){ return []; }
  }
  function saveQueue(q){
    try { localStorage.setItem('tir_' + QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); }
    catch(e){}
  }
  function addToQueue(payload){
    const q = getQueue();
    q.push(payload);
    saveQueue(q);
  }
  function removeFromQueue(id){
    if (!id) return;
    saveQueue(getQueue().filter(p => p.__queueId !== id));
  }

  /* ─── Профиль с сервера ─── */
  async function fromServer(){
    if (!API.isTelegramReady()) return null;

    const data = await API.getProfile();
    if (!data || !data.ok) return null;

    if (typeof data.coins === 'number') Storage.setCoins(data.coins);

    const localActive = Storage.getActiveSkin();
    const isEasterSkin = (localActive === 'china');
    if (data.active_skin && !isEasterSkin){
      Storage.setActiveSkin(data.active_skin);
      Skins.apply(data.active_skin);
    } else if (isEasterSkin){
      Skins.apply(localActive);
    }
    if (typeof data.personal_best === 'number') Storage.setPersonalBest(data.personal_best);

    updateCoinsUI();
    updateProfileUI();

    // Фоном пробуем отправить висящие забеги
    retryPending().catch(() => {});

    return data;
  }

  /* ─── Отправка забега ─── */
  async function submitRun(payloadIn){
    if (!API.isTelegramReady()) return null;

    const payload = {
      score: Math.floor(payloadIn.score),
      duration: Math.floor(payloadIn.duration),
      shots: Math.floor(payloadIn.shots),
      ults: Math.floor(payloadIn.ults),
      max_combo: Number(payloadIn.maxCombo),
      is_win: !!payloadIn.isWin,
      mode: payloadIn.mode || 'normal',
      laser: payloadIn.laser ? 1 : 0
    };

    const data = await API.submitRun(payload);

    if (data && data.ok){
      if (typeof data.total_coins === 'number'){
        Storage.setCoins(data.total_coins);
        updateCoinsUI();
      }
      if (typeof data.personal_best === 'number'){
        Storage.setPersonalBest(data.personal_best);
      }
      return data;
    }

    // Провал — кладём в очередь
    payload.__queueId = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    payload.__tries = 1;
    addToQueue(payload);

    return {
      ok: false,
      error: (data && data.error) || 'unknown',
      status: data && data.__status,
      details: data && data.details,
      __queued: true
    };
  }

  /* ─── Повторная отправка висящих ─── */
  async function retryPending(){
    if (!API.isTelegramReady()) return;
    let q = getQueue();
    if (!q.length) return;

    const remaining = [];
    for (const payload of q){
      if (payload.__tries >= MAX_TRIES) continue;

      const data = await API.submitRun(payload);
      if (data && data.ok){
        if (typeof data.total_coins === 'number'){
          Storage.setCoins(data.total_coins);
        }
        if (typeof data.personal_best === 'number'){
          Storage.setPersonalBest(data.personal_best);
        }
        // успех — не сохраняем в remaining
      } else {
        payload.__tries = (payload.__tries || 0) + 1;
        remaining.push(payload);
      }
    }
    saveQueue(remaining);
    updateCoinsUI();
  }

  return {
    fromServer,
    submitRun,
    retryPending,
    updateCoinsUI,
    updateProfileUI
  };
})();