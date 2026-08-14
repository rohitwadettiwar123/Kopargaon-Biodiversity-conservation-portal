/**
 * gis-map.js
 * Leaflet.js interactive map with all layers, popups, heatmaps, clustering
 */

const GISMap = (() => {

  let map = null;
  let layers = {};
  let layerControl = null;
  const KOPARGAON_CENTER = [19.875, 74.475];
  const DEFAULT_ZOOM = 11;

  // ── Category marker colors ─────────────────────────────────────────────
  const CATEGORY_COLORS = {
    'Birds':       '#34d399',
    'Mammals':     '#fb923c',
    'Reptiles':    '#a78bfa',
    'Butterflies': '#fbbf24',
    'Plants':      '#4ade80',
    'Amphibians':  '#38bdf8',
    'Insects':     '#f472b6',
    'Fish':        '#06b6d4',
    'Others':      '#94a3b8',
  };

  // ── Create custom marker icon ──────────────────────────────────────────
  function createMarkerIcon(color, size = 10, symbol = '●') {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px; height:${size}px;
        background:${color};
        border:2px solid rgba(255,255,255,0.5);
        border-radius:50%;
        box-shadow:0 0 6px ${color}80;
        cursor:pointer;
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
  }

  function createHotspotIcon(priority) {
    const colors = { Critical: '#ef4444', High: '#f59e0b', Medium: '#38bdf8', Low: '#22c55e' };
    const color = colors[priority] || '#fbbf24';
    return L.divIcon({
      className: '',
      html: `<div style="
        width:16px; height:16px;
        background:${color};
        border:3px solid rgba(255,255,255,0.8);
        border-radius:50%;
        box-shadow:0 0 10px ${color};
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }

  function createWaterIcon() {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:12px; height:12px;
        background:#38bdf8;
        border:2px solid rgba(255,255,255,0.7);
        border-radius:50%;
        box-shadow:0 0 8px #38bdf880;
      "></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      popupAnchor: [0, -6],
    });
  }

  function createThreatIcon(severity) {
    const colors = { Critical: '#ef4444', High: '#f59e0b', Moderate: '#3b82f6', Low: '#22c55e' };
    const color = colors[severity] || '#f59e0b';
    return L.divIcon({
      className: '',
      html: `<div style="
        width:14px; height:14px;
        background:${color};
        clip-path:polygon(50% 0%, 0% 100%, 100% 100%);
        box-shadow:0 0 6px ${color}80;
        filter: drop-shadow(0 0 4px ${color});
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 14],
      popupAnchor: [0, -14],
    });
  }

  // ── Initialize Leaflet map ─────────────────────────────────────────────
  function initMap(containerId = 'dashboard-map', zoom = DEFAULT_ZOOM) {
    if (map) { map.remove(); map = null; }
    const container = document.getElementById(containerId);
    if (!container) return null;

    map = L.map(containerId, {
      center: KOPARGAON_CENTER,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Satellite/terrain tiles
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery',
        maxZoom: 18,
      }
    );

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenTopoMap',
      maxZoom: 17,
    });

    satelliteLayer.addTo(map);

    // Base layer control
    const baseLayers = {
      '🛰️ Satellite': satelliteLayer,
      '🗺️ Street Map': osmLayer,
      '⛰️ Topo Map': topoLayer,
    };
    layers.baseLayers = baseLayers;

    return map;
  }

  // ── Load observation markers ───────────────────────────────────────────
  async function loadObservationLayer(limit = 500) {
    if (!map) return;

    const [obs, species] = await Promise.all([
      DataLoader.load('species_observations.csv'),
      DataLoader.load('species_master.csv'),
    ]);

    const speciesMap = {};
    (species || []).forEach(s => { speciesMap[s.species_id] = s; });

    const sample = (obs || [])
      .filter(o => parseFloat(o.latitude) && parseFloat(o.longitude))
      .slice(0, limit);

    // Create marker cluster group if available
    const clusterGroup = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true })
      : L.layerGroup();

    sample.forEach(o => {
      const sp = speciesMap[o.species_id];
      const cat = sp?.category || 'Others';
      const color = CATEGORY_COLORS[cat] || '#94a3b8';
      const icon = createMarkerIcon(color);

      const lat = parseFloat(o.latitude);
      const lng = parseFloat(o.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const verified = o.verified === 'True' || o.verified === 'true';
      const marker = L.marker([lat, lng], { icon });

      const popupContent = `
        <div class="map-popup">
          <div class="popup-title">${sp?.common_name || o.species_id}</div>
          <div class="popup-sci">${sp?.scientific_name || ''}</div>
          <div class="popup-row"><i class="fa fa-tag" style="color:${color}"></i> ${cat}</div>
          <div class="popup-row"><i class="fa fa-calendar" style="color:#86efac"></i> ${App.formatDate(o.observation_date)}</div>
          <div class="popup-row"><i class="fa fa-map-marker-alt" style="color:#38bdf8"></i> ${o.village_id || 'N/A'}</div>
          <div class="popup-row"><i class="fa fa-users" style="color:#a78bfa"></i> ${o.individual_count || 1} individual(s)</div>
          <div class="popup-row" style="margin-top:6px">
            <span class="badge ${verified ? 'badge-verified' : 'badge-pending'} popup-badge">
              ${verified ? '✓ Verified' : '⏳ Pending'}
            </span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 220 });
      clusterGroup.addLayer(marker);
    });

    layers.observations = clusterGroup;
    clusterGroup.addTo(map);
    return clusterGroup;
  }

  // ── Load biodiversity hotspots ─────────────────────────────────────────
  async function loadHotspotsLayer() {
    if (!map) return;

    const data = await DataLoader.load('biodiversity_hotspots.csv');
    const layerGroup = L.layerGroup();

    (data || []).forEach(hs => {
      const lat = parseFloat(hs.latitude);
      const lng = parseFloat(hs.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = createHotspotIcon(hs.conservation_priority);
      const marker = L.marker([lat, lng], { icon });

      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">🔥 ${hs.hotspot_name}</div>
          <div class="popup-row"><i class="fa fa-leaf"></i> ${hs.species_count || '?'} species</div>
          <div class="popup-row"><i class="fa fa-exclamation-triangle" style="color:#fbbf24"></i> ${hs.conservation_priority || 'Unknown'} priority</div>
          <div class="popup-row"><i class="fa fa-chart-line"></i> Index: ${hs.biodiversity_index || 'N/A'}</div>
          <div class="popup-row"><span style="color:#ef4444">🛑 ${hs.endangered_species || 0} endangered</span></div>
        </div>
      `, { maxWidth: 220 });

      // Add pulsing circle
      L.circle([lat, lng], {
        radius: 800,
        color: '#fbbf24',
        fillColor: '#fbbf24',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4,4',
      }).addTo(map);

      layerGroup.addLayer(marker);
    });

    layers.hotspots = layerGroup;
    return layerGroup;
  }

  // ── Load water bodies ──────────────────────────────────────────────────
  async function loadWaterBodiesLayer() {
    if (!map) return;

    const data = await DataLoader.load('water_bodies.csv');
    const layerGroup = L.layerGroup();

    (data || []).forEach(wb => {
      const lat = parseFloat(wb.latitude);
      const lng = parseFloat(wb.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const marker = L.marker([lat, lng], { icon: createWaterIcon() });
      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">💧 ${wb.name}</div>
          <div class="popup-row"><i class="fa fa-water"></i> ${wb.type}</div>
          <div class="popup-row"><i class="fa fa-ruler-combined"></i> ${wb.area_sqkm} km²</div>
          <div class="popup-row"><i class="fa fa-tint"></i> Quality: ${wb.water_quality}</div>
          <div class="popup-row"><i class="fa fa-fish"></i> Fish: ${wb.fish_species_count} species</div>
        </div>
      `, { maxWidth: 220 });

      layerGroup.addLayer(marker);
    });

    layers.waterBodies = layerGroup;
    return layerGroup;
  }

  // ── Load threats layer ─────────────────────────────────────────────────
  async function loadThreatsLayer() {
    if (!map) return;

    const data = await DataLoader.load('environmental_threats.csv');
    const layerGroup = L.layerGroup();

    (data || []).filter(t => t.resolved !== 'True' && t.resolved !== 'true').forEach(th => {
      const lat = parseFloat(th.latitude);
      const lng = parseFloat(th.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = createThreatIcon(th.severity);
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">⚠️ ${th.threat_type}</div>
          <div class="popup-row" style="color:#fbbf24"><i class="fa fa-exclamation-triangle"></i> ${th.severity} Severity</div>
          <div class="popup-row"><i class="fa fa-calendar"></i> ${App.formatDate(th.date)}</div>
          <div class="popup-row"><i class="fa fa-info-circle"></i> ${th.description || ''}</div>
        </div>
      `, { maxWidth: 220 });

      layerGroup.addLayer(marker);
    });

    layers.threats = layerGroup;
    return layerGroup;
  }

  // ── Load villages layer ────────────────────────────────────────────────
  async function loadVillagesLayer() {
    if (!map) return;

    const data = await DataLoader.load('villages.csv');
    const layerGroup = L.layerGroup();

    (data || []).forEach(v => {
      const lat = parseFloat(v.latitude);
      const lng = parseFloat(v.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#475569;width:8px;height:8px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.5)"></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      const marker = L.marker([lat, lng], { icon });
      marker.bindTooltip(v.village_name, { permanent: false, direction: 'top', className: '' });
      marker.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">🏘️ ${v.village_name}</div>
          <div class="popup-row"><i class="fa fa-users"></i> Pop: ${parseInt(v.population).toLocaleString('en-IN')}</div>
          <div class="popup-row"><i class="fa fa-tree"></i> Forest: ${v.forest_area_ha} ha</div>
          <div class="popup-row"><i class="fa fa-star"></i> Bio Score: ${parseFloat(v.biodiversity_score).toFixed(1)}</div>
        </div>
      `, { maxWidth: 200 });

      // Village name label
      L.marker([lat, lng + 0.005], {
        icon: L.divIcon({
          className: '',
          html: `<span style="color:#94a3b8;font-size:9px;white-space:nowrap;font-family:Inter,sans-serif;font-weight:600;text-shadow:0 1px 2px #000">${v.village_name}</span>`,
          iconAnchor: [0, 4],
        })
      }).addTo(map);

      layerGroup.addLayer(marker);
    });

    layers.villages = layerGroup;
    return layerGroup;
  }

  // ── Load protected areas ───────────────────────────────────────────────
  async function loadProtectedAreasLayer() {
    if (!map) return;

    const data = await DataLoader.load('protected_areas.csv');
    const layerGroup = L.layerGroup();

    (data || []).forEach(pa => {
      const lat = parseFloat(pa.latitude);
      const lng = parseFloat(pa.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const circle = L.circle([lat, lng], {
        radius: Math.sqrt(parseFloat(pa.area_sqkm) || 1) * 500,
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: '5,5',
      });

      circle.bindPopup(`
        <div class="map-popup">
          <div class="popup-title">🌿 ${pa.name}</div>
          <div class="popup-row"><i class="fa fa-shield-alt"></i> ${pa.type}</div>
          <div class="popup-row"><i class="fa fa-ruler-combined"></i> ${parseFloat(pa.area_sqkm).toFixed(2)} km²</div>
          <div class="popup-row"><i class="fa fa-calendar"></i> Est. ${pa.established_year}</div>
          <div class="popup-row"><i class="fa fa-building"></i> ${pa.managing_authority || ''}</div>
        </div>
      `, { maxWidth: 240 });

      layerGroup.addLayer(circle);
    });

    layers.protectedAreas = layerGroup;
    return layerGroup;
  }

  // ── Load all layers and set up control ────────────────────────────────
  async function loadAllLayers() {
    if (!map) return;

    Notifications.info('Loading map layers...', '', 2000);

    const [obsLayer, hotLayer, waterLayer, threatLayer, villageLayer, protLayer] = await Promise.all([
      loadObservationLayer(500),
      loadHotspotsLayer(),
      loadWaterBodiesLayer(),
      loadThreatsLayer(),
      loadVillagesLayer(),
      loadProtectedAreasLayer(),
    ]);

    // Overlay layers for control
    const overlayLayers = {};
    if (obsLayer)    overlayLayers['<span style="color:#34d399">⬤</span> Observations']    = obsLayer;
    if (hotLayer)    overlayLayers['<span style="color:#fbbf24">⬤</span> Hotspots']        = hotLayer;
    if (waterLayer)  overlayLayers['<span style="color:#38bdf8">⬤</span> Water Bodies']    = waterLayer;
    if (threatLayer) overlayLayers['<span style="color:#ef4444">⬤</span> Threats']         = threatLayer;
    if (villageLayer) overlayLayers['<span style="color:#94a3b8">⬤</span> Villages']        = villageLayer;
    if (protLayer)   overlayLayers['<span style="color:#22c55e">◯</span> Protected Areas'] = protLayer;

    // Add default layers
    if (hotLayer) hotLayer.addTo(map);
    if (waterLayer) waterLayer.addTo(map);
    if (villageLayer) villageLayer.addTo(map);
    if (protLayer) protLayer.addTo(map);

    // Layer control
    if (layerControl) layerControl.remove();
    layerControl = L.control.layers(layers.baseLayers || {}, overlayLayers, {
      position: 'topright',
      collapsed: false,
    }).addTo(map);

    Notifications.success('Map loaded!', 'All biodiversity layers are ready.', 2500);
  }

  // ── Add Kopargaon boundary outline ────────────────────────────────────
  function addBoundaryOutline() {
    if (!map) return;
    // Approximate bounding box for Kopargaon Taluka
    const bounds = [[19.78, 74.33], [19.78, 74.59], [19.97, 74.59], [19.97, 74.33], [19.78, 74.33]];
    L.polyline(bounds, {
      color: 'rgba(34,197,94,0.5)',
      weight: 2,
      dashArray: '8,4',
    }).addTo(map).bindPopup('<b>Kopargaon Taluka Boundary</b>');
  }

  // ── Toggle fullscreen ─────────────────────────────────────────────────
  function toggleFullscreen(containerId) {
    const el = document.getElementById(containerId)?.closest('.map-card');
    if (!el) return;
    el.classList.toggle('fullscreen-map');
    if (map) setTimeout(() => map.invalidateSize(), 100);
  }

  // ── Init dashboard map ─────────────────────────────────────────────────
  async function initDashboardMap() {
    if (typeof L === 'undefined') {
      console.warn('[GISMap] Leaflet not loaded');
      return;
    }

    initMap('dashboard-map', 11);
    addBoundaryOutline();
    await loadAllLayers();

    // Full map link button
    const fullMapBtn = document.getElementById('view-full-map-btn');
    if (fullMapBtn) {
      const isPages = window.location.pathname.includes('/pages/');
      fullMapBtn.href = isPages ? 'gis-map.html' : 'pages/gis-map.html';
    }
  }

  // ── Export ────────────────────────────────────────────────────────────
  return {
    initMap, initDashboardMap, loadAllLayers,
    loadObservationLayer, loadHotspotsLayer, loadWaterBodiesLayer,
    loadThreatsLayer, loadVillagesLayer, loadProtectedAreasLayer,
    toggleFullscreen, addBoundaryOutline,
    getMap: () => map,
    getLayers: () => layers,
    CATEGORY_COLORS
  };
})();

window.GISMap = GISMap;
