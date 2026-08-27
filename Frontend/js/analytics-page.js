const AnalyticsPage = (() => {
  const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';

  async function init() {
    try {
      const [stats, monthly, dist, iucn] = await Promise.all([
        fetch(`${API}/dashboard/stats`).then(r=>r.json()),
        fetch(`${API}/analytics/monthly`).then(r=>r.json()),
        fetch(`${API}/analytics/species-distribution`).then(r=>r.json()),
        fetch(`${API}/analytics/iucn-distribution`).then(r=>r.json())
      ]);
      renderStats(stats);
      renderTrendChart(monthly);
      renderCategoryChart(dist);
    } catch(e) {
      console.error('Analytics load failed:', e);
      const [stats, monthly, species] = await Promise.all([
        DataLoader.load('monthly_species_statistics.csv'),
        DataLoader.load('monthly_species_statistics.csv'),
        DataLoader.load('species_master.csv')
      ]);
      renderStatsFallback(stats, species);
      renderTrendChart(monthly);
      renderCategoryChartFallback(species);
    }
  }

  function renderStats(s) {
    if (document.getElementById('a-obs')) App.animateCounter(document.getElementById('a-obs'), s.observations_count||0);
    if (document.getElementById('a-species')) App.animateCounter(document.getElementById('a-species'), s.species_count||0);
    if (document.getElementById('a-reports')) App.animateCounter(document.getElementById('a-reports'), s.reports_count||0);
    if (document.getElementById('a-users')) App.animateCounter(document.getElementById('a-users'), s.users_count||0);
  }

  function renderStatsFallback(statsData, species) {
    let total=0; statsData.forEach(d=>total+=parseInt(d.total_obs||0));
    if (document.getElementById('a-obs')) App.animateCounter(document.getElementById('a-obs'), total);
    if (document.getElementById('a-species')) App.animateCounter(document.getElementById('a-species'), species.length);
  }

  function renderTrendChart(data) {
    const ctx = document.getElementById('monthly-trend-chart');
    if (!ctx || typeof Chart==='undefined') return;
    const sorted = [...data].sort((a,b)=>{
      const da=new Date(a.year,parseInt(a.month)-1);
      const db=new Date(b.year,parseInt(b.month)-1);
      return da-db;
    }).slice(-12);
    const labels = sorted.map(d=>`${d.month}/${(d.year||'').slice(2)}`);
    const values = sorted.map(d=>parseInt(d.total_obs||0));
    new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'Total Observations', data:values, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.1)', fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, scales:{ x:{grid:{color:'rgba(255,255,255,0.05)'}}, y:{grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:true} }, plugins:{legend:{display:false}} }
    });
  }

  function renderCategoryChart(dist) {
    const ctx = document.getElementById('species-category-chart');
    if (!ctx || typeof Chart==='undefined') return;
    const colors=['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f43f5e','#10b981','#f97316','#a78bfa'];
    new Chart(ctx, {
      type:'pie',
      data:{ labels:dist.map(d=>d.category), datasets:[{ data:dist.map(d=>d.count), backgroundColor:colors.slice(0,dist.length), borderWidth:1, borderColor:'#18181b' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'right',labels:{color:'#a1a1aa',font:{size:10}}} } }
    });
  }

  function renderCategoryChartFallback(species) {
    const counts={};
    species.forEach(s=>{const cat=s.category||'Other'; counts[cat]=(counts[cat]||0)+1;});
    renderCategoryChart(Object.entries(counts).map(([k,v])=>({category:k,count:v})));
  }

  return { init };
})();
window.AnalyticsPage = AnalyticsPage;
