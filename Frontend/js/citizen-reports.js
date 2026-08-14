/**
 * citizen-reports.js — Citizen report form and reports list
 */
const CitizenReports = (() => {
  let allReports = [], allSpecies = [], allVillages = [];
  let reportCounter = 9000;

  async function init() {
    [allReports, allSpecies, allVillages] = await Promise.all([
      DataLoader.load('citizen_reports.csv'),
      DataLoader.load('species_master.csv'),
      DataLoader.load('villages.csv'),
    ]);
    populateDropdowns();
    renderReportsTable();
    setupForm();
    setupImageUpload();
  }

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

  function renderReportsTable() {
    const tbody = document.getElementById('cr-tbody');
    if (!tbody) return;
    const user = Auth.getUser();
    const userReports = allReports.slice(0, 20);
    if (userReports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">No reports yet. Submit your first report!</td></tr>';
      return;
    }
    const speciesMap = {};
    allSpecies.forEach(s => { speciesMap[s.species_id] = s; });
    const canVerify = Auth.hasPermission('verify_citizen_reports');

    tbody.innerHTML = userReports.map(r => {
      const sp = speciesMap[r.species_id];
      const vs = r.verification_status || 'Pending';
      const vsClass = vs === 'Verified' ? 'verified' : vs === 'Rejected' ? 'rejected' : 'pending';
      
      let actionHtml = '-';
      if (canVerify && vs === 'Pending') {
        actionHtml = `<button class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="CitizenReports.verifyReport('${r.report_id}')"><i class="fa fa-check text-green"></i> Verify</button>`;
      } else if (canVerify) {
        actionHtml = `<span style="font-size:10px;color:var(--text-dim)">Done</span>`;
      }

      return `<tr id="row-${r.report_id}">
        <td style="font-size:10px;color:var(--text-dim)">${r.report_id}</td>
        <td>${sp ? sp.common_name : r.species_id}</td>
        <td>${App.formatDate(r.report_date)}</td>
        <td>${r.remarks ? r.remarks.slice(0,40)+'...' : 'N/A'}</td>
        <td id="status-${r.report_id}"><span class="badge badge-${vsClass}">${vs}</span></td>
        <td>${r.admin_comments || '-'}</td>
        <td>${actionHtml}</td>
      </tr>`;
    }).join('');
  }

  function setupForm() {
    const form = document.getElementById('cr-form');
    if (!form) return;
    form.addEventListener('submit', handleSubmit);

    // Date default to today
    const dateEl = document.getElementById('cr-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    // GPS button
    const gpsBtn = document.getElementById('cr-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', getCurrentLocation);
  }

  async function getCurrentLocation() {
    const btn = document.getElementById('cr-gps-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
    }

    const setLocation = (lat, lng, msg) => {
      const latEl = document.getElementById('cr-lat');
      const lngEl = document.getElementById('cr-lng');
      if (latEl) latEl.value = parseFloat(lat).toFixed(6);
      if (lngEl) lngEl.value = parseFloat(lng).toFixed(6);
      Notifications.success('Location detected!', msg);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-crosshairs"></i>'; }
    };

    const fallbackToIP = async () => {
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          setLocation(data.latitude, data.longitude, `Lat: ${data.latitude}, Lng: ${data.longitude} (${data.city || 'Unknown'})`);
        } else {
          throw new Error('No coordinates');
        }
      } catch (err) {
        // Ultimate fallback
        setLocation('19.875000', '74.475000', 'GPS unavailable. Using Kopargaon center.');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation(pos.coords.latitude, pos.coords.longitude, `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (GPS precise)`),
        err => fallbackToIP(),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fallbackToIP();
    }
  }

  function setupImageUpload() {
    const zone = document.getElementById('cr-upload-zone');
    const input = document.getElementById('cr-image-input');
    const preview = document.getElementById('cr-image-preview');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file, preview);
    });

    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleFile(file, preview);
    });
  }

  function handleFile(file, preview) {
    if (!file.type.startsWith('image/')) {
      Notifications.error('Invalid file', 'Please upload an image file (JPEG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Notifications.error('File too large', 'Maximum file size is 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      if (preview) {
        preview.innerHTML = `
          <img src="${e.target.result}" style="max-height:120px;border-radius:8px;object-fit:cover">
          <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">
            📎 ${file.name} (${(file.size/1024).toFixed(0)} KB)
          </div>`;
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const species = document.getElementById('cr-species')?.value;
    const lat = document.getElementById('cr-lat')?.value;
    const lng = document.getElementById('cr-lng')?.value;
    const desc = document.getElementById('cr-desc')?.value;

    if (!species) { Notifications.warning('Required field', 'Please select a species.'); return; }
    if (!lat || !lng) { Notifications.warning('Location required', 'Please provide your location.'); return; }
    if (!desc || desc.trim().length < 10) { Notifications.warning('Description too short', 'Please provide at least 10 characters.'); return; }

    try {
      const res = await fetch('http://localhost:3000/api/reports', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + Auth.getToken()
        },
        body: JSON.stringify({ species, lat, lng, desc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');

      const reportId = data.report_id;
      Notifications.success('Report Submitted!', `Report ID: ${reportId} | Status: Pending Verification`, 5000);

      // Reset form
      e.target.reset();
      document.getElementById('cr-image-preview').innerHTML = '';

      // Add to table
      const tbody = document.getElementById('cr-tbody');
      if (tbody) {
        const speciesMap = {};
        allSpecies.forEach(s => { speciesMap[s.species_id] = s; });
        const sp = speciesMap[species];
        
        let actionHtml = '-';
        if (Auth.hasPermission('verify_citizen_reports')) {
          actionHtml = `<button class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="CitizenReports.verifyReport('${reportId}')"><i class="fa fa-check text-green"></i> Verify</button>`;
        }

        const newRow = `<tr id="row-${reportId}" style="background:rgba(34,197,94,0.05)">
          <td style="font-size:10px;color:var(--green-primary)">${reportId}</td>
          <td>${sp ? sp.common_name : species}</td>
          <td>${new Date().toLocaleDateString('en-IN')}</td>
          <td>${desc.slice(0,40)}...</td>
          <td id="status-${reportId}"><span class="badge badge-pending">⏳ Pending</span></td>
          <td>Awaiting admin review</td>
          <td>${actionHtml}</td>
        </tr>`;
        tbody.insertAdjacentHTML('afterbegin', newRow);
      }
    } catch (err) {
      Notifications.error('Submit Failed', err.message);
    }
  }

  async function verifyReport(reportId) {
    if (!Auth.hasPermission('verify_citizen_reports')) {
      Notifications.error('Access Denied', 'Only Administrators can verify citizen reports.');
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:3000/api/reports/${reportId}/verify`, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify');

      const statusCell = document.getElementById(`status-${reportId}`);
      if (statusCell) {
        statusCell.innerHTML = `<span class="badge badge-verified">Verified</span>`;
      }
      const row = document.getElementById(`row-${reportId}`);
      if (row) {
        const actionsCell = row.lastElementChild;
        actionsCell.innerHTML = `<span style="font-size:10px;color:var(--text-dim)">Done</span>`;
      }
      Notifications.success('Report Verified', `Report ${reportId} successfully verified.`);
    } catch (err) {
      Notifications.error('Verification Failed', err.message);
    }
  }

  return { init, handleSubmit, getCurrentLocation, verifyReport };
})();
window.CitizenReports = CitizenReports;

/**
 * conservation.js — Conservation projects page
 */
const ConservationPage = (() => {
  let allProjects = [];
  let filtered = [];
  let activeFilter = 'all';

  async function init() {
    allProjects = await DataLoader.load('conservation_projects.csv');
    filtered = [...allProjects];
    renderStats();
    renderCards();
    setupFilters();
  }

  function renderStats() {
    const total     = allProjects.length;
    const active    = allProjects.filter(p => p.status === 'Active').length;
    const completed = allProjects.filter(p => p.status === 'Completed').length;
    const onHold    = allProjects.filter(p => p.status === 'On Hold').length;

    ['con-total','con-active','con-completed','con-onhold'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) App.animateCounter(el, [total, active, completed, onHold][i]);
    });
  }

  function filterProjects(status) {
    activeFilter = status;
    filtered = status === 'all' ? [...allProjects] : allProjects.filter(p => p.status === status);
    document.querySelectorAll('[data-con-filter]').forEach(c => {
      c.classList.toggle('active', c.dataset.conFilter === status);
    });
    renderCards();
  }

  function formatBudget(budget) {
    const n = parseInt(budget) || 0;
    if (n >= 10000000) return `₹${(n/10000000).toFixed(1)} Cr`;
    if (n >= 100000) return `₹${(n/100000).toFixed(1)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  function getProgress(status) {
    const map = { 'Completed': 100, 'Active': 60, 'On Hold': 30, 'Proposed': 10 };
    return map[status] || 0;
  }

  function renderCards() {
    const grid = document.getElementById('con-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🌳</div><h3>No projects found</h3></div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const progress = getProgress(p.status);
      const statusClass = (p.status||'').toLowerCase().replace(' ', '-');
      return `
        <div class="project-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px">${p.project_name}</div>
              <div style="font-size:11px;color:var(--text-dim)"><i class="fa fa-map-marker-alt"></i> ${p.location}</div>
            </div>
            <span class="project-status ${statusClass}">${p.status}</span>
          </div>
          <div class="grid-2" style="gap:8px;margin-bottom:10px">
            <div style="font-size:10.5px;color:var(--text-dim)"><i class="fa fa-calendar text-green"></i> ${App.formatDate(p.start_date)}</div>
            <div style="font-size:10.5px;color:var(--green-light);font-weight:700">${formatBudget(p.budget_inr)}</div>
            <div style="font-size:10.5px;color:var(--text-dim);grid-column:1/-1"><i class="fa fa-building text-blue"></i> ${p.organization}</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div style="font-size:9px;color:var(--text-dim);margin-top:3px;text-align:right">${progress}% complete</div>
        </div>`;
    }).join('');
  }

  function setupFilters() {
    document.querySelectorAll('[data-con-filter]').forEach(chip => {
      chip.addEventListener('click', () => filterProjects(chip.dataset.conFilter));
    });
  }

  return { init, filterProjects, renderCards, formatBudget };
})();
window.ConservationPage = ConservationPage;

/**
 * education.js — Education hub page
 */
const EducationPage = (() => {
  let allResources = [], allSpecies = [];
  let filtered = [];
  let currentPage = 1;
  const PAGE_SIZE = 20;
  let searchQuery = '';
  let activeCategory = 'all';

  async function init() {
    [allResources, allSpecies] = await Promise.all([
      DataLoader.load('educational_resources.csv'),
      DataLoader.load('species_master.csv'),
    ]);
    const speciesMap = {};
    allSpecies.forEach(s => { speciesMap[s.species_id] = s; });
    // Enrich with species data
    allResources = allResources.map(r => ({
      ...r,
      _species: speciesMap[r.species_id] || null,
    }));
    filtered = [...allResources];
    renderCards();
    setupFilters();
  }

  function filterResources() {
    filtered = allResources.filter(r => {
      const cat = r._species?.category || '';
      const matchCat = activeCategory === 'all' || cat.toLowerCase() === activeCategory.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchQ = !q ||
        (r.title||'').toLowerCase().includes(q) ||
        (r._species?.common_name||'').toLowerCase().includes(q) ||
        (r.description||'').toLowerCase().includes(q);
      return matchCat && matchQ;
    });
    currentPage = 1;
    renderCards();
  }

  function renderCards() {
    const grid = document.getElementById('edu-grid');
    if (!grid) return;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    const countEl = document.getElementById('edu-count');
    if (countEl) countEl.textContent = filtered.length;

    if (page.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📚</div><h3>No resources found</h3><p>Try different search terms</p><button class="btn btn-outline btn-sm" onclick="EducationPage.reset()">Clear Search</button></div>`;
      return;
    }

    grid.innerHTML = page.map(r => {
      const sp = r._species;
      const emoji = App.getCategoryEmoji(sp?.category);
      const iucnBadge = App.getIUCNBadge(r.conservation_status || sp?.iucn_status);
      const desc = (r.description||'').slice(0, 100) + ((r.description||'').length > 100 ? '...' : '');
      return `
        <div class="card" style="padding:14px;cursor:pointer;transition:var(--transition-slow)" onclick="EducationPage.openModal('${r.resource_id}')" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
          <div style="font-size:36px;margin-bottom:8px;text-align:center">${emoji}</div>
          <div style="font-size:12.5px;font-weight:700;color:var(--text-primary);margin-bottom:3px">${r.title}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${desc}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
            ${iucnBadge}
            <span class="badge badge-info">${sp?.category || 'Species'}</span>
          </div>
          ${r.interesting_fact ? `<div style="font-size:10.5px;color:var(--text-muted);border-left:2px solid var(--green-dark);padding-left:7px;font-style:italic">${r.interesting_fact}</div>` : ''}
        </div>`;
    }).join('');

    renderPagination();
  }

  function renderPagination() {
    const c = document.getElementById('edu-pagination');
    if (!c) return;
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    if (total <= 1) { c.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= Math.min(total, 8); i++) {
      html += `<div class="page-btn ${i === currentPage ? 'active' : ''}" onclick="EducationPage.goToPage(${i})">${i}</div>`;
    }
    c.innerHTML = html;
  }

  function goToPage(p) { currentPage = p; renderCards(); }

  function openModal(resourceId) {
    const r = allResources.find(x => x.resource_id === resourceId);
    if (!r) return;
    const sp = r._species;
    const emoji = App.getCategoryEmoji(sp?.category);
    const overlay = document.getElementById('edu-modal-overlay');
    const body = document.getElementById('edu-modal-body');
    if (!overlay || !body) return;
    body.innerHTML = `
      <div style="text-align:center;font-size:56px;margin-bottom:12px">${emoji}</div>
      <h2 style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px">${r.title}</h2>
      <p style="text-align:center;color:var(--text-dim);font-style:italic;font-size:12px;margin-bottom:16px">${sp?.scientific_name||''}</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6">${r.description||''}</p>
      <div class="grid-2" style="gap:10px;margin-bottom:12px">
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:8px">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);margin-bottom:3px">Habitat</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary)">${r.habitat||'N/A'}</div>
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:8px">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);margin-bottom:3px">Conservation Status</div>
          <div style="font-size:12px;font-weight:600">${App.getIUCNBadge(r.conservation_status)}</div>
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:8px">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);margin-bottom:3px">Medicinal Use</div>
          <div style="font-size:12px;color:var(--text-secondary)">${r.medicinal_use||'None documented'}</div>
        </div>
      </div>
      ${r.interesting_fact ? `<div style="padding:12px;background:rgba(34,197,94,0.08);border:1px solid var(--border);border-radius:8px;border-left:3px solid var(--green-primary)"><div style="font-size:10px;font-weight:700;color:var(--green-primary);margin-bottom:4px">💡 INTERESTING FACT</div><div style="font-size:12px;color:var(--text-secondary)">${r.interesting_fact}</div></div>` : ''}
    `;
    overlay.classList.add('visible');
  }

  function setupFilters() {
    const searchEl = document.getElementById('edu-search');
    if (searchEl) searchEl.addEventListener('input', e => { searchQuery = e.target.value; filterResources(); });
    document.querySelectorAll('[data-edu-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-edu-cat]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.eduCat;
        filterResources();
      });
    });
  }

  function reset() { searchQuery = ''; activeCategory = 'all'; document.getElementById('edu-search').value = ''; document.querySelectorAll('[data-edu-cat]').forEach(c => c.classList.remove('active')); document.querySelector('[data-edu-cat="all"]')?.classList.add('active'); filterResources(); }

  return { init, filterResources, renderCards, openModal, goToPage, reset };
})();
window.EducationPage = EducationPage;
