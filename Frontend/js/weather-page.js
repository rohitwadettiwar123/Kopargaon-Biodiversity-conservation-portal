const WeatherPage = (() => {
  const API = 'http://localhost:3000/api';

  async function init() {
    try {
      const [summary, data] = await Promise.all([
        fetch(`${API}/weather/summary`).then(r => r.json()),
        fetch(`${API}/weather?limit=365`).then(r => r.json())
      ]);
      renderStats(summary);
      renderChart(data.reverse()); // oldest first for chart
      renderTable(data.reverse()); // newest first for table
    } catch(e) {
      console.error('Weather load failed:', e);
      const data = await DataLoader.load('weather.csv');
      data.sort((a,b) => new Date(b.date)-new Date(a.date));
      renderStatsFallback(data);
      renderChart([...data].reverse());
      renderTable(data);
    }
  }

  function renderStats(s) {
    const set = (id, val, suffix='') => { const el=document.getElementById(id); if(el) el.textContent=val+suffix; };
    set('w-temp', parseFloat(s.avg_temp_max||0).toFixed(1), '°C');
    set('w-rain', Math.round(s.total_rainfall||0), ' mm');
    set('w-humid', Math.round(s.avg_humidity||0), '%');
    set('w-wind', parseFloat(s.avg_wind_speed||0).toFixed(1), ' km/h');
  }

  function renderStatsFallback(data) {
    const sample = data.slice(0,365);
    let st=0,sr=0,sh=0,sw=0;
    sample.forEach(d => { st+=parseFloat(d.temp_max||0); sr+=parseFloat(d.rainfall||0); sh+=parseFloat(d.humidity||0); sw+=parseFloat(d.wind_speed||0); });
    const n = sample.length||1;
    renderStats({ avg_temp_max: st/n, total_rainfall: sr, avg_humidity: sh/n, avg_wind_speed: sw/n });
  }

  function getConditionIcon(cond) {
    cond = (cond||'').toLowerCase();
    if (cond.includes('rain')) return '<i class="fa fa-cloud-showers-heavy" style="color:#38bdf8"></i>';
    if (cond.includes('cloud')) return '<i class="fa fa-cloud" style="color:#94a3b8"></i>';
    if (cond.includes('clear')||cond.includes('sun')) return '<i class="fa fa-sun" style="color:#fbbf24"></i>';
    return '<i class="fa fa-cloud-sun" style="color:#6b7280"></i>';
  }

  function renderChart(data) {
    const ctx = document.getElementById('weather-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    // Aggregate monthly
    const monthly = {};
    data.forEach(d => {
      const m = (d.date||'').substring(0,7);
      if (!m) return;
      if (!monthly[m]) monthly[m]={tempSum:0,rainSum:0,count:0};
      monthly[m].tempSum += parseFloat(d.temp_max||0);
      monthly[m].rainSum += parseFloat(d.rainfall||0);
      monthly[m].count++;
    });
    const labels = Object.keys(monthly).map(m => { const d=new Date(m+'-01'); return d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}); });
    const temps = Object.values(monthly).map(m => (m.tempSum/m.count).toFixed(1));
    const rains = Object.values(monthly).map(m => m.rainSum.toFixed(0));
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Avg Max Temp (°C)', data: temps, type: 'line', borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.1)', yAxisID:'yTemp', tension:0.4, fill:true },
          { label: 'Total Rainfall (mm)', data: rains, backgroundColor:'rgba(59,130,246,0.6)', yAxisID:'yRain' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{color:'rgba(255,255,255,0.05)'} },
          yTemp: { type:'linear', position:'left', title:{display:true,text:'Temp (°C)',color:'#f59e0b'}, grid:{color:'rgba(255,255,255,0.05)'} },
          yRain: { type:'linear', position:'right', title:{display:true,text:'Rainfall (mm)',color:'#38bdf8'}, grid:{display:false} }
        },
        plugins: { legend:{labels:{color:'#a1a1aa'}} }
      }
    });
  }

  function renderTable(data) {
    const tbody = document.getElementById('weather-tbody');
    if (!tbody) return;
    tbody.innerHTML = data.slice(0,20).map(d => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
        <td style="padding:10px 12px;font-weight:600">${App.formatDate(d.date)}</td>
        <td style="padding:10px 12px">${getConditionIcon(d.condition)} <span style="margin-left:5px;font-size:12px">${d.condition||'N/A'}</span></td>
        <td style="padding:10px 12px;color:#f59e0b;font-weight:600">${d.temp_max||'-'}°C</td>
        <td style="padding:10px 12px;color:#38bdf8">${d.temp_min||'-'}°C</td>
        <td style="padding:10px 12px">${parseFloat(d.rainfall||0)>0?`<span class="badge badge-info">${d.rainfall} mm</span>`:'-'}</td>
        <td style="padding:10px 12px;color:var(--text-dim)">${d.humidity||'-'}%</td>
      </tr>
    `).join('');
  }

  return { init };
})();
window.WeatherPage = WeatherPage;
