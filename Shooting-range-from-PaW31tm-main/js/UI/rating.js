/* ═══════════════════════════════════════════════════════════════
   RATING — экран рейтинга
   Топ-10 игроков с сервера
   ═══════════════════════════════════════════════════════════════ */

const Rating = (() => {

  function renderLoading(){
    const list = document.getElementById('ratingList');
    if (list) list.innerHTML = '<p style="text-align:center;color:#8893a3;padding:20px">Загрузка...</p>';
  }

  function renderEmpty(){
    const list = document.getElementById('ratingList');
    if (list) list.innerHTML = '<p style="text-align:center;color:#8893a3;padding:20px">Пока никто не играл.</p>';
  }

  function renderError(){
    const list = document.getElementById('ratingList');
    if (list) list.innerHTML = '<p style="text-align:center;color:#a43e3e;padding:20px">Не удалось загрузить.</p>';
  }

  function render(){
    renderLoading();

    API.getLeaderboard().then(data => {
      if (!data || !data.ok || !data.leaders || data.leaders.length === 0){
        renderEmpty();
        return;
      }

      const list = document.getElementById('ratingList');
      if (!list) return;

      list.innerHTML = data.leaders.map(l => {
        let medal, rowClass;
        if (l.rank === 1){ medal = '🥇'; rowClass = 'top1'; }
        else if (l.rank === 2){ medal = '🥈'; rowClass = 'top2'; }
        else if (l.rank === 3){ medal = '🥉'; rowClass = 'top3'; }
        else { medal = '#' + l.rank; rowClass = ''; }

        const name = l.username ? '@' + l.username : (l.first_name || 'Игрок');
        const modeBadge = l.mode === 'infinite'
          ? '<span class="mini-badge infinite">♾</span> '
          : '';
        const laserBadge = l.laser
          ? '<span class="mini-badge laser">🎯</span> '
          : '';

        return `
          <div class="rating-row ${rowClass}">
            <span class="rating-rank">${medal}</span>
            <div class="rating-name">
              ${name}
              <span class="rating-sub">${modeBadge}${laserBadge}Забегов: ${l.total_runs} · Комбо ×${l.best_combo}</span>
            </div>
            <span class="rating-score">${l.best_score}</span>
          </div>`;
      }).join('');
    }).catch(() => renderError());
  }

  return { render };
})();