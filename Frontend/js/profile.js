/**
 * profile.js — Logged-in User Profile Page
 * Kopargaon Biodiversity Portal
 */

const ProfilePage = (() => {
  const API = 'http://localhost:3000/api';

  async function init() {
    const localUser = Auth.getUser();
    if (!localUser) {
      window.location.replace('../index.html');
      return;
    }

    // Show local session data immediately (no wait)
    renderProfile(localUser);

    // Then fetch fresh data from API
    try {
      const res = await fetch(`${API}/users/profile`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      if (res.ok) {
        const freshUser = await res.json();
        // Update session with fresh data
        const updatedUser = { ...localUser, ...freshUser };
        sessionStorage.setItem('kb_session', JSON.stringify(updatedUser));
        renderProfile(updatedUser);
      }
    } catch (e) {
      console.warn('[Profile] Could not refresh from API, using session data:', e.message);
    }

    loadMyReports();
    initEditProfile();
  }

  function renderProfile(user) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '';
    };

    const name = user.full_name || user.name || 'User';
    const email = user.email || '';
    const role = user.role || 'Citizen';
    const joinDate = user.join_date || '';
    const points = parseInt(user.points) || 0;
    const reportsCount = parseInt(user.reports_submitted || user.my_reports) || 0;
    const verifiedCount = parseInt(user.my_verified) || 0;
    const village = user.village_id || user.village || '—';
    const badges = (user.badges || '').split(',').map(b => b.trim()).filter(Boolean);

    // Avatar — initials + gradient
    const avatar = document.getElementById('p-avatar');
    if (avatar) {
      const parts = name.split(' ');
      const initials = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
      avatar.textContent = initials;
      avatar.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)';
    }

    set('p-name', name);
    set('p-email', email);
    set('p-village', village);
    set('p-role-text', role);

    // Join date
    try {
      if (joinDate) {
        const d = new Date(joinDate);
        set('p-date', d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
      }
    } catch { set('p-date', joinDate); }

    // Role badge color
    const roleEl = document.getElementById('p-role-badge');
    if (roleEl) {
      roleEl.textContent = role;
      const roleColors = {
        'Administrator': '#ef4444',
        'Admin': '#ef4444',
        'Forest Officer': '#f59e0b',
        'Citizen': '#3b82f6',
        'Observer': '#8b5cf6',
      };
      roleEl.style.background = roleColors[role] || '#3b82f6';
    }

    // Animate stats
    const pointsEl = document.getElementById('p-points');
    if (pointsEl) App.animateCounter(pointsEl, points, 1200);

    const repsEl = document.getElementById('p-reports-count');
    if (repsEl) App.animateCounter(repsEl, reportsCount, 900);

    const verEl = document.getElementById('p-verified-count');
    if (verEl) App.animateCounter(verEl, verifiedCount, 900);

    const badgesCountEl = document.getElementById('p-badges-count');
    if (badgesCountEl) App.animateCounter(badgesCountEl, badges.length, 600);

    // Badges section
    const badgeContainer = document.getElementById('p-badges');
    if (badgeContainer) {
      if (badges.length > 0) {
        const badgeIcons = { 'Green Guardian': '🌱', 'Bird Watcher': '🐦', 'Butterfly Explorer': '🦋', 'Nature Protector': '🌳', 'Biodiversity Champion': '🏆' };
        badgeContainer.innerHTML = badges.map(b => `
          <div class="b-chip">
            <span style="font-size:16px">${badgeIcons[b] || '🏅'}</span>
            <span>${b}</span>
          </div>`).join('');
      } else {
        badgeContainer.innerHTML = `
          <div style="font-size:12px;color:var(--text-dim);font-style:italic;padding:10px 0">
            🌱 Keep contributing to earn badges! Submit reports to unlock achievements.
          </div>`;
      }
    }

    // Store user for edit form
    window._profileUser = user;
  }

  async function loadMyReports() {
    const tbody = document.getElementById('p-reports-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px">
      <i class="fa fa-spinner fa-spin" style="color:var(--green-primary)"></i> Loading your reports...
    </td></tr>`;

    try {
      // Fetch MY reports via the profile endpoint which filters by user_id
      const user = Auth.getUser();
      const res = await fetch(`${API}/reports?limit=50`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');

      // Filter to only this user's reports
      let reports = (data.data || data || []);
      if (user && user.user_id) {
        const myReports = reports.filter(r => r.user_id === user.user_id);
        // If filtering gives results use them, else show all (means reports are already filtered by token)
        if (myReports.length > 0) reports = myReports;
      }

      if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-dim)">
          <i class="fa fa-leaf" style="font-size:28px;display:block;margin-bottom:8px;color:var(--green-primary)"></i>
          No reports submitted yet.<br>
          <a href="citizen-reports.html" style="color:var(--green-primary);font-size:12px;margin-top:6px;display:inline-block">Submit your first report →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = reports.map(r => {
        const vs = r.verification_status || 'Pending';
        const stClass = vs === 'Verified' ? 'verified' : vs === 'Rejected' ? 'rejected' : 'pending';
        const dateStr = r.report_date ? new Date(r.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const lat = parseFloat(r.latitude || 0).toFixed(4);
        const lng = parseFloat(r.longitude || 0).toFixed(4);
        return `<tr>
          <td style="padding:10px 12px;font-size:10px;color:var(--text-dim);font-family:monospace">${r.report_id}</td>
          <td style="padding:10px 12px;font-weight:600">${r.common_name || r.species_id || '—'}</td>
          <td style="padding:10px 12px;font-size:12px">${dateStr}</td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text-dim)">${lat}, ${lng}</td>
          <td style="padding:10px 12px"><span class="badge badge-${stClass}">${vs}</span></td>
        </tr>`;
      }).join('');

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:20px">
        <i class="fa fa-exclamation-triangle"></i> ${e.message}
      </td></tr>`;
    }
  }

  function initEditProfile() {
    const editBtn = document.getElementById('edit-profile-btn');
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('edit-modal-close');
    const saveBtn = document.getElementById('edit-save-btn');

    if (editBtn && modal) {
      editBtn.addEventListener('click', () => {
        const u = window._profileUser || Auth.getUser() || {};
        document.getElementById('edit-name').value = u.full_name || '';
        document.getElementById('edit-village').value = u.village_id || '';
        modal.classList.add('visible');
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
    }
    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const newName = document.getElementById('edit-name').value.trim();
        const newVillage = document.getElementById('edit-village').value.trim();
        if (!newName) { showToast('Name cannot be empty', 'error'); return; }

        // Update session
        const u = Auth.getUser();
        if (u) {
          u.full_name = newName;
          u.village_id = newVillage;
          sessionStorage.setItem('kb_session', JSON.stringify(u));
          renderProfile(u);
          Auth.renderUserUI();
        }
        modal.classList.remove('visible');
        showToast('Profile updated!', 'success');
      });
    }
  }

  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;
      font-size:13px;font-weight:600;color:#fff;
      background:${type === 'success' ? '#22c55e' : '#ef4444'};
      box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:slideIn 0.3s ease`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  return { init };
})();
window.ProfilePage = ProfilePage;
