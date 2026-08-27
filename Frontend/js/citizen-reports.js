/**
 * citizen-reports.js — Full Citizen Reports Module
 * Uses backend API endpoints for all operations.
 * Admin panel (verify/reject) shown ONLY for admin@kbic.in
 * Verification workflow: PENDING → APPROVED/REJECTED
 */
const CitizenReports = (() => {
  const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
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

  // ── Render admin panel with stats + pending reports + verify/reject ──────
  async function renderAdminPanel() {
    const container = document.getElementById('reports-container');
    if (!container) return;

    container.innerHTML = `
      <!-- Admin Stats Row -->
      <div id="admin-stats-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--text-white)" id="stat-total">…</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">Total</div>
        </div>
        <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#fbbf24" id="stat-pending">…</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">⏳ Pending</div>
        </div>
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#22c55e" id="stat-approved">…</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">✅ Approved</div>
        </div>
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#ef4444" id="stat-rejected">…</div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;margin-top:2px">❌ Rejected</div>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
        <div style="padding:16px;background:linear-gradient(90deg,rgba(239,68,68,0.1),transparent);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="card-title" style="margin:0"><i class="fa fa-shield-alt text-amber card-title-icon"></i> Admin Panel — Pending Reports</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Only visible to admin@kbic.in — Approve or reject community submissions</div>
          </div>
          <div id="pending-badge" style="background:var(--amber-primary,#fbbf24);color:#000;font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px">…</div>
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
                <th style="padding:10px 12px;text-align:center;font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;width:180px">Admin Action</th>
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

      <!-- Detail Modal (Admin) -->
      <div id="report-detail-overlay" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);align-items:center;justify-content:center">
        <div id="report-detail-box" style="background:#0f2318;border:1px solid rgba(34,197,94,0.2);border-radius:20px;width:100%;max-width:580px;max-height:85vh;overflow-y:auto;padding:28px;position:relative">
          <button onclick="CitizenReports.closeDetailModal()" style="position:absolute;top:14px;right:14px;background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer"><i class="fa fa-times"></i></button>
          <div id="report-detail-content"></div>
        </div>
      </div>

      <!-- Reject Reason Modal -->
      <div id="reject-modal-overlay" style="display:none;position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);align-items:center;justify-content:center">
        <div style="background:#0f2318;border:1px solid rgba(239,68,68,0.3);border-radius:16px;width:100%;max-width:440px;padding:28px">
          <div style="font-size:16px;font-weight:800;margin-bottom:4px">❌ Reject Report</div>
          <div id="reject-report-id-label" style="font-size:11px;color:var(--text-dim);margin-bottom:16px"></div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:6px">Rejection Reason <span style="color:#ef4444">*</span></label>
          <textarea id="reject-reason-input" rows="3" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(239,68,68,0.4);border-radius:10px;color:#fff;font-size:13px;font-family:inherit;resize:vertical;" placeholder="Explain why this report is being rejected..."></textarea>
          <div style="display:flex;gap:10px;margin-top:14px">
            <button id="reject-confirm-btn" onclick="CitizenReports.confirmReject()" style="flex:1;padding:10px;background:linear-gradient(135deg,#ef4444,#b91c1c);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-size:13px"><i class="fa fa-times-circle"></i> Confirm Reject</button>
            <button onclick="CitizenReports.closeRejectModal()" style="padding:10px 18px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text-secondary);cursor:pointer;font-size:13px">Cancel</button>
          </div>
        </div>
      </div>
    `;

    await loadAdminStats();
    await loadPendingReports();
    await loadAllReports();
  }

  async function loadAdminStats() {
    try {
      const res = await fetch(`${API}/admin/reports/stats`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      if (!res.ok) return;
      const d = await res.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('stat-total',    d.total   || 0);
      set('stat-pending',  d.pending || 0);
      set('stat-approved', d.approved|| 0);
      set('stat-rejected', d.rejected|| 0);
    } catch(e) { console.warn('Stats load failed:', e.message); }
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

      // Also update stats counters if available
      const pendingEl = document.getElementById('stat-pending');
      if (pendingEl) pendingEl.textContent = reports.length;

      if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--green-primary)"><i class="fa fa-check-circle"></i> No pending reports! All caught up.</td></tr>';
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr id="admin-row-${r.report_id}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <td style="padding:12px;font-size:10px;color:var(--text-dim);font-family:monospace">
            <a href="#" onclick="CitizenReports.openReportDetail('${r.report_id}');return false;" style="color:var(--green-primary);text-decoration:none;font-weight:600">${r.report_id}</a>
          </td>
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
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
              <button onclick="CitizenReports.openReportDetail('${r.report_id}')"
                style="padding:5px 8px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid #38bdf8;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600">
                <i class="fa fa-eye"></i> View
              </button>
              <button onclick="CitizenReports.verifyReport('${r.report_id}')"
                style="padding:5px 8px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid #22c55e;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;transition:var(--transition)"
                onmouseover="this.style.background='rgba(34,197,94,0.3)'" onmouseout="this.style.background='rgba(34,197,94,0.15)'">
                <i class="fa fa-check"></i> Approve
              </button>
              <button onclick="CitizenReports.rejectReport('${r.report_id}')"
                style="padding:5px 8px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid #ef4444;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;transition:var(--transition)"
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
      // Use /api/reports/my to always get ONLY this user's reports
      const res = await fetch(`${API}/reports/my?limit=50`, {
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
        const stIcon  = vs === 'Verified' ? '✅' : vs === 'Rejected' ? '❌' : '⏳';
        const adminNote = r.admin_comments
          ? `<span title="${r.admin_comments}" style="cursor:help">${r.admin_comments.slice(0,40)}${r.admin_comments.length>40?'…':''}</span>`
          : '<span style="color:var(--text-dim)">Awaiting review</span>';
        return `
          <tr id="row-${r.report_id}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 12px;font-size:10px;color:var(--text-dim);font-family:monospace">${r.report_id}</td>
            <td style="padding:10px 12px;font-weight:600">${r.common_name || r.species_id}</td>
            <td style="padding:10px 12px">${r.report_date}</td>
            <td style="padding:10px 12px;color:var(--text-secondary)">${(r.remarks||'N/A').slice(0,50)}</td>
            <td style="padding:10px 12px" id="status-${r.report_id}"><span class="badge badge-${stClass}">${stIcon} ${vs}</span></td>
            <td style="padding:10px 12px;font-size:11px">${adminNote}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#ef4444">${e.message}</td></tr>`;
    }
  }

  function setupForm() {
    const form = document.getElementById('cr-form');
    if (!form) return;
    form.addEventListener('submit', handleSubmit);
    const dateEl = document.getElementById('cr-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const gpsBtn = document.getElementById('cr-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', getCurrentLocation);
    
    // Setup Voice Dictation for the description field
    const dictateBtn = document.getElementById('cr-dictate-btn');
    const descEl = document.getElementById('cr-desc');
    if (dictateBtn && descEl) {
      setupDictation(dictateBtn, descEl);
    }
  }

  function setupDictation(btn, textarea) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      btn.style.display = 'none';
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    let isListening = false;
    let finalTranscript = '';
    
    recognition.onstart = function() {
      isListening = true;
      btn.innerHTML = '<i class="fa fa-microphone fa-pulse"></i> Listening...';
      btn.style.background = 'rgba(239, 68, 68, 0.1)';
      btn.style.borderColor = 'var(--red)';
      btn.style.color = 'var(--red)';
    };
    
    recognition.onresult = function(event) {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          textarea.value = finalTranscript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      // Optional: Could display interimTranscript in a temporary way, 
      // but for simplicity we'll just update the textarea with final text.
      // If we want real-time feedback in the textarea:
      textarea.value = finalTranscript + interimTranscript;
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        Notifications.error('Voice Error', 'Could not recognize speech: ' + event.error);
      }
      stopDictation();
    };
    
    recognition.onend = function() {
      stopDictation();
    };
    
    function stopDictation() {
      if (!isListening) return;
      isListening = false;
      btn.innerHTML = '<i class="fa fa-microphone"></i> Dictate';
      btn.style.background = 'rgba(34,197,94,0.1)';
      btn.style.borderColor = 'var(--green-primary)';
      btn.style.color = 'var(--green-primary)';
      // Ensure the final transcript reflects the latest textarea value in case user typed
      finalTranscript = textarea.value;
    }
    
    btn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        finalTranscript = textarea.value;
        if (finalTranscript && !finalTranscript.endsWith(' ')) finalTranscript += ' ';
        try {
          recognition.start();
        } catch(e) {}
      }
    });
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

  let currentAuthResult = null;

  async function handleFile(file, preview) {
    if (!file.type.startsWith('image/')) { Notifications.error('Invalid File', 'Please upload an image (JPEG/PNG/WEBP).'); return; }
    if (file.size > 5 * 1024 * 1024) { Notifications.error('Too Large', 'Max file size is 5MB.'); return; }
    
    // Reset previous auth result
    currentAuthResult = null;
    const authContainer = document.getElementById('cr-auth-check-container');
    const submitBtn = document.querySelector('#cr-form [type="submit"]');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (preview) preview.innerHTML = `
        <img src="${e.target.result}" style="max-height:120px;border-radius:8px;object-fit:cover;border:1px solid var(--border)">
        <div style="margin-top:6px;font-size:11px;color:var(--text-dim)">📎 ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>`;
      
      if (authContainer) {
        authContainer.style.display = 'block';
        authContainer.innerHTML = `<div style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
          <i class="fa fa-spinner fa-spin text-blue"></i> Analyzing image authenticity...
        </div>`;
      }
      
      if (submitBtn) submitBtn.disabled = true;

      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const res = await fetch(`${API}/citizen-reports/check-image-authenticity`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
          body: formData
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || data.message || 'Verification failed');
        
        currentAuthResult = data;
        
        if (authContainer) {
          let uiHtml = '';
          if (data.status === 'LOW_RISK') {
            uiHtml = `<div style="padding:10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px;">
              <div style="color:var(--green-primary); font-weight:700; margin-bottom:4px;"><i class="fa fa-check-circle"></i> IMAGE AUTHENTICITY CHECK</div>
              <div style="color:var(--text-secondary); margin-bottom:2px;">AI-generated probability: <b>${data.aiGeneratedPercentage}%</b></div>
              <div style="color:var(--text-dim);">Status: LIKELY AUTHENTIC</div>
            </div>`;
          } else if (data.status === 'HIGH_RISK') {
            uiHtml = `<div style="padding:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px;">
              <div style="color:var(--red); font-weight:700; margin-bottom:4px;"><i class="fa fa-exclamation-triangle"></i> ⚠ IMAGE REVIEW REQUIRED</div>
              <div style="color:var(--text-secondary); margin-bottom:4px;">AI-generated probability: <b>${data.aiGeneratedPercentage}%</b></div>
              <div style="color:var(--text-dim); line-height:1.4;">This image may have been generated or edited using generative AI.<br>Please upload an original field photograph or submit this observation for manual review.</div>
            </div>`;
          } else {
            uiHtml = `<div style="padding:10px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:8px;">
              <div style="color:var(--accent-amber); font-weight:700; margin-bottom:4px;"><i class="fa fa-info-circle"></i> ℹ AUTHENTICITY REVIEW</div>
              <div style="color:var(--text-secondary); margin-bottom:2px;">AI-generated probability: <b>${data.aiGeneratedPercentage !== undefined ? data.aiGeneratedPercentage + '%' : 'N/A'}</b></div>
              <div style="color:var(--text-dim); line-height:1.4;">${data.message || 'The image requires additional verification.'}</div>
            </div>`;
          }
          authContainer.innerHTML = uiHtml;
        }
      } catch (err) {
        console.error('Authenticity check error:', err);
        currentAuthResult = {
          success: false,
          status: 'CHECK_UNAVAILABLE',
          requiresReview: true,
          message: 'Image authenticity check is temporarily unavailable. Manual verification is required.'
        };
        if (authContainer) {
          authContainer.innerHTML = `<div style="padding:10px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:8px;">
            <div style="color:var(--accent-amber); font-weight:700; margin-bottom:4px;"><i class="fa fa-info-circle"></i> ℹ AUTHENTICITY CHECK UNAVAILABLE</div>
            <div style="color:var(--text-dim); line-height:1.4;">Manual review required.</div>
          </div>`;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
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
    const village = document.getElementById('cr-village')?.value;
    const time    = document.getElementById('cr-time')?.value;
    const count   = document.getElementById('cr-count')?.value || 1;

    if (!species) { Notifications.warning('Required', 'Please select a species.'); return; }
    if (!lat || !lng) { Notifications.warning('Location Required', 'Please provide coordinates or use GPS.'); return; }
    if (!desc || desc.trim().length < 10) { Notifications.warning('Description Short', 'Write at least 10 characters.'); return; }

    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Submitting...'; }

    try {
      const requestBody = { 
        species, lat, lng, desc, village_id: village, report_time: time, count,
        ...(currentAuthResult && {
          image_auth_status: currentAuthResult.status,
          image_ai_probability: currentAuthResult.aiGeneratedProbability,
          image_auth_requires_review: currentAuthResult.requiresReview
        })
      };

      const res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');

      // Show success banner with PENDING status — matching required UX
      Notifications.success(
        '🌿 Report Submitted!',
        `Report ID: ${data.report_id} | Status: Pending Verification | +10 Points earned!`,
        7000
      );

      // Show inline success message below form
      const successBanner = document.getElementById('cr-success-banner');
      if (successBanner) {
        successBanner.style.display = 'block';
        successBanner.innerHTML = `
          <div style="padding:12px 16px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.4);border-radius:10px;margin-top:10px;font-size:12px">
            <div style="font-weight:700;color:#22c55e;margin-bottom:3px">✅ Report Submitted Successfully</div>
            <div style="color:var(--text-secondary)">Report ID: <b>${data.report_id}</b></div>
            <div style="color:var(--text-secondary)">Status: <b style="color:#fbbf24">⏳ Pending Verification</b></div>
            <div style="color:var(--text-dim);font-size:11px;margin-top:4px">Your report will be reviewed by the admin team.</div>
          </div>`;
        setTimeout(() => { if (successBanner) successBanner.style.display = 'none'; }, 10000);
      }

      e.target.reset();
      const preview = document.getElementById('cr-image-preview');
      if (preview) preview.innerHTML = '';
      const authContainer = document.getElementById('cr-auth-check-container');
      if (authContainer) {
        authContainer.style.display = 'none';
        authContainer.innerHTML = '';
      }
      currentAuthResult = null;
      const dateEl = document.getElementById('cr-date');
      if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

      // Refresh the reports list
      if (Auth.hasPermission('verify_citizen_reports')) {
        await loadAdminStats();
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

  // ── Verify / Reject (Admin Only — enforced on backend too) ───────────────
  async function verifyReport(reportId) {
    if (!Auth.hasPermission('verify_citizen_reports')) {
      Notifications.error('Access Denied', 'Only admin@kbic.in can approve reports.'); return;
    }
    const actionCell = document.getElementById(`action-${reportId}`);
    if (actionCell) actionCell.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:var(--green-primary)"></i>';

    try {
      const res = await fetch(`${API}/reports/${reportId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
        body: JSON.stringify({ admin_comments: 'Approved by administrator.' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const row = document.getElementById(`admin-row-${reportId}`);
      if (row) { row.style.opacity = '0.5'; row.style.background = 'rgba(34,197,94,0.05)'; }
      if (actionCell) actionCell.innerHTML = '<span style="color:#22c55e;font-size:12px;font-weight:700"><i class="fa fa-check-circle"></i> Approved</span>';
      Notifications.success('✅ Report Approved', `Report ${reportId} approved! +20 points awarded to reporter.`);

      // Update badge
      const badge = document.getElementById('pending-badge');
      if (badge) {
        const current = parseInt(badge.textContent) || 1;
        badge.textContent = `${Math.max(0, current-1)} Pending`;
      }
      // Refresh stats
      await loadAdminStats();
    } catch (e) {
      Notifications.error('Approval Failed', e.message);
      if (actionCell) actionCell.innerHTML = `<span style="color:#ef4444;font-size:11px"><i class="fa fa-exclamation-circle"></i> Error</span>`;
    }
  }

  let _pendingRejectId = null;

  async function rejectReport(reportId) {
    if (!Auth.hasPermission('verify_citizen_reports')) {
      Notifications.error('Access Denied', 'Only admin@kbic.in can reject reports.'); return;
    }
    _pendingRejectId = reportId;
    const label = document.getElementById('reject-report-id-label');
    if (label) label.textContent = `Report ID: ${reportId}`;
    const reasonInput = document.getElementById('reject-reason-input');
    if (reasonInput) reasonInput.value = '';
    const overlay = document.getElementById('reject-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  async function confirmReject() {
    if (!_pendingRejectId) return;
    const reason = document.getElementById('reject-reason-input')?.value?.trim();
    if (!reason || reason.length < 5) {
      Notifications.warning('Reason Required', 'Please enter a rejection reason (min. 5 characters).'); return;
    }
    const reportId = _pendingRejectId;
    closeRejectModal();

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
      Notifications.warning('❌ Report Rejected', `Report ${reportId} has been rejected. Reason saved.`);
      // Refresh stats
      await loadAdminStats();
    } catch (e) {
      Notifications.error('Rejection Failed', e.message);
      if (actionCell) actionCell.innerHTML = `<span style="color:#ef4444">Error</span>`;
    }
  }

  function closeRejectModal() {
    const overlay = document.getElementById('reject-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    _pendingRejectId = null;
  }

  // ── Admin Report Detail Modal ─────────────────────────────────────────────
  async function openReportDetail(reportId) {
    const overlay = document.getElementById('report-detail-overlay');
    const content = document.getElementById('report-detail-content');
    if (!overlay || !content) return;
    overlay.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)"><i class="fa fa-spinner fa-spin fa-2x"></i></div>';

    try {
      const res = await fetch(`${API}/admin/reports/${reportId}`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);

      const vs = r.verification_status || 'Pending';
      const stClass = vs === 'Verified' ? 'verified' : vs === 'Rejected' ? 'rejected' : 'pending';
      const stIcon  = vs === 'Verified' ? '✅' : vs === 'Rejected' ? '❌' : '⏳';

      content.innerHTML = `
        <div style="font-size:16px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:10px;justify-content:space-between">
          <span>📋 Report Details</span>
          <span class="badge badge-${stClass}">${stIcon} ${vs}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          ${detailRow('Report ID',      r.report_id)}
          ${detailRow('Submitted',      r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-IN') : r.report_date)}
          ${detailRow('Reporter',       r.reporter_name || 'Unknown')}
          ${detailRow('Reporter Email', r.reporter_email || '—')}
          ${detailRow('Reporter Role',  r.reporter_role || '—')}
          ${detailRow('Date',           r.report_date)}
          ${detailRow('Time',           r.report_time || '—')}
          ${detailRow('Species',        (r.common_name || r.species_id))}
          ${detailRow('Scientific Name',r.scientific_name || '—')}
          ${detailRow('Category',       r.category || '—')}
          ${detailRow('IUCN Status',    r.iucn_status || '—')}
          ${detailRow('Habitat',        r.habitat || r.habitat_id || '—')}
          ${detailRow('Village',        r.village_name || r.village_id || '—')}
          ${detailRow('Latitude',       r.latitude || '—')}
          ${detailRow('Longitude',      r.longitude || '—')}
          ${detailRow('Individual Count', r.count || r.individual_count || '—')}
        </div>

        <div style="margin-bottom:10px;padding:10px 12px;background:var(--bg-tertiary);border-radius:8px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Remarks / Notes</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">${r.remarks || 'No remarks provided.'}</div>
        </div>

        ${r.image_auth_status ? `
          <div style="margin-bottom:10px;padding:12px;background:${r.image_auth_status === 'LOW_RISK' ? 'rgba(34,197,94,0.07)' : r.image_auth_status === 'HIGH_RISK' ? 'rgba(239,68,68,0.07)' : 'rgba(251,191,36,0.07)'};border:1px solid ${r.image_auth_status === 'LOW_RISK' ? 'rgba(34,197,94,0.3)' : r.image_auth_status === 'HIGH_RISK' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'};border-radius:8px">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--text-primary);margin-bottom:8px">IMAGE AUTHENTICITY</div>
            
            ${r.image_ai_probability !== null ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">AI-generated probability:<br><b style="font-size:14px;color:var(--text-primary)">${Math.round(r.image_ai_probability * 100)}%</b></div>` : ''}
            
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Classification:<br>
              <b style="color:${r.image_auth_status === 'LOW_RISK' ? '#22c55e' : r.image_auth_status === 'HIGH_RISK' ? '#ef4444' : '#fbbf24'}">
                ${r.image_auth_status === 'LOW_RISK' ? 'LIKELY REAL' : r.image_auth_status === 'HIGH_RISK' ? 'POTENTIALLY AI-GENERATED' : 'REVIEW REQUIRED'}
              </b>
            </div>
            
            <div style="font-size:12px;color:var(--text-secondary)">Status:<br>
              <b>${r.image_auth_status === 'LOW_RISK' ? 'READY FOR VERIFICATION' : r.image_auth_status === 'HIGH_RISK' ? 'REQUIRES VERIFICATION' : 'REQUIRES MANUAL VERIFICATION'}</b>
            </div>
          </div>
        ` : ''}

        ${r.admin_comments ? `
          <div style="margin-bottom:10px;padding:10px 12px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Admin Comments</div>
            <div style="font-size:12px;color:var(--text-secondary)">${r.admin_comments}</div>
            ${r.reviewed_at ? `<div style="font-size:10px;color:var(--text-dim);margin-top:4px">Reviewed: ${new Date(r.reviewed_at).toLocaleString('en-IN')}</div>` : ''}
          </div>` : ''}

        ${vs === 'Pending' ? `
          <div style="display:flex;gap:10px;margin-top:16px">
            <button onclick="CitizenReports.verifyReport('${r.report_id}');CitizenReports.closeDetailModal();"
              style="flex:1;padding:10px;background:linear-gradient(135deg,#22c55e,#15803d);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-size:13px">
              <i class="fa fa-check-circle"></i> Approve Report
            </button>
            <button onclick="CitizenReports.closeDetailModal();CitizenReports.rejectReport('${r.report_id}');"
              style="flex:1;padding:10px;background:linear-gradient(135deg,#ef4444,#b91c1c);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-size:13px">
              <i class="fa fa-times-circle"></i> Reject Report
            </button>
          </div>` : ''}
      `;
    } catch(e) {
      content.innerHTML = `<div style="color:#ef4444;text-align:center;padding:30px"><i class="fa fa-exclamation-triangle"></i> ${e.message}</div>`;
    }
  }

  function detailRow(label, value) {
    return `<div style="padding:8px 10px;background:var(--bg-tertiary);border-radius:7px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:2px">${label}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary)">${value || '—'}</div>
    </div>`;
  }

  function closeDetailModal() {
    const overlay = document.getElementById('report-detail-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  return { init, verifyReport, rejectReport, confirmReject, openReportDetail, closeDetailModal, closeRejectModal, getCurrentLocation };
})();
window.CitizenReports = CitizenReports;
