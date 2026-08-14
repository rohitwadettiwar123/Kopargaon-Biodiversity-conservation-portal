/**
 * dashboard.js
 * KPI cards, recent observations panel, biodiversity health score
 */

const Dashboard = (() => {

  // ── KPI Card configuration ──────────────────────────────────────────────
  const KPI_CONFIG = [
    { id: 'kpi-species',      label: 'Total Species',     sublabel: 'Across Kopargaon Taluka',  icon: 'fa-leaf',                  color: 'green',  csv: 'species_master.csv',       field: null },
    { id: 'kpi-observations', label: 'Total Observations',sublabel: 'All Verified Records',     icon: 'fa-binoculars',            color: 'blue',   csv: 'species_observations.csv', field: null },
    { id: 'kpi-reports',      label: 'Citizen Reports',   sublabel: 'Reports Submitted',        icon: 'fa-file-alt',              color: 'purple', csv: 'citizen_reports.csv',      field: null },
    { id: 'kpi-threats',      label: 'Threats Reported',  sublabel: 'Active & Resolved',        icon: 'fa-exclamation-triangle',  color: 'amber',  csv: 'environmental_threats.csv',field: null },
    { id: 'kpi-users',        label: 'Active Users',      sublabel: 'Community Members',        icon: 'fa-users',                 color: 'cyan',   csv: 'users.csv',                field: null },
  ];

  // ── Render KPI skeleton loaders ────────────────────────────────────────
  function renderKPISkeleton() {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;
    grid.innerHTML = KPI_CONFIG.map((k, i) => `
      <div class="kpi-card ${k.color}">
        <div class="kpi-icon-wrap"><i class="fa ${k.icon}"></i></div>
        <div class="kpi-info">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value skeleton" style="width:80px;height:32px;border-radius:6px">&nbsp;</div>
          <div class="kpi-sublabel skeleton" style="width:140px;height:12px;margin-top:6px;border-radius:4px">&nbsp;</div>
        </div>
      </div>
    `).join('');
  }

  // ── Load and render KPI cards ───────────────────────────────────────────
  async function loadKPIs() {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;

    renderKPISkeleton();

    const [species, obs, reports, threats, users] = await Promise.all([
      DataLoader.load('species_master.csv'),
      DataLoader.load('species_observations.csv'),
      DataLoader.load('citizen_reports.csv'),
      DataLoader.load('environmental_threats.csv'),
      DataLoader.load('users.csv'),
    ]);

    const counts = [
      species.length,
      obs.length,
      reports.length,
      threats.length,
      users.length,
    ];

    grid.innerHTML = KPI_CONFIG.map((k, i) => `
      <div class="kpi-card ${k.color}" title="${k.label}: ${counts[i].toLocaleString('en-IN')}">
        <div class="kpi-icon-wrap"><i class="fa ${k.icon}"></i></div>
        <div class="kpi-info">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" id="${k.id}">0</div>
          <div class="kpi-sublabel">${k.sublabel}</div>
        </div>
      </div>
    `).join('');

    // Animate counters
    KPI_CONFIG.forEach((k, i) => {
      const el = document.getElementById(k.id);
      if (el) App.animateCounter(el, counts[i], 1400);
    });

    return { species, obs, reports, threats, users };
  }

  // ── Recent Observations Panel ──────────────────────────────────────────
  async function loadRecentObservations() {
    const list = document.getElementById('recent-obs-list');
    if (!list) return;

    // Skeleton
    list.innerHTML = Array(5).fill(0).map(() => `
      <div class="obs-mini-card">
        <div class="obs-mini-img skeleton" style="width:44px;height:44px;border-radius:8px"></div>
        <div class="obs-mini-info">
          <div class="skeleton" style="width:100px;height:12px;border-radius:4px;margin-bottom:4px"></div>
          <div class="skeleton" style="width:70px;height:10px;border-radius:4px"></div>
        </div>
      </div>
    `).join('');

    const [obs, species] = await Promise.all([
      DataLoader.load('species_observations.csv'),
      DataLoader.load('species_master.csv'),
    ]);

    // Build species map
    const speciesMap = {};
    (species || []).forEach(s => { speciesMap[s.species_id] = s; });

    // Sort by date descending, take latest 15
    const sorted = (obs || [])
      .filter(o => o.observation_date)
      .sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date))
      .slice(0, 15);

    if (sorted.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔭</div><p>No recent observations</p></div>`;
      return;
    }

    list.innerHTML = sorted.map(obs => {
      const sp = speciesMap[obs.species_id];
      const name = sp ? sp.common_name : obs.species_id;
      const sci  = sp ? sp.scientific_name : '';
      const cat  = sp ? sp.category : 'Others';
      const emoji = App.getCategoryEmoji(cat);
      const verified = obs.verified === 'True' || obs.verified === 'true';
      const timeStr = App.timeAgo(obs.observation_date);
      const village = obs.village_id || '';

      return `
        <div class="obs-mini-card" data-obs-id="${obs.observation_id}" onclick="Dashboard.openObsModal('${obs.observation_id}')">
          <div class="obs-mini-img">${emoji}</div>
          <div class="obs-mini-info">
            <div class="obs-mini-name">${name}</div>
            <div class="obs-mini-sci">${sci}</div>
            <div class="obs-mini-meta">
              <i class="fa fa-map-marker-alt"></i>
              ${village}
              <span style="margin-left:auto">${timeStr}</span>
            </div>
          </div>
          <span class="badge badge-${verified ? 'verified' : 'pending'}">${verified ? '✓' : '⏳'}</span>
        </div>
      `;
    }).join('');
  }

  // ── Observation Detail Modal ───────────────────────────────────────────
  let obsData = null, speciesData = null;

  async function openObsModal(obsId) {
    if (!obsData) {
      [obsData, speciesData] = await Promise.all([
        DataLoader.load('species_observations.csv'),
        DataLoader.load('species_master.csv'),
      ]);
    }

    const obs = obsData.find(o => o.observation_id === obsId);
    if (!obs) return;

    const speciesMap = {};
    (speciesData || []).forEach(s => { speciesMap[s.species_id] = s; });
    const sp = speciesMap[obs.species_id];
    const name = sp ? sp.common_name : obs.species_id;
    const sci = sp ? sp.scientific_name : '';
    const cat = sp ? sp.category : '';
    const iucn = sp ? sp.iucn_status : '';
    const habitat = sp ? sp.habitat : obs.habitat_id || '';
    const emoji = App.getCategoryEmoji(cat);
    const verified = obs.verified === 'True' || obs.verified === 'true';

    const modalOverlay = document.getElementById('obs-modal-overlay');
    const modalBody = document.getElementById('obs-modal-body');

    if (!modalOverlay || !modalBody) return;

    modalBody.innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px;align-items:flex-start">
        <div style="width:80px;height:80px;border-radius:12px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0">${emoji}</div>
        <div>
          <h2 style="font-size:18px;font-weight:800;color:var(--text-white);margin-bottom:4px">${name}</h2>
          <p style="font-style:italic;color:var(--text-dim);font-size:13px;margin-bottom:8px">${sci}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${App.getIUCNBadge(iucn)}
            <span class="badge badge-info">${cat}</span>
            <span class="badge badge-${verified?'verified':'pending'}">${verified?'✓ Verified':'⏳ Pending'}</span>
          </div>
        </div>
      </div>

      <div class="grid-2" style="gap:10px">
        ${infoRow('Calendar', 'Date', App.formatDate(obs.observation_date))}
        ${infoRow('clock', 'Time', obs.observation_time || 'N/A')}
        ${infoRow('map-marker-alt', 'Latitude', obs.latitude || 'N/A')}
        ${infoRow('map-marker-alt', 'Longitude', obs.longitude || 'N/A')}
        ${infoRow('paw', 'Count', obs.individual_count || 'N/A')}
        ${infoRow('heartbeat', 'Health', obs.health_status || 'N/A')}
        ${infoRow('tree', 'Habitat', habitat)}
        ${infoRow('percentage', 'Confidence', obs.confidence_score ? (parseFloat(obs.confidence_score)*100).toFixed(0)+'%' : 'N/A')}
        ${infoRow('cloud', 'Weather', obs.weather || 'N/A')}
        ${infoRow('user', 'Observer', obs.observer_id || 'N/A')}
      </div>

      ${obs.notes ? `
        <div style="margin-top:12px;padding:10px 12px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid var(--green-primary)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Notes</div>
          <div style="font-size:12px;color:var(--text-secondary)">${obs.notes}</div>
        </div>
      ` : ''}
    `;

    modalOverlay.classList.add('visible');
  }

  function infoRow(icon, label, value) {
    return `
      <div style="padding:8px 10px;background:var(--bg-tertiary);border-radius:7px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:3px">
          <i class="fa fa-${icon}"></i> ${label}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary)">${value}</div>
      </div>`;
  }

  // ── Biodiversity Health Score ──────────────────────────────────────────
  async function loadHealthScore() {
    const container = document.getElementById('health-score-container');
    if (!container) return;

    const [species, threats, ndvi] = await Promise.all([
      DataLoader.load('species_master.csv'),
      DataLoader.load('environmental_threats.csv'),
      DataLoader.load('ndvi_data.csv'),
    ]);

    // Calculate score (demo algorithm - clearly labeled)
    const speciesScore = Math.min(100, (species.length / 500) * 100);

    const activeThreats = threats.filter(t => t.resolved !== 'True' && t.resolved !== 'true').length;
    const threatScore = Math.max(0, 100 - (activeThreats / threats.length) * 100);

    const avgNDVI = ndvi.length > 0
      ? ndvi.reduce((s, n) => s + (parseFloat(n.ndvi) || 0), 0) / ndvi.length
      : 0.4;
    const ndviScore = Math.min(100, ((avgNDVI + 0.2) / 1.2) * 100);

    const totalScore = Math.round((speciesScore * 0.4 + threatScore * 0.3 + ndviScore * 0.3));

    const classification = totalScore >= 80 ? 'Excellent' : totalScore >= 60 ? 'Good' : totalScore >= 40 ? 'Fair' : 'Critical';
    const color = totalScore >= 80 ? 'var(--green-primary)' : totalScore >= 60 ? 'var(--accent-cyan)' : totalScore >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)';

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const dashoffset = circumference - (totalScore / 100) * circumference;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px">
        <div style="position:relative;width:120px;height:120px;flex-shrink:0">
          <svg width="120" height="120" style="transform:rotate(-90deg)">
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--bg-tertiary)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${color}" stroke-width="10"
              stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}"
              stroke-linecap="round" style="transition:stroke-dashoffset 1.5s ease"/>
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--text-white)">${totalScore}</div>
            <div style="font-size:9px;color:var(--text-dim)">/100</div>
          </div>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;margin-bottom:4px" style="color:${color}">${classification}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:10px;font-style:italic">Demo analytical indicator</div>
          ${miniBar('Species Diversity', Math.round(speciesScore), 'var(--green-primary)')}
          ${miniBar('Green Cover', Math.round(ndviScore), 'var(--accent-cyan)')}
          ${miniBar('Threat Level', Math.round(100-threatScore), 'var(--accent-amber)', true)}
        </div>
      </div>
    `;
  }

  function miniBar(label, pct, color, inverse = false) {
    const displayPct = inverse ? (100 - pct) : pct;
    return `
      <div style="margin-bottom:5px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-bottom:2px">
          <span>${label}</span><span>${displayPct}%</span>
        </div>
        <div style="height:4px;background:var(--bg-tertiary);border-radius:2px">
          <div style="height:100%;width:${displayPct}%;background:${color};border-radius:2px;transition:width 1s ease"></div>
        </div>
      </div>`;
  }

  // ── Init dashboard ─────────────────────────────────────────────────────
  async function init() {
    await loadKPIs();
    loadRecentObservations();
    loadHealthScore();

    // Modal close handlers
    const closeBtn = document.getElementById('obs-modal-close');
    const overlay = document.getElementById('obs-modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay?.classList.remove('visible'));
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('visible');
    });
  }

  return { init, loadKPIs, loadRecentObservations, openObsModal, loadHealthScore };
})();

window.Dashboard = Dashboard;
