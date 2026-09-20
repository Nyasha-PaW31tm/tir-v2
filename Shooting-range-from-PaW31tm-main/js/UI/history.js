/* ═══════════════════════════════════════════════════════════════
   HISTORY — экран истории забегов
   Последние 10 забегов из localStorage
   ═══════════════════════════════════════════════════════════════ */

const History = (() => {

  function render(){
    const list = document.getElementById('historyList');
    if (!list) return;

    const data = Storage.getHistory();

    if (!data || data.length === 0){
      list.innerHTML = '<p style="text-align:center;color:#8893a3;padding:20px">Пока пусто. Сыграй первый забег!</p>';
      return;
    }

    const bestScore = Math.max(...data.map(r => r.score));

    list.innerHTML = data.map(r => {
      const isBest = r.score === bestScore && r.win;
      const medal = isBest ? ' 🏆' : '';
      const winBadge = r.win ? ' ✅' : '';
      const mins = Math.floor((r.duration || 0) / 60);
      const secs = (r.duration || 0) % 60;
      const timeStr = mins > 0 ? `${mins}м ${secs}с` : `${secs}с`;

      const modeBadge = r.mode === 'infinite'
        ? '<span class="mini-badge infinite">♾ БЕСК</span>'
        : '<span class="mini-badge">ОБЫЧН</span>';
      const laserBadge = r.laser
        ? '<span class="mini-badge laser">🎯 ЛАЗЕР</span>'
        : '';

      return `
        <div style="padding:10px 12px;margin-bottom:8px;border-radius:12px;background:${isBest ? '#2a3a20' : '#11161e'};border:1px solid ${isBest ? '#5a8a3a' : '#2a3039'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:16px">${r.score}${medal}${winBadge}</b>
            <span style="color:#8893a3;font-size:12px">${r.date}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">${modeBadge}${laserBadge}</div>
          <div style="display:flex;gap:14px;color:#aeb7c5;font-size:12px;margin-top:6px;flex-wrap:wrap">
            <span>⏱ ${timeStr}</span>
            <span>🔫 ${r.shots}</span>
            <span>⚡ ${r.ults} ULT</span>
            <span>×${r.maxCombo}</span>
          </div>
        </div>`;
    }).join('');
  }

  return { render };
})();