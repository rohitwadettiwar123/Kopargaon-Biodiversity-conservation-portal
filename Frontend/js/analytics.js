/**
 * analytics.js
 * All Chart.js charts: observations trend, species by category, IUCN status
 */

const Analytics = (() => {

  // Chart.js defaults for dark theme
  function setChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#86efac';
    Chart.defaults.borderColor = 'rgba(34,197,94,0.12)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
  }

  // Color palettes
  const CATEGORY_COLORS = {
    'Birds':       '#34d399',
    'Plants':      '#4ade80',
    'Insects':     '#f472b6',
    'Mammals':     '#fb923c',
    'Reptiles':    '#a78bfa',
    'Butterflies': '#fbbf24',
    'Amphibians':  '#38bdf8',
    'Fish':        '#06b6d4',
    'Others':      '#94a3b8',
  };

  const IUCN_COLORS = {
    'Least Concern':         '#22c55e',
    'Near Threatened':       '#38bdf8',
    'Vulnerable':            '#fbbf24',
    'Endangered':            '#fb923c',
    'Critically Endangered': '#ef4444',
    'Extinct in Wild':       '#c084fc',
    'Extinct':               '#6b7280',
  };

  // ── Chart instances ─────────────────────────────────────────────────────
  const charts = {};

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  // ── Observations Over Time ─────────────────────────────────────────────
  async function loadObservationsTrendChart(canvasId = 'observations-chart', filter = '1year') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const data = await DataLoader.load('monthly_species_statistics.csv');
    if (!data || data.length === 0) return;

    // Sort by year/month
    const sorted = [...data].sort((a, b) => {
      const da = new Date(a.year, parseInt(a.month) - 1);
      const db = new Date(b.year, parseInt(b.month) - 1);
      return da - db;
    });

    // Filter
    const now = new Date();
    let filtered = sorted;
    if (filter === '6months') filtered = sorted.slice(-6);
    else if (filter === '1year') filtered = sorted.slice(-12);
    else if (filter === '3years') filtered = sorted.slice(-36);
    else if (filter === '5years') filtered = sorted.slice(-60);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = filtered.map(d => `${monthNames[parseInt(d.month)-1]}'${String(d.year).slice(2)}`);
    const totals = filtered.map(d => parseInt(d.total_species) || 0);
    const birds  = filtered.map(d => parseInt(d.bird_species) || 0);
    const plants = filtered.map(d => parseInt(d.plant_species) || 0);

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Species',
            data: totals,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: 'Birds',
            data: birds,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56,189,248,0.05)',
            fill: false,
            tension: 0.4,
            pointRadius: 1,
            borderWidth: 1.5,
            borderDash: [],
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { boxWidth: 10, padding: 10, color: '#86efac', font: { size: 10 } }
          },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, maxRotation: 0, color: '#6b7280', font: { size: 9 } },
            grid: { color: 'rgba(34,197,94,0.06)' }
          },
          y: {
            ticks: { color: '#6b7280', font: { size: 9 } },
            grid: { color: 'rgba(34,197,94,0.06)' },
            beginAtZero: false
          }
        }
      }
    });
  }

  // ── Species by Category Donut ───────────────────────────────────────────
  async function loadSpeciesCategoryChart(canvasId = 'species-category-chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const data = await DataLoader.load('species_master.csv');
    if (!data || data.length === 0) return;

    const counts = DataLoader.countBy(data, 'category');
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const bgColors = labels.map(l => CATEGORY_COLORS[l] || '#94a3b8');

    const total = values.reduce((s, v) => s + v, 0);

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: 'var(--bg-primary)',
          borderWidth: 2,
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw/total)*100).toFixed(0)}%)`
            }
          }
        }
      }
    });

    // Render custom legend
    const legendEl = document.getElementById('species-category-legend');
    if (legendEl) {
      legendEl.innerHTML = labels.slice(0, 6).map((l, i) => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${bgColors[i]}"></div>
          <span>${l}</span>
          <span class="legend-pct">${((values[i]/total)*100).toFixed(0)}%</span>
        </div>
      `).join('');
    }

    // Center total
    const centerEl = document.getElementById('species-category-total');
    if (centerEl) centerEl.textContent = total.toLocaleString('en-IN');

    return { total, counts };
  }

  // ── IUCN Status Donut ──────────────────────────────────────────────────
  async function loadIUCNChart(canvasId = 'iucn-chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const data = await DataLoader.load('species_master.csv');
    if (!data || data.length === 0) return;

    const counts = DataLoader.countBy(data, 'iucn_status');
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const bgColors = labels.map(l => IUCN_COLORS[l] || '#94a3b8');

    const total = values.reduce((s, v) => s + v, 0);

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: 'var(--bg-primary)',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw/total)*100).toFixed(0)}%)`
            }
          }
        }
      }
    });

    // Legend
    const legendEl = document.getElementById('iucn-legend');
    if (legendEl) {
      legendEl.innerHTML = labels.slice(0, 5).map((l, i) => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${bgColors[i]}"></div>
          <span class="truncate" title="${l}">${l}</span>
          <span class="legend-pct">${((values[i]/total)*100).toFixed(0)}%</span>
        </div>
      `).join('');
    }

    const centerEl = document.getElementById('iucn-total');
    if (centerEl) centerEl.textContent = total.toLocaleString('en-IN');
  }

  // ── Species Bar Chart (top 15) ─────────────────────────────────────────
  async function loadTopSpeciesChart(canvasId = 'top-species-chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const [obs, species] = await Promise.all([
      DataLoader.load('species_observations.csv'),
      DataLoader.load('species_master.csv'),
    ]);

    const speciesMap = {};
    (species || []).forEach(s => { speciesMap[s.species_id] = s; });

    const counts = DataLoader.countBy(obs || [], 'species_id');
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const labels = sorted.map(([id]) => speciesMap[id]?.common_name || id);
    const values = sorted.map(([, count]) => count);

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => `hsl(${140 + i * 15}, 60%, ${40 + i * 1}%)`),
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: 'rgba(34,197,94,0.06)' } },
          y: { ticks: { color: '#86efac', font: { size: 9 } }, grid: { display: false } }
        }
      }
    });
  }

  // ── Threats Pie Chart ──────────────────────────────────────────────────
  async function loadThreatsChart(canvasId = 'threats-chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const data = await DataLoader.load('environmental_threats.csv');
    if (!data || data.length === 0) return;

    const counts = DataLoader.countBy(data, 'threat_type');
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const colors = ['#ef4444','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#f97316','#22c55e','#ec4899'];

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: 'var(--bg-primary)',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 10, padding: 8, color: '#86efac', font: { size: 9.5 } }
          }
        }
      }
    });
  }

  // ── Monthly Observations Trend (with filters) ──────────────────────────
  function initTrendFilters(canvasId) {
    const filtersContainer = document.querySelector(`[data-chart="${canvasId}"] .chart-filters`);
    if (!filtersContainer) return;

    filtersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.chart-filter-btn');
      if (!btn) return;
      filtersContainer.querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      loadObservationsTrendChart(canvasId, filter);
    });
  }

  // ── NDVI Trend Chart ───────────────────────────────────────────────────
  async function loadNDVITrendChart(canvasId = 'ndvi-trend-chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const data = await DataLoader.load('ndvi_data.csv');
    if (!data || data.length === 0) return;

    // Group by month-year and avg ndvi
    const grouped = {};
    data.forEach(d => {
      const dt = new Date(d.date);
      if (isNaN(dt)) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(parseFloat(d.ndvi) || 0);
    });

    const sortedKeys = Object.keys(grouped).sort().slice(-18);
    const labels = sortedKeys.map(k => {
      const [y, m] = k.split('-');
      const mn = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)];
      return `${mn}'${y.slice(2)}`;
    });
    const values = sortedKeys.map(k => {
      const arr = grouped[k];
      return +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(3);
    });

    destroyChart(canvasId);
    charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Avg NDVI',
          data: values,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74,222,128,0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, color: '#6b7280', font: { size: 9 } }, grid: { display: false } },
          y: {
            ticks: { color: '#6b7280', font: { size: 9 } },
            grid: { color: 'rgba(34,197,94,0.06)' },
            min: -0.2, max: 0.8
          }
        }
      }
    });
  }

  // ── Init all dashboard charts ──────────────────────────────────────────
  async function init() {
    setChartDefaults();
    await Promise.all([
      loadObservationsTrendChart('observations-chart', '1year'),
      loadSpeciesCategoryChart('species-category-chart'),
      loadIUCNChart('iucn-chart'),
    ]);
    initTrendFilters('observations-chart');
  }

  return {
    init, setChartDefaults,
    loadObservationsTrendChart,
    loadSpeciesCategoryChart,
    loadIUCNChart,
    loadTopSpeciesChart,
    loadThreatsChart,
    loadNDVITrendChart,
    destroyChart,
    CATEGORY_COLORS,
    IUCN_COLORS,
  };
})();

window.Analytics = Analytics;
