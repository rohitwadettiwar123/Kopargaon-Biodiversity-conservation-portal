/**
 * leaderboard.js — Interactive Community Rankings
 * Features: live search, role filter, sort by column, user highlight, pagination, profile modal
 */
const LeaderboardPage = (() => {
  const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
  let allUsers    = [];
  let filtered    = [];
  let sortKey     = 'points';
  let sortDir     = 'desc';
  let currentPage = 1;
  const PAGE_SIZE = 15;
  let activeFilter = 'All';

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    try {
      allUsers = await DataLoader.load('users.csv');
      allUsers.sort((a, b) => (parseInt(b.points) || 0) - (parseInt(a.points) || 0));
      // Assign global ranks (1-based, fixed on initial sort by points)
      allUsers.forEach((u, i) => { u._rank = i + 1; });
      filtered = [...allUsers];

      renderPodium();
      renderFilters();
      renderTable();
      setupSearch();
      setupSortHeaders();
      highlightCurrentUser();
    } catch (err) {
      console.error(err);
      const tbody = document.getElementById('lb-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px">
        <i class="fa fa-exclamation-triangle"></i> Error loading leaderboard: ${err.message}
      </td></tr>`;
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function getInitials(name) {
    const parts = (name || 'U').split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  function avatarColor(name) {
    const colors = ['#22c55e','#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#ec4899','#14b8a6'];
    let h = 0; for (const c of (name||'')) h += c.charCodeAt(0);
    return colors[h % colors.length];
  }
  function roleColor(role) {
    return { 'Administrator':'#ef4444','Forest Officer':'#f59e0b','Citizen':'#3b82f6','Observer':'#8b5cf6' }[role] || '#64748b';
  }
  const BADGE_ICONS = {
    'Green Guardian':       '🌱',
    'Bird Watcher':         '🐦',
    'Butterfly Explorer':   '🦋',
    'Nature Protector':     '🌳',
    'Biodiversity Champion':'🏆',
  };

  // ── Podium ─────────────────────────────────────────────────────────────────
  function renderPodium() {
    const el = document.getElementById('lb-podium');
    if (!el || allUsers.length === 0) return;
    const top3 = allUsers.slice(0, 3);

    // Order: 2nd | 1st | 3rd
    const layout = [];
    if (top3[1]) layout.push({ u: top3[1], rank: 2, medal: '🥈', ht: 100, cls: 'podium-2' });
    if (top3[0]) layout.push({ u: top3[0], rank: 1, medal: '🏆', ht: 140, cls: 'podium-1' });
    if (top3[2]) layout.push({ u: top3[2], rank: 3, medal: '🥉', ht: 70,  cls: 'podium-3' });

    el.innerHTML = layout.map(({ u, rank, medal, ht, cls }) => {
      const color = avatarColor(u.full_name);
      return `
        <div class="podium-col" onclick="LeaderboardPage.openModal('${u.user_id}')" style="cursor:pointer">
          <div class="podium-name">
            <div style="font-weight:700;font-size:13px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.full_name}</div>
            <div class="podium-pts">${(parseInt(u.points)||0).toLocaleString()} pts</div>
          </div>
          <div class="podium-avatar ${cls}-avatar" style="background:${color}22;border-color:${color};color:${color}">
            ${getInitials(u.full_name)}
          </div>
          <div class="podium-box ${cls}" style="height:${ht}px">
            <div style="font-size:26px;margin-bottom:2px">${medal}</div>
            <div style="font-size:13px;font-weight:800">#${rank}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:2px">${u.reports_submitted||0} reports</div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Role Filter Chips ──────────────────────────────────────────────────────
  function renderFilters() {
    const bar = document.getElementById('lb-filter-bar');
    if (!bar) return;
    const roles = ['All', ...new Set(allUsers.map(u => u.role || 'Citizen').filter(Boolean))];
    bar.innerHTML = roles.map(r => `
      <button class="lb-chip${r === activeFilter ? ' active' : ''}" onclick="LeaderboardPage.setFilter('${r}')">
        ${r === 'All' ? '🌍' : r === 'Citizen' ? '👤' : r === 'Forest Officer' ? '🌲' : r === 'Administrator' ? '🛡️' : '👁️'} ${r}
      </button>`).join('');
  }

  function setFilter(role) {
    activeFilter = role;
    currentPage  = 1;
    applyFiltersAndSort();
    renderFilters();
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  function setupSearch() {
    const input = document.getElementById('lb-search');
    if (!input) return;
    input.addEventListener('input', () => {
      currentPage = 1;
      applyFiltersAndSort();
    });
  }

  function applyFiltersAndSort() {
    const q = (document.getElementById('lb-search')?.value || '').toLowerCase();
    filtered = allUsers.filter(u => {
      const matchRole = activeFilter === 'All' || (u.role || 'Citizen') === activeFilter;
      const matchQ    = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || (u.badges||'').toLowerCase().includes(q);
      return matchRole && matchQ;
    });

    // Sort
    filtered.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'points' || sortKey === 'reports_submitted') {
        av = parseInt(av) || 0; bv = parseInt(bv) || 0;
      } else {
        av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    renderTable();
    renderPagination();
  }

  // ── Sort Headers ───────────────────────────────────────────────────────────
  function setupSortHeaders() {
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'desc'; }
        currentPage = 1;
        applyFiltersAndSort();
        updateSortIndicators();
      });
    });
    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll('[data-sort]').forEach(th => {
      const icon = th.querySelector('.sort-icon');
      if (!icon) return;
      if (th.dataset.sort === sortKey) {
        icon.className = `sort-icon fa fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`;
        icon.style.color = '#22c55e';
      } else {
        icon.className = 'sort-icon fa fa-sort';
        icon.style.color = 'var(--text-dim)';
      }
    });
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('lb-tbody');
    const countEl = document.getElementById('lb-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${filtered.length} contributors`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim)">
        <i class="fa fa-search" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.4"></i>
        No contributors match your filters.
      </td></tr>`;
      renderPagination();
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);
    const loggedUser = Auth.getUser();

    // Stats for mini progress bars
    const maxPts = parseInt(allUsers[0]?.points) || 1;

    tbody.innerHTML = page.map((u, i) => {
      const globalRank = filtered.indexOf(u) + 1;
      const pts        = parseInt(u.points) || 0;
      const pct        = Math.round((pts / maxPts) * 100);
      const badges     = (u.badges || '').split(',').map(b => b.trim()).filter(Boolean);
      const badgeHtml  = badges.length
        ? badges.slice(0, 3).map(b => `<span title="${b}" style="font-size:15px;cursor:default">${BADGE_ICONS[b] || '🏅'}</span>`).join('')
        : `<span style="font-size:10px;color:var(--text-dim);font-style:italic">—</span>`;
      const isSelf  = loggedUser && (u.user_id === loggedUser.user_id || u.email === loggedUser.email);
      const rowBg   = isSelf ? 'rgba(34,197,94,0.07)' : 'transparent';
      const selfTag = isSelf ? `<span style="font-size:9px;background:#22c55e;color:#000;border-radius:8px;padding:1px 6px;font-weight:800;margin-left:6px">YOU</span>` : '';

      let rankDisplay;
      if (globalRank === 1) rankDisplay = `<span style="font-size:20px">🥇</span>`;
      else if (globalRank === 2) rankDisplay = `<span style="font-size:20px">🥈</span>`;
      else if (globalRank === 3) rankDisplay = `<span style="font-size:20px">🥉</span>`;
      else rankDisplay = `<div style="background:var(--bg-tertiary);width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--text-dim);border:1px solid var(--border);margin:0 auto">${globalRank}</div>`;

      const color = avatarColor(u.full_name);
      const rColor = roleColor(u.role);

      return `
        <tr class="lb-row" onclick="LeaderboardPage.openModal('${u.user_id}')"
          style="border-bottom:1px solid rgba(255,255,255,0.05);background:${rowBg};transition:background 0.2s,transform 0.15s;cursor:pointer"
          onmouseover="this.style.background='rgba(34,197,94,0.08)'" onmouseout="this.style.background='${rowBg}'">

          <td style="padding:14px 10px;text-align:center;width:60px">${rankDisplay}</td>

          <td style="padding:14px 12px;min-width:200px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:${color}22;border:2px solid ${color};
                display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${color};flex-shrink:0">
                ${getInitials(u.full_name)}
              </div>
              <div>
                <div style="font-weight:700;font-size:13px;color:var(--text-white)">${u.full_name}${selfTag}</div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:1px">${u.email || ''}</div>
              </div>
            </div>
          </td>

          <td style="padding:14px 12px">
            <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${rColor}22;color:${rColor};border:1px solid ${rColor}44;white-space:nowrap">
              ${u.role || 'Citizen'}
            </span>
          </td>

          <td style="padding:14px 12px;text-align:center">
            <div style="font-weight:700;font-size:14px;color:var(--text-white)">${parseInt(u.reports_submitted)||0}</div>
            <div style="font-size:9px;color:var(--text-dim)">reports</div>
          </td>

          <td style="padding:14px 12px;min-width:140px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22c55e,#15803d);border-radius:3px;transition:width 0.5s ease"></div>
              </div>
              <div style="font-weight:800;font-size:13px;color:#22c55e;white-space:nowrap">${pts.toLocaleString()}</div>
            </div>
          </td>

          <td style="padding:14px 12px;text-align:center">
            <div style="display:flex;gap:4px;justify-content:center">${badgeHtml}</div>
          </td>

          <td style="padding:14px 12px;text-align:center">
            <button style="padding:5px 12px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);
              color:#22c55e;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s"
              onmouseover="this.style.background='rgba(34,197,94,0.25)'"
              onmouseout="this.style.background='rgba(34,197,94,0.1)'"
              onclick="event.stopPropagation();LeaderboardPage.openModal('${u.user_id}')">
              <i class="fa fa-eye"></i> View
            </button>
          </td>
        </tr>`;
    }).join('');

    renderPagination();
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  function renderPagination() {
    const el = document.getElementById('lb-pagination');
    if (!el) return;
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    if (total <= 1) { el.innerHTML = ''; return; }

    let html = `<div style="display:flex;align-items:center;gap:6px;justify-content:center;padding:16px">`;
    html += `<button class="lb-pg-btn" onclick="LeaderboardPage.goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>
      <i class="fa fa-chevron-left"></i></button>`;
    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || Math.abs(p - currentPage) <= 1) {
        html += `<button class="lb-pg-btn${p===currentPage?' active':''}" onclick="LeaderboardPage.goPage(${p})">${p}</button>`;
      } else if (Math.abs(p - currentPage) === 2) {
        html += `<span style="color:var(--text-dim);padding:0 4px">…</span>`;
      }
    }
    html += `<button class="lb-pg-btn" onclick="LeaderboardPage.goPage(${currentPage+1})" ${currentPage===total?'disabled':''}>
      <i class="fa fa-chevron-right"></i></button>`;
    html += `</div>`;
    el.innerHTML = html;
  }

  function goPage(p) {
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    if (p < 1 || p > total) return;
    currentPage = p;
    renderTable();
    document.getElementById('lb-tbody')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Highlight logged-in user ───────────────────────────────────────────────
  function highlightCurrentUser() {
    const u = Auth.getUser();
    if (!u) return;
    const myRank = allUsers.findIndex(x => x.user_id === u.user_id || x.email === u.email) + 1;
    const myEl   = document.getElementById('lb-my-rank');
    if (myEl && myRank > 0) myEl.textContent = `Your Rank: #${myRank}`;
  }

  // ── Profile Modal ──────────────────────────────────────────────────────────
  function openModal(userId) {
    const u = allUsers.find(x => x.user_id === userId);
    if (!u) return;
    const modal   = document.getElementById('lb-modal');
    const content = document.getElementById('lb-modal-content');
    if (!modal || !content) return;
    modal.style.display = 'flex';

    const color  = avatarColor(u.full_name);
    const rColor = roleColor(u.role);
    const badges = (u.badges || '').split(',').map(b => b.trim()).filter(Boolean);
    const pts    = parseInt(u.points) || 0;
    const reps   = parseInt(u.reports_submitted) || 0;
    const maxPts = parseInt(allUsers[0]?.points) || 1;
    const pct    = Math.round((pts / maxPts) * 100);

    content.innerHTML = `
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:80px;height:80px;border-radius:50%;background:${color}22;border:3px solid ${color};
          display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:${color};margin:0 auto 12px">
          ${getInitials(u.full_name)}
        </div>
        <div style="font-size:20px;font-weight:800;margin-bottom:4px">${u.full_name}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${u.email || ''}</div>
        <span style="padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;background:${rColor}22;color:${rColor};border:1px solid ${rColor}44">
          ${u.role || 'Citizen'}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:var(--bg-tertiary);border-radius:12px;padding:14px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:22px;font-weight:800;color:#22c55e">${pts.toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">Points</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:12px;padding:14px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:22px;font-weight:800;color:#3b82f6">${reps}</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">Reports</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:12px;padding:14px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:22px;font-weight:800;color:#f59e0b">#${u._rank || '—'}</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">Rank</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">
          Points Progress (vs #1)
        </div>
        <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22c55e,#15803d);border-radius:4px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-top:4px">
          <span>0</span><span>${pts.toLocaleString()} / ${parseInt(allUsers[0]?.points||0).toLocaleString()}</span>
        </div>
      </div>

      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:10px">Badges Earned</div>
        ${badges.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
          ${badges.map(b => `
            <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:20px;font-size:11px;font-weight:600">
              <span style="font-size:16px">${BADGE_ICONS[b] || '🏅'}</span> ${b}
            </div>`).join('')}
        </div>` : `<div style="font-size:11px;color:var(--text-dim);font-style:italic">No badges earned yet — keep contributing!</div>`}
      </div>
    `;
  }

  function closeModal() {
    const modal = document.getElementById('lb-modal');
    if (modal) modal.style.display = 'none';
  }

  return { init, setFilter, goPage, openModal, closeModal };
})();
window.LeaderboardPage = LeaderboardPage;
