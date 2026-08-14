/**
 * species.js — Species Explorer page module
 */
const SpeciesPage = (() => {
  let allSpecies = [];
  let filtered = [];
  let currentPage = 1;
  const PAGE_SIZE = 24;
  let activeCategory = 'all';
  let activeIUCN = '';
  let searchQuery = '';

  async function init() {
    allSpecies = await DataLoader.load('species_master.csv');
    filtered = [...allSpecies];
    renderStats();
    renderCards();
    setupFilters();
  }

  function renderStats() {
    const total = document.getElementById('sp-total');
    if (total) total.textContent = allSpecies.length.toLocaleString('en-IN');
    const counts = DataLoader.countBy(allSpecies, 'category');
    Object.entries(counts).forEach(([cat, count]) => {
      const el = document.getElementById(`sp-count-${cat.toLowerCase()}`);
      if (el) el.textContent = count;
    });
  }

  function filterSpecies() {
    filtered = allSpecies.filter(s => {
      const matchCat  = activeCategory === 'all' || (s.category||'').toLowerCase() === activeCategory.toLowerCase();
      const matchIUCN = !activeIUCN || s.iucn_status === activeIUCN;
      const q = searchQuery.toLowerCase();
      const matchQ = !q || (s.common_name||'').toLowerCase().includes(q) || (s.scientific_name||'').toLowerCase().includes(q);
      return matchCat && matchIUCN && matchQ;
    });
    currentPage = 1;
    renderCards();
  }

  function renderCards() {
    const grid = document.getElementById('species-grid');
    if (!grid) return;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h3>No species found</h3><p>Try adjusting your filters</p><button class="btn btn-outline" onclick="SpeciesPage.resetFilters()">Clear Filters</button></div>`;
      renderPagination();
      return;
    }

    grid.innerHTML = page.map(s => {
      const emoji = App.getCategoryEmoji(s.category);
      const iucnBadge = App.getIUCNBadge(s.iucn_status);
      const catColor = Analytics.CATEGORY_COLORS[s.category] || '#94a3b8';
      return `
        <div class="species-card" onclick="SpeciesPage.openModal('${s.species_id}')" tabindex="0" role="button" aria-label="${s.common_name}">
          <div class="species-card-img">
            <span style="font-size:52px">${emoji}</span>
          </div>
          <div class="species-card-info">
            <div class="species-card-name">${s.common_name}</div>
            <div class="species-card-sci">${s.scientific_name}</div>
            <div class="species-card-meta">
              ${iucnBadge}
              <span class="badge" style="background:${catColor}20;color:${catColor}">${s.category}</span>
              ${s.endemic==='True' ? '<span class="badge badge-info">Endemic</span>' : ''}
              ${s.medicinal==='True' ? '<span class="badge" style="background:rgba(34,197,94,0.15);color:#4ade80">Medicinal</span>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    renderPagination();

    const countEl = document.getElementById('sp-filtered-count');
    if (countEl) countEl.textContent = filtered.length.toLocaleString('en-IN');
  }

  function renderPagination() {
    const container = document.getElementById('species-pagination');
    if (!container) return;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= Math.min(totalPages, 10); i++) {
      html += `<div class="page-btn ${i === currentPage ? 'active' : ''}" onclick="SpeciesPage.goToPage(${i})">${i}</div>`;
    }
    if (totalPages > 10) html += `<div class="page-btn" style="cursor:default">...</div>`;
    container.innerHTML = html;
  }

  function goToPage(page) {
    currentPage = page;
    renderCards();
    document.getElementById('species-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setupFilters() {
    // Category chips
    document.querySelectorAll('[data-sp-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-sp-cat]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.spCat;
        filterSpecies();
      });
    });

    // Search
    const searchEl = document.getElementById('sp-search');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        searchQuery = e.target.value;
        filterSpecies();
      });
    }

    // IUCN filter
    const iucnEl = document.getElementById('sp-iucn');
    if (iucnEl) {
      iucnEl.addEventListener('change', e => {
        activeIUCN = e.target.value;
        filterSpecies();
      });
    }
  }

  function resetFilters() {
    activeCategory = 'all';
    activeIUCN = '';
    searchQuery = '';
    document.querySelectorAll('[data-sp-cat]').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-sp-cat="all"]')?.classList.add('active');
    const search = document.getElementById('sp-search');
    if (search) search.value = '';
    const iucn = document.getElementById('sp-iucn');
    if (iucn) iucn.value = '';
    filterSpecies();
  }

  function openModal(speciesId) {
    const s = allSpecies.find(sp => sp.species_id === speciesId);
    if (!s) return;

    const modalBody = document.getElementById('sp-modal-body');
    const overlay = document.getElementById('sp-modal-overlay');
    if (!modalBody || !overlay) return;

    const emoji = App.getCategoryEmoji(s.category);
    const iucnBadge = App.getIUCNBadge(s.iucn_status);

    modalBody.innerHTML = `
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px">
        <div style="width:80px;height:80px;background:var(--bg-tertiary);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:42px;flex-shrink:0">${emoji}</div>
        <div>
          <h2 style="font-size:20px;font-weight:800">${s.common_name}</h2>
          <p style="font-style:italic;color:var(--text-dim);margin:4px 0 8px">${s.scientific_name}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${iucnBadge}<span class="badge badge-info">${s.category}</span>${s.endemic==='True'?'<span class="badge badge-info">Endemic</span>':''}</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Taxonomy</div>
      <div class="grid-2" style="gap:8px;margin-bottom:14px">
        ${taxRow('Kingdom', s.kingdom)} ${taxRow('Phylum', s.phylum)}
        ${taxRow('Class', s.class)} ${taxRow('Order', s.order)}
        ${taxRow('Family', s.family)} ${taxRow('Genus', s.genus)}
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Ecology</div>
      <div class="grid-2" style="gap:8px;margin-bottom:14px">
        ${taxRow('Habitat', s.habitat)} ${taxRow('Diet', s.diet)}
        ${taxRow('Lifespan', s.average_lifespan_years ? s.average_lifespan_years+' yrs' : 'N/A')}
        ${taxRow('Breeding Season', s.breeding_season||'N/A')}
        ${taxRow('Nocturnal', s.nocturnal === 'True' ? 'Yes' : 'No')}
        ${taxRow('Pollinator', s.pollinator === 'True' ? 'Yes' : 'No')}
        ${taxRow('Medicinal', s.medicinal === 'True' ? 'Yes' : 'No')}
        ${taxRow('Invasive', s.invasive === 'True' ? 'Yes' : 'No')}
      </div>

      ${s.description ? `
        <div style="padding:10px 12px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid var(--green-primary);font-size:12px;color:var(--text-secondary)">
          ${s.description}
        </div>` : ''}
    `;
    overlay.classList.add('visible');
  }

  function taxRow(label, val) {
    return `<div style="padding:7px 10px;background:var(--bg-tertiary);border-radius:7px"><div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);margin-bottom:2px">${label}</div><div style="font-size:11.5px;font-weight:600;color:var(--text-secondary)">${val||'N/A'}</div></div>`;
  }

  return { init, filterSpecies, renderCards, openModal, goToPage, resetFilters };
})();
window.SpeciesPage = SpeciesPage;

