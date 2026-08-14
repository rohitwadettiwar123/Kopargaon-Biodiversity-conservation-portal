/**
 * leaderboard.js — Community Rankings Page
 */

const LeaderboardPage = (() => {
  let allUsers = [];

  async function init() {
    try {
      allUsers = await DataLoader.load('users.csv');
      // Sort by points descending
      allUsers.sort((a, b) => (parseInt(b.points) || 0) - (parseInt(a.points) || 0));
      
      renderPodium();
      renderTable();
    } catch (err) {
      console.error(err);
      const tbody = document.getElementById('lb-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--accent-red)">Error loading leaderboard data.</td></tr>';
    }
  }

  function getInitials(name) {
    const parts = (name || 'U').split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  function renderPodium() {
    const podium = document.getElementById('lb-podium');
    if (!podium) return;
    
    if (allUsers.length === 0) {
      podium.innerHTML = '<div style="color:var(--text-dim)">No users found on the leaderboard yet.</div>';
      return;
    }
    
    const top3 = allUsers.slice(0, 3);
    const layout = [];
    
    // Always push rank 2 if exists
    if (top3[1]) layout.push({ user: top3[1], rank: 2, cls: 'podium-2', icon: '🥈' });
    // Always push rank 1
    if (top3[0]) layout.push({ user: top3[0], rank: 1, cls: 'podium-1', icon: '🏆' });
    // Always push rank 3 if exists
    if (top3[2]) layout.push({ user: top3[2], rank: 3, cls: 'podium-3', icon: '🥉' });
    
    podium.innerHTML = layout.map(item => {
      const u = item.user;
      return `
        <div class="podium-col">
          <div class="podium-name">
            <div style="font-weight:700">${u.full_name}</div>
            <div class="podium-pts">${(parseInt(u.points)||0).toLocaleString()} pts</div>
          </div>
          <div class="podium-avatar">
            ${getInitials(u.full_name)}
          </div>
          <div class="podium-box ${item.cls}">
            <div style="font-size:24px;margin-bottom:4px">${item.icon}</div>
            <div>#${item.rank}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTable() {
    const tbody = document.getElementById('lb-tbody');
    if (!tbody) return;
    
    if (allUsers.length <= 3) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">No additional users to display.</td></tr>';
      return;
    }

    const others = allUsers.slice(3, 20); // show next 17 users
    
    tbody.innerHTML = others.map((u, i) => {
      const rank = i + 4;
      const badges = (u.badges || '').split(',').filter(b => b.trim());
      const badgeHtml = badges.map(b => `<span class="badge badge-info" style="margin-right:4px">${b.trim()}</span>`).join('');
      
      return `
        <tr class="leaderboard-row" style="border-bottom:1px solid rgba(255,255,255,0.05); transition:var(--transition); cursor:default;" onmouseover="this.style.background='rgba(34,197,94,0.05)'" onmouseout="this.style.background='transparent'">
          <td style="padding:16px; text-align:center;">
            <div class="rank-badge rank-other" style="background:var(--bg-tertiary); width:28px; height:28px; line-height:28px; border-radius:6px; margin:0 auto; font-size:11px; font-weight:800; color:var(--text-dim); border:1px solid var(--border)">${rank}</div>
          </td>
          <td style="padding:16px;">
            <div style="font-weight:700; color:var(--text-primary); font-size:13px">${u.full_name}</div>
            <div style="font-size:10px; color:var(--text-dim); margin-top:2px">${u.email || 'Citizen Observer'}</div>
          </td>
          <td style="padding:16px; font-size:11px; font-weight:600; color:var(--text-secondary)">${u.role || 'Citizen'}</td>
          <td style="padding:16px; text-align:center; font-size:12px; font-weight:600">${u.reports_submitted || 0}</td>
          <td style="padding:16px; text-align:right; font-weight:800; color:var(--green-primary); font-size:13px">${(parseInt(u.points)||0).toLocaleString()}</td>
          <td style="padding:16px;">${badgeHtml || '<span style="font-size:10px;color:var(--text-dim);font-style:italic">No badges yet</span>'}</td>
        </tr>
      `;
    }).join('');
  }

  return { init };
})();

window.LeaderboardPage = LeaderboardPage;
