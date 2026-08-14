/**
 * citizen-reports.js — Full Citizen Reports Module
 * Uses backend API endpoints for all operations.
 * Admin panel (verify/reject) shown ONLY for admin@kbic.in
 */
const CitizenReports = (() => {
  const API = 'http://localhost:3000/api';
  let allSpecies = [], allVillages = [];

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    [allSpecies, allVillages] = await Promise.all([
      DataLoader.load('species_master.csv'),
      DataLoader.load('villages.csv'),
    ]);
    populateDropdowns();
    setupForm();
    setupImageUpload();

    const isAdmin = Auth.hasPermission('verify_citizen_reports');
    if (isAdmin) {
      renderAdminPanel();
    } else {
      renderUserReports();
    }
  }

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  function populateDropdowns() {
    const spSelect = document.getElementById('cr-species');
    if (spSelect) {
      spSelect.innerHTML = '<option value="">Select species...</option>' +
        allSpecies.map(s => `<option value="${s.species_id}">${s.common_name} (${s.scientific_name})</option>`).join('');
    }
    const vlSelect = document.getElementById('cr-village');
    if (vlSelect) {
      vlSelect.innerHTML = '<option value="">Select village...</option>' +
        allVillages.map(v => `<option value="${v.village_id}">${v.village_name}</option>`).join('');
    }
  }

  // ── Render admin panel with ALL pending reports + verify/reject buttons ───
  async function renderAdminPanel() {
    const container = document.getElementById('reports-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
        <div style="padding:16px;background:linear-gradient(90deg,rgba(239,68,68,0.1),transparent);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="card-title" style="margin:0"><i class="fa fa-shield-alt text-amber card-title-icon"></i> Admin Panel — Pending Reports</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Only visible to admin@kbic.in — Verify or reject community submissions</div>
          </div>
          <div id="pending-badge" style="background:var(--amber-primary);color:#000;font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px">...</div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg-tertiary)">
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Report ID</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Reporter</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Species</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Date</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Location</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700">Remarks</th>
                <th style="padding:10px 12px;text-align:center;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;width:160px">Admin Action</th>
              </tr>
            </thead>
            <tbody id="admin-pending-tbody">
              <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim)"><i class="fa fa-spinner fa-spin"></i> Loading pending reports...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
          <div class="card-title"><i class="fa fa-list text-green card-title-icon"></i> All Reports</div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg-tertiary)">
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">ID</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Reporter</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Species</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Date</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Status</th>
              </tr>
            </thead>
            <tbody id="all-reports-tbody">
              <tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-dim)"><i class="fa fa-spinner fa-spin"></i> Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadPendingReports();
    await loadAllReports();
  }

  async function loadPendingReports() {
    const tbody = document.getElementById('admin-pending-tbody');
    const badge = document.getElementById('pending-badge');
    if (!tbody) return;
    try {
      const res = await fetch(`${API}/reports/pending`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const reports = data.data || [];
      if (badge) badge.textContent = reports.length + ' Pending';

      if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--green-primary)"><i class="fa fa-check-circle"></i> No pending reports! All caught up.</td></tr>';
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr id="admin-row-${r.report_id}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <td style="padding:12px;font-size:10px;color:var(--text-dim);font-family:monospace">${r.report_id}</td>
          <td style="padding:12px">
            <div style="font-weight:600;font-size:12px">${r.reporter_name || 'Unknown'}</div>
            <div style="font-size:10px;color:var(--text-dim)">${r.reporter_email || ''}</div>
          </td>
          <td style="padding:12px">
            <div style="font-weight:600;font-size:12px">${r.common_name || r.species_id}</div>
            <div style="font-size:10px;color:var(--text-dim);font-style:italic">${r.scientific_name || ''}</div>
          </td>
          <td style="padding:12px;font-size:11px">${r.report_date}</td>
          <td style="padding:12px;font-size:10px;color:var(--text-dim)">${parseFloat(r.latitude||0).toFixed(4)}, ${parseFloat(r.longitude||0).toFixed(4)}</td>
          <td style="padding:12px;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.remarks||''}">${(r.remarks||'No remarks').slice(0,60)}</td>
          <td style="padding:12px;text-align:center" id="action-${r.report_id}">
            <div style="display:flex;gap:6px;justify-content:center">
              <button onclick="CitizenReports.verifyReport('${r.report_id}')" 
                style="padding:5px 10px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid #22c55e;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;transition:var(--transition)"
                onmouseover="this.style.background='rgba(34,197,94,0.3)'" onmouseout="this.style.background='rgba(34,197,94,0.15)'">
                <i class="fa fa-check"></i> Verify
              </button>
              <button onclick="CitizenReports.rejectReport('${r.report_id}')"
                style="padding:5px 10px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid #ef4444;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;transition:var(--transition)"
                onmouseover="this.style.background='rgba(239,68,68,0.3)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">
                <i class="fa fa-times"></i> Reject
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444">${e.message}</td></tr>`;
    }
  }

  async function loadAllReports() {
    const tbody = document.getElementById('all-reports-tbody');
    if (!tbody) return;
    try {
      const res = await fetch(`${API}/reports?limit=100`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const reports = data.data || [];

      tbody.innerHTML = reports.map(r => {
        const vs = r.verification_status || 'Pending';
        const stClass = vs === 'Verified' ? 'verified' : vs === 'Rejected' ? 'rejected' : 'pending';
        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
            <td style="padding:10px 12px;font-size:10px;color:var(--text-dim);font-family:monospace">${r.report_id}</td>
            <td style="padding:10px 12px;font-size:12px;font-weight:600">${r.reporter_name || 'Unknown'}</td>
            <td style="padding:10px 12px;font-size:12px">${r.common_name || r.species_id}</td>
            <td style="padding:10px 12px;font-size:11px">${r.report_date}</td>
            <td style="padding:10px 12px"><span class="badge badge-${stClass}">${vs}</span></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444">${e.message}</td></tr>`;
    }
  }

  // ── Render regular user's own reports ────────────────────────────────────
  async function renderUserReports() {
    const container = document.getElementById('reports-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
          <div class="card-title"><i class="fa fa-history text-green card-title-icon"></i> My Submitted Reports</div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg-tertiary)">
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Report ID</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Species</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Date</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Remarks</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Status</th>
                <th style="padding:10px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--text-dim)">Admin Notes</th>
              </tr>
            </thead>
            <tbody id="cr-tbody">
              <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim)"><i class="fa fa-spinner fa-spin"></i> Loading your reports...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    await loadUserReports();
  }

  async function loadUserReports() {
    const tbody = document.getElementById('cr-tbody');
    if (!tbody) return;
    try {
      const res = await fetch(`${API}/reports?limit=50`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const reports = data.data || [];

      if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim)"><i class="fa fa-leaf" style="font-size:24px;margin-bottom:8px;display:block"></i>No reports yet. Submit your first sighting!</td></tr>';
        return;
      }

      tbody.innerHTML = reports.map(r => {
        const vs = r.verification_status || 'Pending';
        const stClass = vs === 'Verified' ? 'verified' : vs === 'Rejected' ? 'rejected' : 'pending';
        const stIcon = vs === 'Verified' ? '✅' : vs === 'Rejected' ? '❌' : '⏳';
        return `
          <tr id="row-${r.report_id}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 12px;font-size:10px;color:var(--text-dim);font-family:monospace">${r.report_id}</td>
            <td style="padding:10px 12px;font-weight:600">${r.common_name || r.species_id}</td>
            <td style="padding:10px 12px">${r.report_date}</td>
            <td style="padding:10px 12px;color:var(--text-secondary)">${(r.remarks||'N/A').slice(0,50)}</td>
            <td style="padding:10px 12px" id="status-${r.report_id}"><span class="badge badge-${stClass}">${stIcon} ${vs}</span></td>
            <td style="padding:10px 12px;font-size:11px;color:var(--text-dim)">${r.admin_comments || 'Awaiting review'}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#ef4444">${e.message}</td></tr>`;
    }
  }

  // ── Form Setup ────────────────────────────────────────────────────────────
  function setupForm() {
    const form = document.getElementById('cr-form');
    if (!form) return;
    form.addEventListener('submit', handleSubmit);
    const dateEl = document.getElementById('cr-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const gpsBtn = document.getElementById('cr-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', getCurrentLocation);
  }

  async function getCurrentLocation() {
    const btn = document.getElementById('cr-gps-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; }

    const setLocation = (lat, lng, msg) => {
      const latEl = document.getElementById('cr-lat');
      const lngEl = document.getElementById('cr-lng');
      if (latEl) latEl.value = parseFloat(lat).toFixed(6);
      if (lngEl) lngEl.value = parseFloat(lng).toFixed(6);
      Notifications.success('📍 Location Detected!', msg);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-crosshairs"></i>'; }
    };

    const fallback = async () => {
      try {
        const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const d = await r.json();
        if (d.latitude && d.longitude) setLocation(d.latitude, d.longitude, `IP-based: ${d.city || 'Unknown'}`);
        else throw new Error('no coords');
      } catch {
        setLocation('19.875000', '74.475000', 'Using Kopargaon center (GPS unavailable)');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation(pos.coords.latitude, pos.coords.longitude, `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
        () => fallback(),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
      );
    } else { fallback(); }
  }

  // ── Image Upload ──────────────────────────────────────────────────────────
  function setupImageUpload() {
    const zone = document.getElementById('cr-upload-zone');
    const input = document.getElementById('cr-image-input');
    const preview = document.getElementById('cr-image-preview');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file, preview);
    });
    input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0], preview); });
  }

  function handleFile(file, preview) {
    if (!file.type.startsWith('image/')) { Notifications.error('Invalid File', 'Please upload an image (JPEG/PNG).'); return; }
    if (file.size > 5 * 1024 * 1024) { Notifications.error('Too Large', 'Max file size is 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      if (preview) preview.innerHTML = `
        <img src="${e.target.result}" style="max-height:120px;border-radius:8px;object-fit:cover;border:1px solid var(--border)">
        <div style="margin-top:6px;font-size:11px;color:var(--text-dim)">📎 ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>`;
    };
    reader.readAsDataURL(file);
  }

  // ── Form Submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const species = document.getElementById('cr-species')?.value;
    const lat     = document.getElementById('cr-lat')?.value;
    const lng     = document.getElementById('cr-lng')?.value;
    const desc    = document.getElementById('cr-desc')?.value;

    if (!species) { Notifications.warning('Required', 'Please select a species.'); return; }
    if (!lat || !lng) { Notifications.warning('Location Required', 'Please provide coordinates or use GPS.'); return; }
    if (!desc || desc.trim().length < 10) { Notifications.warning('Description Short', 'Write at least 10 characters.'); return; }

    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Submitting...'; }

    try {
      const res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
        body: JSON.stringify({ species, lat, lng, desc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');

      Notifications.success('🌿 Report Submitted!', `Report ID: ${data.report_id} | +10 Points earned! Status: Pending Verification`, 6000);
      e.target.reset();
      document.getElementById('cr-image-preview').innerHTML = '';
      document.getElementById('cr-date').value = new Date().toISOString().split('T')[0];

      // Refresh reports
      if (Auth.hasPermission('verify_citizen_reports')) {
        await loadPendingReports();
        await loadAllReports();
      } else {
        await loadUserReports();
      }
    } catch (err) {
      Notifications.error('Submit Failed', err.message);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> Submit Report'; }
    }
  }

  // ── Verify / Reject (Admin Only) ─────────────────────────────────────────
  async function verifyReport(reportId) {
    if (!Auth.hasPermission('verify_citizen_reports')) {
      Notifications.error('Access Denied', 'Only admin@kbic.in can verify reports.'); return;
    }
    const actionCell = document.getElementById(`action-${reportId}`);
    if (actionCell) actionCell.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:var(--green-primary)"></i>';

    try {
      const res = await fetch(`${API}/reports/${reportId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
        body: JSON.stringify({ admin_comments: 'Verified by administrator.' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update the row to show verified
      const row = document.getElementById(`admin-row-${reportId}`);
      if (row) {
        row.style.opacity = '0.5';
        row.style.background = 'rgba(34,197,94,0.05)';
      }
      if (actionCell) actionCell.innerHTML = '<span style="color:#22c55e;font-size:12px;font-weight:700"><i class="fa fa-check-circle"></i> Verified</span>';
      Notifications.success('✅ Report Verified', `Report ${reportId} verified! +20 points awarded to reporter.`);
      
      // Update pending badge count
      const badge = document.getElementById('pending-badge');
      if (badge) {
        const current = parseInt(badge.textContent) || 1;
        badge.textContent = `${Math.max(0, current-1)} Pending`;
      }
    } catch (e) {
      Notifications.error('Verification Failed', e.message);
      if (actionCell) actionCell.innerHTML = `<span style="color:#ef4444;font-size:11px"><i class="fa fa-exclamation-circle"></i> Error</span>`;
    }
  }

  async function rejectReport(reportId) {
    if (!Auth.hasPermission('verify_citizen_reports')) {
      Notifications.error('Access Denied', 'Only admin@kbic.in can reject reports.'); return;
    }
    const reason = prompt('Enter rejection reason (optional):') || 'Report does not meet quality standards.';
    const actionCell = document.getElementById(`action-${reportId}`);
    if (actionCell) actionCell.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#ef4444"></i>';

    try {
      const res = await fetch(`${API}/reports/${reportId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
        body: JSON.stringify({ admin_comments: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const row = document.getElementById(`admin-row-${reportId}`);
      if (row) { row.style.opacity = '0.4'; row.style.background = 'rgba(239,68,68,0.05)'; }
      if (actionCell) actionCell.innerHTML = '<span style="color:#ef4444;font-size:12px;font-weight:700"><i class="fa fa-times-circle"></i> Rejected</span>';
      Notifications.warning('❌ Report Rejected', `Report ${reportId} has been rejected.`);
    } catch (e) {
      Notifications.error('Rejection Failed', e.message);
      if (actionCell) actionCell.innerHTML = `<span style="color:#ef4444">Error</span>`;
    }
  }

  return { init, verifyReport, rejectReport, getCurrentLocation };
})();
window.CitizenReports = CitizenReports;