/**
 * observations.js — Observations page module
 */
const ObservationsPage = (() => {
  let allObs = [], allSpecies = [];
  let filtered = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;
  let filters = { category: '', verified: '', search: '' };

  async function init() {
    [allObs, allSpecies] = await Promise.all([
      DataLoader.load('species_observations.csv'),
      DataLoader.load('species_master.csv'),
    ]);
    filtered = [...allObs].sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));
    renderStats();
    renderTable();
    setupFilters();
  }

  function renderStats() {
    const total    = allObs.length;
    const verified = allObs.filter(o => o.verified === 'True' || o.verified === 'true').length;
    const pending  = total - verified;
    const today    = allObs.filter(o => o.observation_date === new Date().toISOString().split('T')[0]).length;

    ['obs-total','obs-verified','obs-pending','obs-today'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) App.animateCounter(el, [total, verified, pending, today][i]);
    });
  }

  function applyFilters() {
    const speciesMap = {};
    allSpecies.forEach(s => { speciesMap[s.species_id] = s; });

    filtered = allObs.filter(o => {
      const sp = speciesMap[o.species_id];
      const matchCat = !filters.category || (sp?.category||'').toLowerCase() === filters.category.toLowerCase();
      const matchVer = !filters.verified || (filters.verified === 'verified' ? (o.verified==='True'||o.verified==='true') : !(o.verified==='True'||o.verified==='true'));
      const q = filters.search.toLowerCase();
      const matchQ = !q || (sp?.common_name||'').toLowerCase().includes(q) || (o.village_id||'').toLowerCase().includes(q);
      return matchCat && matchVer && matchQ;
    }).sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));

    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('obs-tbody');
    if (!tbody) return;
    const speciesMap = {};
    allSpecies.forEach(s => { speciesMap[s.species_id] = s; });

    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-dim)">No observations found. <button class="btn btn-sm btn-outline" onclick="ObservationsPage.resetFilters()">Clear Filters</button></td></tr>`;
      return;
    }

    tbody.innerHTML = page.map(o => {
      const sp = speciesMap[o.species_id];
      const name = sp?.common_name || o.species_id;
      const cat = sp?.category || '';
      const verified = o.verified === 'True' || o.verified === 'true';
      const emoji = App.getCategoryEmoji(cat);
      const health = o.health_status || 'N/A';
      const conf = o.confidence_score ? (parseFloat(o.confidence_score)*100).toFixed(0)+'%' : 'N/A';
      return `
        <tr onclick="ObservationsPage.openModal('${o.observation_id}')" style="cursor:pointer">
          <td style="font-size:10px;color:var(--text-dim)">${o.observation_id}</td>
          <td><span style="margin-right:4px">${emoji}</span>${name}</td>
          <td><span class="badge badge-info">${cat}</span></td>
          <td>${App.formatDate(o.observation_date)}</td>
          <td>${o.observation_time ? o.observation_time.slice(0,5) : 'N/A'}</td>
          <td>${o.village_id || 'N/A'}</td>
          <td>${o.individual_count || 1}</td>
          <td>${health}</td>
          <td><span class="badge badge-${verified ? 'verified' : 'pending'}">${verified ? '✓ Verified' : '⏳ Pending'}</span></td>
        </tr>`;
    }).join('');

    const countEl = document.getElementById('obs-filtered-count');
    if (countEl) countEl.textContent = filtered.length.toLocaleString('en-IN');

    renderPagination();
  }

  function renderPagination() {
    const c = document.getElementById('obs-pagination');
    if (!c) return;
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    if (total <= 1) { c.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= Math.min(total, 8); i++) {
      html += `<div class="page-btn ${i === currentPage ? 'active' : ''}" onclick="ObservationsPage.goToPage(${i})">${i}</div>`;
    }
    c.innerHTML = html;
  }

  function goToPage(page) { currentPage = page; renderTable(); }

  function setupFilters() {
    const catEl = document.getElementById('obs-cat-filter');
    if (catEl) catEl.addEventListener('change', e => { filters.category = e.target.value; applyFilters(); });
    const verEl = document.getElementById('obs-ver-filter');
    if (verEl) verEl.addEventListener('change', e => { filters.verified = e.target.value; applyFilters(); });
    const searchEl = document.getElementById('obs-search');
    if (searchEl) searchEl.addEventListener('input', e => { filters.search = e.target.value; applyFilters(); });
  }

  function resetFilters() {
    filters = { category: '', verified: '', search: '' };
    ['obs-cat-filter','obs-ver-filter','obs-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyFilters();
  }

  async function openModal(obsId) {
    if (!allObs.length) await init();
    const o = allObs.find(x => x.observation_id === obsId);
    if (!o) return;
    // Reuse Dashboard.openObsModal pattern
    const speciesMap = {};
    allSpecies.forEach(s => { speciesMap[s.species_id] = s; });
    const sp = speciesMap[o.species_id];
    const name = sp?.common_name || o.species_id;
    const sci = sp?.scientific_name || '';
    const cat = sp?.category || '';
    const emoji = App.getCategoryEmoji(cat);
    const verified = o.verified === 'True' || o.verified === 'true';

    const modalBody = document.getElementById('obs-modal-body');
    const overlay = document.getElementById('obs-modal-overlay');
    if (!modalBody || !overlay) return;

    modalBody.innerHTML = `
      <div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start">
        <div style="width:70px;height:70px;background:var(--bg-tertiary);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:36px;flex-shrink:0">${emoji}</div>
        <div>
          <h2 style="font-size:16px;font-weight:800">${name}</h2>
          <p style="font-style:italic;color:var(--text-dim);font-size:12px;margin:3px 0 6px">${sci}</p>
          <div style="display:flex;gap:6px">${App.getIUCNBadge(sp?.iucn_status)}<span class="badge badge-${verified?'verified':'pending'}">${verified?'✓ Verified':'⏳ Pending'}</span></div>
        </div>
      </div>
      <div class="grid-2" style="gap:8px">
        ${obsRow('Calendar', 'Date', App.formatDate(o.observation_date))}
        ${obsRow('clock', 'Time', o.observation_time||'N/A')}
        ${obsRow('map-marker-alt', 'Lat/Lng', `${o.latitude}, ${o.longitude}`)}
        ${obsRow('map-marker-alt', 'Village', o.village_id||'N/A')}
        ${obsRow('paw', 'Count', o.individual_count||'N/A')}
        ${obsRow('heartbeat', 'Health', o.health_status||'N/A')}
        ${obsRow('percentage', 'Confidence', o.confidence_score ? (parseFloat(o.confidence_score)*100).toFixed(0)+'%' : 'N/A')}
        ${obsRow('cloud', 'Weather', o.weather||'N/A')}
      </div>
      ${o.notes ? `<div style="margin-top:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid var(--green-primary);font-size:12px;color:var(--text-secondary)">${o.notes}</div>` : ''}
    `;
    overlay.classList.add('visible');
  }

  function obsRow(icon, lbl, val) {
    return `<div style="padding:8px 10px;background:var(--bg-tertiary);border-radius:7px"><div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);margin-bottom:2px"><i class="fa fa-${icon}"></i> ${lbl}</div><div style="font-size:12px;font-weight:600;color:var(--text-secondary)">${val}</div></div>`;
  }

  return { init, applyFilters, renderTable, openModal, goToPage, resetFilters };
})();
window.ObservationsPage = ObservationsPage;
