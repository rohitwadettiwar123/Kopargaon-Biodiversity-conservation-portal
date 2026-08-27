/**
 * ai-tracker.js
 * Simulates the Live AI Tracking & Risk Engine pipeline on the frontend.
 * Pipeline: OpenCV -> YOLOv8 -> ByteTrack -> Coordinate Mapping -> Risk Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('live-map');
  if (!mapContainer || typeof L === 'undefined') return;

  // Set boot time
  document.getElementById('boot-time').innerText = new Date().toLocaleTimeString();

  // 1. Initialize Map
  const map = L.map('live-map', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false
  }).setView([19.8885, 74.475], 16);

  // Dark Map Tiles
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  }).addTo(map);

  // 2. Define Zones (Camera FOV and Threat Zone)
  // Camera FOV (Green dashed area)
  const fovCoords = [
    [19.8895, 74.472],
    [19.8898, 74.478],
    [19.8865, 74.479],
    [19.8860, 74.473]
  ];
  L.polygon(fovCoords, {
    color: '#22c55e',
    weight: 1,
    dashArray: '5, 5',
    fillColor: '#22c55e',
    fillOpacity: 0.05
  }).addTo(map).bindTooltip("Cam-04 FOV (Active)", {permanent: true, direction: 'center', className: 'marker-label'}).openTooltip();

  // Highway Threat Zone (Red area)
  const highwayCoords = [
    [19.8875, 74.472],
    [19.8878, 74.478],
    [19.8870, 74.4785],
    [19.8867, 74.4725]
  ];
  const threatZone = L.polygon(highwayCoords, {
    color: '#ef4444',
    weight: 2,
    fillColor: '#ef4444',
    fillOpacity: 0.15
  }).addTo(map);

  // 3. Animal Path and Marker Setup
  // Simulated path of a Leopard moving towards and crossing the highway
  const pathData = [
    [19.8890, 74.4740],
    [19.8888, 74.4743],
    [19.8886, 74.4747],
    [19.8883, 74.4749],
    [19.8879, 74.4752], // Entering threat zone
    [19.8876, 74.4755], // Inside threat zone
    [19.8872, 74.4758], // Crossing
    [19.8868, 74.4760], // Exiting threat zone
    [19.8865, 74.4763],
    [19.8862, 74.4767]
  ];

  // Create custom marker for the animal
  const leopardIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="marker-pin leopard">🐆</div>
      <div class="marker-label">ByteTrack_ID:04<br>P. pardus [98%]</div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 21]
  });

  const animalMarker = L.marker(pathData[0], {icon: leopardIcon}).addTo(map);
  const traceLine = L.polyline([pathData[0]], {color: '#ef4444', weight: 3, opacity: 0.8, dashArray: '4, 6'}).addTo(map);

  // 4. Console Logic
  const feed = document.getElementById('live-alert-feed');
  const pipelineSteps = document.querySelectorAll('.pipeline-step');
  
  function animatePipeline() {
    let currentStep = 0;
    setInterval(() => {
      pipelineSteps.forEach(s => s.classList.remove('active'));
      pipelineSteps[currentStep].classList.add('active');
      currentStep = (currentStep + 1) % pipelineSteps.length;
    }, 400); // Simulate high speed pipeline processing
  }
  animatePipeline();

  function addAlert(type, title, meta) {
    const time = new Date().toLocaleTimeString();
    const card = document.createElement('div');
    card.className = `alert-card ${type}`;
    card.innerHTML = `
      <div class="alert-time">${time}</div>
      <div class="alert-title">${title}</div>
      <div class="alert-meta">${meta}</div>
    `;
    feed.insertBefore(card, feed.firstChild);
    
    // Keep max 5 alerts
    if (feed.children.length > 5) {
      feed.removeChild(feed.lastChild);
    }
  }

  // 5. Simulation Loop
  let currentStep = 0;
  let t = 0;
  
  // Point-in-polygon helper
  function isPointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      let xi = vs[i][0], yi = vs[i][1];
      let xj = vs[j][0], yj = vs[j][1];
      let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  let wasInDanger = false;

  function runSimulation() {
    if (currentStep >= pathData.length - 1) {
      // Loop back after reaching end
      setTimeout(() => {
        currentStep = 0; t = 0;
        animalMarker.setLatLng(pathData[0]);
        traceLine.setLatLngs([pathData[0]]);
        wasInDanger = false;
        addAlert('safe', 'Target Reset', 'Simulating new tracking event.');
        runSimulation();
      }, 5000);
      return;
    }

    const p1 = pathData[currentStep];
    const p2 = pathData[currentStep + 1];
    
    t += 0.02; // Movement speed
    if (t >= 1) {
      t = 0;
      currentStep++;
    }

    // Interpolate position
    const lat = p1[0] + (p2[0] - p1[0]) * t;
    const lng = p1[1] + (p2[1] - p1[1]) * t;
    const currentPos = [lat, lng];

    // Update Map
    animalMarker.setLatLng(currentPos);
    const currentTrace = traceLine.getLatLngs();
    if (t === 0) currentTrace.push(currentPos);
    else currentTrace[currentTrace.length - 1] = currentPos;
    traceLine.setLatLngs(currentTrace);

    // Risk Engine Spatial Check
    const inDanger = isPointInPolygon(currentPos, highwayCoords);
    
    if (inDanger && !wasInDanger) {
      // Just entered threat zone
      threatZone.setStyle({ fillColor: '#ef4444', fillOpacity: 0.4 });
      addAlert('critical', '⚠️ HIGHWAY INCURSION DETECTED', 'Leopard [ID:04] entered Highway crossing zone. Speed: 12km/h.');
      wasInDanger = true;
    } else if (!inDanger && wasInDanger) {
      // Just left threat zone
      threatZone.setStyle({ fillColor: '#ef4444', fillOpacity: 0.15 });
      addAlert('warning', 'Target Cleared Zone', 'Leopard [ID:04] has safely crossed the highway boundary.');
      wasInDanger = false;
    }

    // Occasional tracking updates
    if (t > 0.49 && t < 0.51 && !inDanger) {
      addAlert('safe', 'Tracking Update', `Frame ID: ${Math.floor(Math.random()*10000)} | Confidence: 98%`);
    }

    requestAnimationFrame(runSimulation);
  }

  // Start simulation after a small delay
  setTimeout(() => {
    addAlert('safe', 'YOLOv8 Detection', 'Panthera pardus identified. Assigning ByteTrack ID:04');
    runSimulation();
  }, 2000);

});
