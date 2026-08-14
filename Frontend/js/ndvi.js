const NDVIPage = (() => {
  const API = 'http://localhost:3000/api';

  async function init() {
    try {
      const [summary, data] = await Promise.all([
        fetch(`${API}/ndvi/summary`).then(r => r.json()),
        fetch(`${API}/ndvi?limit=500`).then(r => r.json())
      ]);
      renderStats(summary.stats);
      renderPieChart(summary.distribution);
      renderMap(data);
      renderTable(data);
    } catch(e) {
      console.error('NDVI load failed:', e);
      // Fallback to CSV
      const ndviData = await DataLoader.load('ndvi_data.csv');
      renderStatsFallback(ndviData);
      renderPieChartFallback(ndviData);
      renderMap(ndviData);
      renderTable(ndviData);
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    const avgEl = document.getElementById('ndvi-avg');
    const maxEl = document.getElementById('ndvi-max');
    const minEl = document.getElementById('ndvi-min');
    const cntEl = document.getElementById('ndvi-count');
    if (avgEl) avgEl.textContent = parseFloat(stats.avg || 0).toFixed(3);
    if (maxEl) maxEl.textContent = parseFloat(stats.max || 0).toFixed(3);
    if (minEl) minEl.textContent = parseFloat(stats.min || 0).toFixed(3);
    if (cntEl) cntEl.textContent = (stats.count || 0).toLocaleString();
  }

  function renderStatsFallback(data) {
    const vals = data.map(d => parseFloat(d.ndvi_value || d.ndvi || 0));
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    renderStats({ avg, max, min, count: data.length });
  }

  function getHealthColor(health) {
    const h = (health||'').toLowerCase();
    if (h === 'healthy')  return '#22c55e';
    if (h === 'moderate') return '#eab308';
    if (h === 'sparse')   return '#f97316';
    return '#ef4444';
  }

  function renderMap(data) {
    const mapEl = document.getElementById('ndvi-map');
    if (!mapEl || typeof L === 'undefined') return;
    const map = L.map('ndvi-map').setView([19.875, 74.475], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' }).addTo(map);
    data.slice(0, 500).forEach(d => {
      const lat = parseFloat(d.lat || d.latitude);
      const lng = parseFloat(d.lng || d.longitude);
      const health = d.vegetation_health || d.health || 'Moderate';
      if (isNaN(lat) || isNaN(lng)) return;
      L.circleMarker([lat, lng], { radius: 4, fillColor: getHealthColor(health), color: 'transparent', fillOpacity: 0.8 })
        .addTo(map)
        .bindPopup(`<b>NDVI:</b> ${parseFloat(d.ndvi_value||d.ndvi||0).toFixed(3)}<br><b>Health:</b> ${health}`);
    });
  }

  function renderPieChart(distribution) {
    const ctx = document.getElementById('ndvi-pie-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    const labels = (distribution||[]).map(d => d.vegetation_health);
    const values = (distribution||[]).map(d => d.count);
    const colors = labels.map(l => getHealthColor(l));
    new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#a1a1aa' } } } }
    });
  }

  function renderPieChartFallback(data) {
    const counts = {};
    data.forEach(d => { const h = d.vegetation_health||d.health||'Unknown'; counts[h]=(counts[h]||0)+1; });
    renderPieChart(Object.entries(counts).map(([k,v])=>({vegetation_health:k,count:v})));
  }

  function renderTable(data) {
    const tbody = document.getElementById('ndvi-tbody');
    if (!tbody) return;
    tbody.innerHTML = data.slice(0, 20).map(d => {
      const health = d.vegetation_health || d.health || 'N/A';
      const ndvi = parseFloat(d.ndvi_value || d.ndvi || 0).toFixed(3);
      const lat = parseFloat(d.lat || d.latitude || 0).toFixed(4);
      const lng = parseFloat(d.lng || d.longitude || 0).toFixed(4);
      return `<tr>
        <td>${App.formatDate(d.date)}</td>
        <td style="font-size:11px;color:var(--text-dim)">${lat}, ${lng}</td>
        <td style="font-weight:600">${ndvi}</td>
        <td><span class="badge" style="background:${getHealthColor(health)}20;color:${getHealthColor(health)}">${health}</span></td>
      </tr>`;
    }).join('');
  }

  return { init };
})();
window.NDVIPage = NDVIPage;
