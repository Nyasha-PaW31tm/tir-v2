/* ═══════════════════════════════════════════════════════════════
   API — обёртки для запросов к серверу
   BETA 0.9.5 — с таймаутом 12с
   ═══════════════════════════════════════════════════════════════ */

const API = (() => {

  const SERVER_URL = 'https://tir-worker-paw31.pecerskijnikit.workers.dev';
  const PROMO_URL  = 'https://tir-admin.pecerskijnikit.workers.dev';
  const TIMEOUT_MS = 12000;

  function getInitData(){
    try { return window.Telegram?.WebApp?.initData || ''; }
    catch(e){ return ''; }
  }

  async function fetchWithTimeout(url, options){
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return resp;
    } catch(e){
      clearTimeout(timeoutId);
      throw e;
    }
  }

  async function request(path, options = {}){
    const initData = getInitData();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (initData) headers['Authorization'] = 'tma ' + initData;

    try {
      const response = await fetchWithTimeout(SERVER_URL + path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const data = await response.json().catch(() => null);
      if (!data) return { ok: false, error: 'invalid response', status: response.status };
      data.__status = response.status;
      return data;
    } catch (err){
      console.error('[api]', path, err);
      return {
        ok: false,
        error: err.name === 'AbortError' ? 'timeout' : 'network',
        details: String(err.message || err)
      };
    }
  }

  async function requestPromo(path, options = {}){
    const initData = getInitData();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (initData) headers['Authorization'] = 'tma ' + initData;

    try {
      const response = await fetchWithTimeout(PROMO_URL + path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const data = await response.json().catch(() => null);
      if (!data) return { ok: false, error: 'invalid response', status: response.status };
      return data;
    } catch (err){
      console.error('[api promo]', path, err);
      return {
        ok: false,
        error: err.name === 'AbortError' ? 'timeout' : 'network',
        details: String(err.message || err)
      };
    }
  }

  return {
    isTelegramReady: () => !!getInitData(),
    getProfile(){ return request('/api/profile', { method: 'POST' }); },
    submitRun(run){ return request('/api/submit-run', { method: 'POST', body: { run } }); },
    getLeaderboard(){ return request('/api/leaderboard'); },
    getSkins(){ return request('/api/skins', { method: 'POST' }); },
    buySkin(skinId){ return request('/api/buy-skin', { method: 'POST', body: { skin_id: skinId } }); },
    setSkin(skinId){ return request('/api/set-skin', { method: 'POST', body: { skin_id: skinId } }); },
    spin(){ return request('/api/spin', { method: 'POST' }); },
    claimReward(){ return request('/api/claim-reward', { method: 'POST' }); },
    redeemPromo(code){ return requestPromo('/api/redeem-promo', { method: 'POST', body: { code } }); },
    sendFeedback(text){ return requestPromo('/api/feedback', { method: 'POST', body: { text } }); }
  };
})();