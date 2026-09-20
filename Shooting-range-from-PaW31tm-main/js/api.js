/* ═══════════════════════════════════════════════════════════════
   API — обёртки для запросов к серверу
   ═══════════════════════════════════════════════════════════════ */

const API = (() => {

  const SERVER_URL = 'https://tir-worker-paw31.pecerskijnikit.workers.dev';

  function getInitData(){
    try {
      return window.Telegram?.WebApp?.initData || '';
    } catch(e){
      return '';
    }
  }

  async function request(path, options = {}){
    const initData = getInitData();

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (initData){
      headers['Authorization'] = 'tma ' + initData;
    }

    try {
      const response = await fetch(SERVER_URL + path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const data = await response.json().catch(() => null);

      if (!data){
        return { ok: false, error: 'invalid response' };
      }

      return data;
    } catch (err){
      console.error('[api]', path, err);
      return { ok: false, error: 'network', details: String(err.message || err) };
    }
  }

  return {

    isTelegramReady: () => !!getInitData(),

    getProfile(){
      return request('/api/profile', { method: 'POST' });
    },

    submitRun(run){
      return request('/api/submit-run', {
        method: 'POST',
        body: { run }
      });
    },

    getLeaderboard(){
      return request('/api/leaderboard');
    },

    getSkins(){
      return request('/api/skins', { method: 'POST' });
    },

    buySkin(skinId){
      return request('/api/buy-skin', {
        method: 'POST',
        body: { skin_id: skinId }
      });
    },

    setSkin(skinId){
      return request('/api/set-skin', {
        method: 'POST',
        body: { skin_id: skinId }
      });
    },

    spin(){
      return request('/api/spin', { method: 'POST' });
    },

    claimReward(){
      return request('/api/claim-reward', { method: 'POST' });
    }
  };
})();