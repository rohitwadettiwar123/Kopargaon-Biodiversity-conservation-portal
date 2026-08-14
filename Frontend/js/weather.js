/**
 * weather.js — Weather card and page module
 */
const WeatherModule = (() => {

  const CONDITIONS = {
    high_rain:   { icon: '🌧️', label: 'Heavy Rain' },
    rain:        { icon: '🌦️', label: 'Rainy' },
    cloudy:      { icon: '☁️', label: 'Cloudy' },
    partly:      { icon: '⛅', label: 'Partly Cloudy' },
    sunny:       { icon: '☀️', label: 'Sunny' },
    hot:         { icon: '🌡️', label: 'Hot & Dry' },
    foggy:       { icon: '🌫️', label: 'Foggy' },
  };

  function getCondition(temp, rain, humidity) {
    if (rain > 20) return CONDITIONS.high_rain;
    if (rain > 5)  return CONDITIONS.rain;
    if (humidity > 85) return CONDITIONS.foggy;
    if (temp > 38) return CONDITIONS.hot;
    if (humidity > 70) return CONDITIONS.cloudy;
    if (humidity > 55) return CONDITIONS.partly;
    return CONDITIONS.sunny;
  }

  async function loadWeatherCard(containerId = 'weather-card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = await DataLoader.load('weather.csv');
    if (!data || data.length === 0) return;

    // Get latest record
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sorted[0];

    const temp = parseFloat(latest.temperature_c).toFixed(1);
    const rain = parseFloat(latest.rainfall_mm).toFixed(1);
    const humidity = parseFloat(latest.humidity_pct).toFixed(0);
    const wind = parseFloat(latest.wind_speed_kmph).toFixed(0);
    const pressure = parseFloat(latest.pressure_hpa).toFixed(0);
    const uv = parseFloat(latest.uv_index).toFixed(0);
    const cond = getCondition(parseFloat(temp), parseFloat(rain), parseFloat(humidity));

    container.innerHTML = `
      <div class="weather-main">
        <div>
          <div class="weather-temp">${temp}°C</div>
          <div class="weather-condition">${cond.label}</div>
        </div>
        <div class="weather-icon">${cond.icon}</div>
      </div>
      <div class="weather-grid">
        <div class="weather-stat">
          <i class="fa fa-tint" style="color:#38bdf8"></i>
          <span class="ws-label">Humidity</span>
          <span class="ws-value">${humidity}%</span>
        </div>
        <div class="weather-stat">
          <i class="fa fa-wind" style="color:#a78bfa"></i>
          <span class="ws-label">Wind</span>
          <span class="ws-value">${wind} km/h</span>
        </div>
        <div class="weather-stat">
          <i class="fa fa-cloud-rain" style="color:#38bdf8"></i>
          <span class="ws-label">Rainfall</span>
          <span class="ws-value">${rain} mm</span>
        </div>
        <div class="weather-stat">
          <i class="fa fa-sun" style="color:#fbbf24"></i>
          <span class="ws-label">UV Index</span>
          <span class="ws-value">${uv}</span>
        </div>
      </div>
      <div class="weather-source">📅 ${App.formatDate(latest.date)} — Dataset-based weather</div>
    `;
  }

  return { loadWeatherCard };
})();
window.WeatherModule = WeatherModule;

/**
 * ndvi.js — NDVI card and analytics
 */
const NDVIModule = (() => {

  async function loadNDVICard(containerId = 'ndvi-card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = await DataLoader.load('ndvi_data.csv');
    if (!data || data.length === 0) return;

    const values = data.map(d => parseFloat(d.ndvi)).filter(v => !isNaN(v));
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const latestDate = data.map(d => d.date).filter(Boolean).sort().pop();

    const healthCounts = DataLoader.countBy(data, 'vegetation_health');
    const total = data.length;

    container.innerHTML = `
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">Latest: ${App.formatDate(latestDate)}</div>
      <div style="display:flex;gap:12px;justify-content:space-around;margin-bottom:10px">
        <div class="ndvi-stat">
          <div class="ndvi-stat-val">${avg.toFixed(3)}</div>
          <div class="ndvi-stat-lbl">Average</div>
        </div>
        <div class="ndvi-stat">
          <div class="ndvi-stat-val" style="color:#38bdf8">${min.toFixed(3)}</div>
          <div class="ndvi-stat-lbl">Min</div>
        </div>
        <div class="ndvi-stat">
          <div class="ndvi-stat-val" style="color:#4ade80">${max.toFixed(3)}</div>
          <div class="ndvi-stat-lbl">Max</div>
        </div>
      </div>
      <div class="ndvi-legend">
        <div class="ndvi-legend-bar"></div>
      </div>
      <div class="ndvi-legend-labels">
        <span>Low</span><span>Sparse</span><span>Moderate</span><span>Healthy</span>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--text-dim)">
        ${Object.entries(healthCounts).map(([k, v]) => `${k}: ${((v/total)*100).toFixed(0)}%`).join(' · ')}
      </div>
    `;
  }

  return { loadNDVICard };
})();
window.NDVIModule = NDVIModule;
