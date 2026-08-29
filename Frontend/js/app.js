/**
 * app.js
 * Global application initialization, sidebar navigation, header, search.
 */

const App = (() => {

  // ── Sidebar HTML template ─────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'dashboard',     label: 'Dashboard',           icon: 'fa-th-large',      href: '../index.html',              badge: null },
    { id: 'species',       label: 'Species Explorer',    icon: 'fa-leaf',           href: 'species.html',               badge: null },
    { id: 'observations',  label: 'Observations',        icon: 'fa-binoculars',     href: 'observations.html',          badge: null },
    { id: 'citizen',       label: 'Citizen Reports',     icon: 'fa-file-alt',       href: 'citizen-reports.html',       badge: null },
    { id: 'gismap',        label: 'GIS Map',             icon: 'fa-map-marked-alt', href: 'gis-map.html',               badge: null },
    { id: 'threats',       label: 'Threats',             icon: 'fa-exclamation-triangle', href: 'threats.html',        badge: null },
    { id: 'water',         label: 'Water Bodies',        icon: 'fa-water',          href: 'water-bodies.html',          badge: null },
    { id: 'ndvi',          label: 'NDVI Analytics',      icon: 'fa-seedling',       href: 'ndvi.html',                  badge: null },
    { id: 'conservation',  label: 'Conservation',        icon: 'fa-tree',           href: 'conservation.html',          badge: null },
    { id: 'education',     label: 'Education Hub',       icon: 'fa-graduation-cap', href: 'education.html',             badge: null },
    { id: 'leaderboard',   label: 'Leaderboard',         icon: 'fa-trophy',         href: 'leaderboard.html',           badge: null },
    { id: 'profile',       label: 'Profile',             icon: 'fa-user-circle',    href: 'profile.html',               badge: null },
    { id: 'analytics',     label: 'Analytics',           icon: 'fa-chart-line',     href: 'analytics.html',             badge: null },
    { id: 'recovery',      label: 'Data Resilience',     icon: 'fa-shield-alt',     href: 'blackout-recovery.html',   badge: null },
    { id: 'logout',        label: 'Logout',              icon: 'fa-sign-out-alt',   href: '#',                          badge: null },
  ];

  // Detect current page
  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '');
    if (filename === '' || filename === 'index') return 'dashboard';
    return filename.replace('-', '').toLowerCase();
  }

  // ── Build sidebar ─────────────────────────────────────────────────────
  // Role-based sidebar visibility rules
  // Items listed here are ONLY shown to specified roles.
  // Items not listed are shown to everyone.
  const NAV_ROLE_RULES = {
    // water_admin sees: dashboard, water, gismap, leaderboard, profile, logout
    water_admin:   ['dashboard','water','gismap','leaderboard','profile','logout'],
    // threat_admin sees: dashboard, threats, gismap, leaderboard, profile, logout
    threat_admin:  ['dashboard','threats','gismap','leaderboard','profile','logout'],
    // super_admin + Administrator see everything (no restriction)
    super_admin:   null,
    Administrator: null,
    // All others see everything
    _default:      ['dashboard','species','observations','citizen','gismap','threats','water','ndvi','conservation','education','leaderboard','profile','analytics','logout'],
  };

  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentPage = getCurrentPage();
    const isPages = window.location.pathname.includes('/pages/');
    const user = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
    const role = user?.email === 'admin@kbic.in' ? 'super_admin' : (user?.role || 'Citizen');
    const allowedIds = NAV_ROLE_RULES[role] || NAV_ROLE_RULES['_default']; // null = all allowed

    const navItemsHTML = NAV_ITEMS
      .filter(item => !allowedIds || allowedIds.includes(item.id))
      .map(item => {
        const href = isPages
          ? (item.id === 'dashboard' ? '../index.html' : item.href)
          : (item.id === 'dashboard' ? 'index.html' : 'pages/' + item.href);

        const pageKey = item.href.replace('.html', '').replace('-', '').toLowerCase();
        const isActive = (item.id === 'dashboard' && currentPage === 'dashboard') ||
                         (item.id !== 'dashboard' && currentPage.includes(pageKey.replace('../','').split('/').pop().replace('.html','')));
        const isLogout = item.id === 'logout';

        return `
          <a class="nav-item ${isActive ? 'active' : ''}"
             href="${isLogout ? '#' : href}"
             data-page="${item.id}"
             ${isLogout ? 'id="logout-btn"' : ''}
             title="${item.label}">
            <span class="nav-icon"><i class="fa ${item.icon}"></i></span>
            <span class="nav-label">${item.label}</span>
            ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
          </a>
        `;
      }).join('');

    // Role badge for sidebar
    const roleBadge = (typeof Auth !== 'undefined') ? Auth.getRoleBadgeHTML() : '';

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-icon">🌿</div>
        <div class="logo-text">
          <div class="logo-title">Kopargaon Biodiversity</div>
          <div class="logo-tagline">Explore • Conserve • Protect</div>
          ${roleBadge}
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Navigation</div>
        ${navItemsHTML}
      </nav>
      <div class="sidebar-toggle" id="sidebar-toggle">
        <i class="fa fa-chevron-left" id="sidebar-toggle-icon"></i>
        <span class="nav-label">Collapse</span>
      </div>
    `;

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }

    // Toggle sidebar collapse
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleSidebar);
    }

    // Restore collapsed state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
      document.getElementById('main')?.classList.add('sidebar-collapsed');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) icon.className = 'fa fa-chevron-right';
    }
  }


  let sidebarCollapsed = false;
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main');
    const icon = document.getElementById('sidebar-toggle-icon');
    sidebarCollapsed = !sidebarCollapsed;
    sidebar?.classList.toggle('collapsed', sidebarCollapsed);
    main?.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    if (icon) icon.className = sidebarCollapsed ? 'fa fa-chevron-right' : 'fa fa-chevron-left';
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
  }

  // ── Mobile sidebar toggle ─────────────────────────────────────────────
  function initMobileSidebar() {
    const hamburger = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    if (hamburger) {
      hamburger.addEventListener('click', () => {
        sidebar?.classList.toggle('mobile-open');
        overlay?.classList.toggle('visible');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('mobile-open');
        overlay.classList.remove('visible');
      });
    }
  }

  // ── Header dropdowns ──────────────────────────────────────────────────
  function initHeaderDropdowns() {
    // Notification dropdown toggle
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('visible');
        userDropdown?.classList.remove('visible');
        searchResults?.classList.remove('visible');
      });
    }

    // User dropdown toggle
    const userBtn = document.getElementById('user-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('visible');
        notifDropdown?.classList.remove('visible');
        searchResults?.classList.remove('visible');
      });
    }

    // Close on outside click
    document.addEventListener('click', () => {
      notifDropdown?.classList.remove('visible');
      userDropdown?.classList.remove('visible');
      const sr = document.getElementById('search-results');
      sr?.classList.remove('visible');
    });
  }

  // ── Global Search ────────────────────────────────────────────────────
  let searchData = { species: [], villages: [], observations: [], reports: [] };

  async function initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;

    // Pre-load search data
    const [species, villages, reports] = await Promise.all([
      DataLoader.load('species_master.csv'),
      DataLoader.load('villages.csv'),
      DataLoader.load('citizen_reports.csv'),
    ]);
    searchData.species = species || [];
    searchData.villages = villages || [];
    searchData.reports = reports || [];

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (q.length < 2) {
        searchResults.classList.remove('visible');
        return;
      }
      performSearch(q, searchResults);
    });

    searchInput.addEventListener('click', (e) => { e.stopPropagation(); });

    document.addEventListener('click', () => {
      searchResults.classList.remove('visible');
    });
  }

  function performSearch(q, container) {
    const sp = searchData.species.filter(s =>
      (s.common_name || '').toLowerCase().includes(q) ||
      (s.scientific_name || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const vl = searchData.villages.filter(v =>
      (v.village_name || '').toLowerCase().includes(q)
    ).slice(0, 3);

    if (sp.length === 0 && vl.length === 0) {
      container.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)"><i class="fa fa-search-minus"></i>No results found</div>';
    } else {
      let html = '';
      if (sp.length > 0) {
        html += `<div class="search-result-category"><i class="fa fa-leaf"></i> Species</div>`;
        html += sp.map(s => {
          const isPages = window.location.pathname.includes('/pages/');
          const href = isPages ? `species.html?id=${s.species_id}` : `pages/species.html?id=${s.species_id}`;
          return `
            <a class="search-result-item" href="${href}">
              <i class="fa fa-leaf cat-${(s.category||'').toLowerCase()}"></i>
              <span class="result-name">${s.common_name}</span>
              <span class="result-meta">${s.category || ''}</span>
            </a>`;
        }).join('');
      }
      if (vl.length > 0) {
        html += `<div class="search-result-category"><i class="fa fa-map-marker-alt"></i> Villages</div>`;
        html += vl.map(v => `
          <div class="search-result-item">
            <i class="fa fa-map-marker-alt text-blue"></i>
            <span class="result-name">${v.village_name}</span>
            <span class="result-meta">Village</span>
          </div>`).join('');
      }
      container.innerHTML = html;
    }
    container.classList.add('visible');
  }

  // ── Animate number counter ─────────────────────────────────────────────
  function animateCounter(element, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    const numTarget = parseInt(String(target).replace(/,/g, '')) || 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * numTarget);
      element.textContent = current.toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(update);
      else element.textContent = numTarget.toLocaleString('en-IN');
    }
    requestAnimationFrame(update);
  }

  // ── Format number helper ───────────────────────────────────────────────
  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return n.toLocaleString('en-IN');
    return String(n);
  }

  // ── Format date ────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs>1?'s':''} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days>1?'s':''} ago`;
    return formatDate(dateStr);
  }

  // ── Species emoji map ──────────────────────────────────────────────────
  function getCategoryEmoji(category) {
    const map = {
      'birds': '🐦', 'birds': '🦚',
      'mammals': '🦊', 'reptiles': '🦎',
      'butterflies': '🦋', 'plants': '🌿',
      'amphibians': '🐸', 'insects': '🐛',
      'fish': '🐟', 'others': '🌱'
    };
    return map[(category || '').toLowerCase()] || '🌿';
  }

  // ── IUCN badge ─────────────────────────────────────────────────────────
  function getIUCNBadge(status) {
    const map = {
      'Least Concern':       { cls: 'iucn-lc',  code: 'LC' },
      'Near Threatened':     { cls: 'iucn-nt',  code: 'NT' },
      'Vulnerable':          { cls: 'iucn-vu',  code: 'VU' },
      'Endangered':          { cls: 'iucn-en',  code: 'EN' },
      'Critically Endangered': { cls: 'iucn-cr', code: 'CR' },
      'Extinct in Wild':     { cls: 'iucn-ew',  code: 'EW' },
      'Extinct':             { cls: 'iucn-ex',  code: 'EX' },
    };
    const info = map[status] || { cls: 'iucn-lc', code: status };
    return `<span class="badge ${info.cls}">${info.code}</span>`;
  }

  // ── Header Back Button ────────────────────────────────────────────────
  function initHeaderBackButton() {
    const isPages = window.location.pathname.includes('/pages/');
    if (isPages) {
      const headerLeft = document.querySelector('.header-left');
      if (headerLeft) {
        headerLeft.style.display = 'flex';
        headerLeft.style.alignItems = 'center';
        headerLeft.style.gap = '14px';

        const backBtn = document.createElement('a');
        backBtn.href = '../index.html';
        backBtn.innerHTML = '<i class="fa fa-arrow-left"></i>';
        backBtn.title = 'Back to Dashboard';
        backBtn.style.cssText = `
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          color: var(--text-secondary); text-decoration: none;
          font-size: 14px; transition: background 0.2s, color 0.2s, border-color 0.2s;
        `;
        backBtn.onmouseover = () => { backBtn.style.background = 'var(--green-faint)'; backBtn.style.color = 'var(--green-primary)'; backBtn.style.borderColor = 'var(--green-primary)'; };
        backBtn.onmouseout = () => { backBtn.style.background = 'var(--bg-secondary)'; backBtn.style.color = 'var(--text-secondary)'; backBtn.style.borderColor = 'var(--border)'; };

        const textWrapper = document.createElement('div');
        while (headerLeft.firstChild) {
          textWrapper.appendChild(headerLeft.firstChild);
        }
        
        headerLeft.appendChild(backBtn);
        headerLeft.appendChild(textWrapper);
      }
    }
  }

  // ── Initialize the whole app ───────────────────────────────────────────
  async function init() {
    buildSidebar();
    initMobileSidebar();
    initHeaderDropdowns();
    initHeaderBackButton();
    Auth.init();
    Notifications.init();
    initSearch();
  }

  return {
    init, buildSidebar, animateCounter, formatNumber, formatDate, timeAgo,
    getCategoryEmoji, getIUCNBadge, toggleSidebar
  };
})();

window.App = App;

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
