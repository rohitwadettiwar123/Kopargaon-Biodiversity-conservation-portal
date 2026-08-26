/**
 * data-loader.js
 * Centralized CSV data loading, parsing, caching, and validation.
 * All modules import data through this layer.
 */

const DataLoader = (() => {
  // ── Cache ────────────────────────────────────────────────────────────────
  const cache = {};
  const DATA_BASE = '../data/';

  // ── Determine base path based on current page location ─────────────────
  function getBasePath() {
    return 'http://localhost:3000/api/data/';
  }

  // ── Parse CSV Text → Array of Objects ─────────────────────────────────
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = parseCSVRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVRow(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
      });
      rows.push(obj);
    }
    return rows;
  }

  // Handles quoted fields with commas
  function parseCSVRow(line) {
    const result = [];
    let curr = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { curr += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(curr);
        curr = '';
      } else {
        curr += ch;
      }
    }
    result.push(curr);
    return result;
  }

  // ── Load a CSV file ─────────────────────────────────────────────────────
  async function load(filename) {
    if (cache[filename]) return cache[filename];

    const tableName = filename.replace('.csv', '');
    const url = getBasePath() + tableName;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${filename}`);
      const data = await response.json(); // API returns JSON array of objects
      cache[filename] = data;
      console.log(`[DataLoader] Loaded ${filename} via API: ${data.length} rows`);
      return data;
    } catch (err) {
      console.warn(`[DataLoader] Could not load ${filename}: ${err.message}`);
      return getFallback(filename);
    }
  }

  // ── Load multiple CSVs in parallel ─────────────────────────────────────
  async function loadAll(filenames) {
    const results = await Promise.allSettled(filenames.map(f => load(f)));
    const out = {};
    filenames.forEach((f, i) => {
      out[f] = results[i].status === 'fulfilled' ? results[i].value : getFallback(f);
    });
    return out;
  }

  // ── Fallback demo data if CSV unavailable ────────────────────────────────
  function getFallback(filename) {
    const fallbacks = {
      'species_master.csv': generateSpeciesFallback(),
      'species_observations.csv': generateObservationsFallback(),
      'citizen_reports.csv': generateCitizenReportsFallback(),
      'environmental_threats.csv': generateThreatsFallback(),
      'users.csv': generateUsersFallback(),
      'monthly_species_statistics.csv': generateMonthlyStatsFallback(),
      'water_bodies.csv': generateWaterBodiesFallback(),
      'conservation_projects.csv': generateConservationFallback(),
      'villages.csv': generateVillagesFallback(),
      'biodiversity_hotspots.csv': generateHotspotsFallback(),
      'ndvi_data.csv': generateNDVIFallback(),
      'habitats.csv': generateHabitatsFallback(),
      'protected_areas.csv': generateProtectedAreasFallback(),
      'educational_resources.csv': generateEducationFallback(),
    };
    return fallbacks[filename] || [];
  }

  // ── Fallback Data Generators ─────────────────────────────────────────────
  function generateSpeciesFallback() {
    const categories = ['Birds', 'Mammals', 'Reptiles', 'Butterflies', 'Plants', 'Amphibians', 'Insects', 'Fish'];
    const iucnStatuses = ['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered'];
    const species = [
      { id: 'SP0001', common: 'Indian Peafowl', sci: 'Pavo cristatus', cat: 'Birds', iucn: 'Least Concern', habitat: 'Grassland' },
      { id: 'SP0002', common: 'Common Myna', sci: 'Acridotheres tristis', cat: 'Birds', iucn: 'Least Concern', habitat: 'Urban Garden' },
      { id: 'SP0003', common: 'Indian Robin', sci: 'Saxicoloides fulicatus', cat: 'Birds', iucn: 'Least Concern', habitat: 'Scrubland' },
      { id: 'SP0004', common: 'Plain Tiger', sci: 'Danaus chrysippus', cat: 'Butterflies', iucn: 'Least Concern', habitat: 'Grassland' },
      { id: 'SP0005', common: 'Indian Palm Squirrel', sci: 'Funambulus palmarum', cat: 'Mammals', iucn: 'Least Concern', habitat: 'Urban Garden' },
      { id: 'SP0006', common: 'Monitor Lizard', sci: 'Varanus bengalensis', cat: 'Reptiles', iucn: 'Near Threatened', habitat: 'Scrubland' },
      { id: 'SP0007', common: 'Neem Tree', sci: 'Azadirachta indica', cat: 'Plants', iucn: 'Least Concern', habitat: 'Urban Garden' },
      { id: 'SP0008', common: 'Indian Bullfrog', sci: 'Hoplobatrachus tigerinus', cat: 'Amphibians', iucn: 'Least Concern', habitat: 'Wetland' },
    ];
    return species.map(s => ({
      species_id: s.id, common_name: s.common, scientific_name: s.sci,
      category: s.cat, iucn_status: s.iucn, habitat: s.habitat,
      endemic: 'False', invasive: 'False', medicinal: 'False', pollinator: 'False',
      description: `${s.common} is a species found in the Kopargaon region.`,
      image_filename: `${s.id}_demo.jpg`, conservation_status: 'Stable'
    }));
  }

  function generateObservationsFallback() {
    const obs = [];
    const lat_base = 19.87, lng_base = 74.47;
    for (let i = 1; i <= 100; i++) {
      obs.push({
        observation_id: `OBS${String(i).padStart(6,'0')}`,
        species_id: `SP${String(Math.floor(Math.random()*8)+1).padStart(4,'0')}`,
        latitude: (lat_base + (Math.random()-0.5)*0.15).toFixed(6),
        longitude: (lng_base + (Math.random()-0.5)*0.2).toFixed(6),
        village_id: `VLG${String(Math.floor(Math.random()*20)+1).padStart(3,'0')}`,
        observation_date: `2024-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`,
        observation_time: '08:00:00',
        individual_count: String(Math.floor(Math.random()*5)+1),
        health_status: 'Healthy',
        confidence_score: (Math.random()*0.5+0.5).toFixed(2),
        verified: Math.random() > 0.3 ? 'True' : 'False',
        notes: 'Demo observation'
      });
    }
    return obs;
  }

  function generateCitizenReportsFallback() {
    const reports = [];
    for (let i = 1; i <= 50; i++) {
      reports.push({
        report_id: `CR${String(i).padStart(5,'0')}`,
        user_id: `USR${String(Math.floor(Math.random()*20)+1).padStart(4,'0')}`,
        species_id: `SP${String(Math.floor(Math.random()*8)+1).padStart(4,'0')}`,
        latitude: (19.87 + (Math.random()-0.5)*0.15).toFixed(6),
        longitude: (74.47 + (Math.random()-0.5)*0.2).toFixed(6),
        report_date: `2024-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`,
        remarks: 'Spotted near village tank',
        verification_status: ['Verified', 'Pending', 'Rejected'][Math.floor(Math.random()*3)],
      });
    }
    return reports;
  }

  function generateThreatsFallback() {
    const types = ['Plastic Waste', 'Water Pollution', 'Illegal Tree Cutting', 'Soil Erosion', 'Encroachment'];
    const severities = ['Low', 'Moderate', 'High', 'Critical'];
    const threats = [];
    for (let i = 1; i <= 30; i++) {
      threats.push({
        threat_id: `ENV${String(i).padStart(4,'0')}`,
        threat_type: types[Math.floor(Math.random()*types.length)],
        severity: severities[Math.floor(Math.random()*severities.length)],
        latitude: (19.87 + (Math.random()-0.5)*0.15).toFixed(6),
        longitude: (74.47 + (Math.random()-0.5)*0.2).toFixed(6),
        date: `2024-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-01`,
        resolved: Math.random() > 0.4 ? 'True' : 'False',
        description: 'Identified during patrol'
      });
    }
    return threats;
  }

  function generateUsersFallback() {
    const names = ['Kalyani Patil', 'Arjun Wagh', 'Priya Sharma', 'Suresh Thorat', 'Aarav Kulkarni'];
    return names.map((n, i) => ({
      user_id: `USR${String(i+1).padStart(4,'0')}`,
      full_name: n, email: `user${i+1}@example.com`,
      role: i === 0 ? 'Observer' : 'Citizen',
      village_id: `VLG001`, points: String(Math.floor(Math.random()*200)),
      reports_submitted: String(Math.floor(Math.random()*20)),
      badges: i === 0 ? 'Green Guardian' : '',
      join_date: '2023-01-01'
    }));
  }

  function generateMonthlyStatsFallback() {
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const years = [2022, 2023, 2024, 2025];
    const data = [];
    years.forEach(y => months.forEach(m => {
      data.push({
        month: String(m), year: String(y),
        bird_species: String(Math.floor(Math.random()*30+20)),
        mammal_species: String(Math.floor(Math.random()*12+5)),
        reptile_species: String(Math.floor(Math.random()*10+3)),
        butterfly_species: String(Math.floor(Math.random()*18+5)),
        plant_species: String(Math.floor(Math.random()*40+20)),
        total_species: String(Math.floor(Math.random()*80+60)),
      });
    }));
    return data;
  }

  function generateWaterBodiesFallback() {
    const types = ['Reservoir', 'Check Dam', 'Percolation Tank', 'River', 'Pond'];
    return Array.from({length: 10}, (_, i) => ({
      waterbody_id: `WB${String(i+1).padStart(3,'0')}`,
      name: `Water Body ${i+1}`,
      type: types[i % types.length],
      latitude: (19.87 + (Math.random()-0.5)*0.15).toFixed(6),
      longitude: (74.47 + (Math.random()-0.5)*0.2).toFixed(6),
      area_sqkm: (Math.random()*10+1).toFixed(2),
      water_quality: ['Excellent','Good','Moderate','Poor'][Math.floor(Math.random()*4)],
      biodiversity_score: (Math.random()*8+2).toFixed(1),
      pollution_level: ['Low','Moderate','High'][Math.floor(Math.random()*3)],
      fish_species_count: String(Math.floor(Math.random()*15)),
      last_inspection: '2025-01-01',
    }));
  }

  function generateConservationFallback() {
    return [
      { project_id:'PRJ001', project_name:'Tree Plantation Drive', location:'Kopargaon', start_date:'2024-01-01', status:'Active', budget_inr:'500000', organization:'WWF India' },
      { project_id:'PRJ002', project_name:'River Cleanup Campaign', location:'Godavari Bank', start_date:'2023-06-01', status:'Completed', budget_inr:'250000', organization:'Eco Foundation' },
      { project_id:'PRJ003', project_name:'Butterfly Garden', location:'Loni', start_date:'2024-04-01', status:'Active', budget_inr:'180000', organization:'Local SHG' },
    ];
  }

  function generateVillagesFallback() {
    return [
      { village_id:'VLG001', village_name:'Kopargaon', latitude:'19.875', longitude:'74.475', population:'15000', biodiversity_score:'7.2' },
      { village_id:'VLG002', village_name:'Pimpalgaon', latitude:'19.920', longitude:'74.540', population:'8000', biodiversity_score:'6.5' },
      { village_id:'VLG003', village_name:'Kohrul', latitude:'19.830', longitude:'74.430', population:'5000', biodiversity_score:'8.1' },
    ];
  }

  function generateHotspotsFallback() {
    return [
      { hotspot_id:'HS001', hotspot_name:'Godavari Riverbank', latitude:'19.876', longitude:'74.424', species_count:'83', conservation_priority:'High' },
      { hotspot_id:'HS002', hotspot_name:'Bhandardara Forest', latitude:'19.913', longitude:'74.569', species_count:'96', conservation_priority:'Critical' },
    ];
  }

  function generateNDVIFallback() {
    const data = [];
    for (let i = 0; i < 50; i++) {
      const ndvi = (Math.random() * 1.2 - 0.2).toFixed(3);
      const health = ndvi < 0 ? 'Bare/Water' : ndvi < 0.3 ? 'Sparse' : ndvi < 0.6 ? 'Moderate' : 'Healthy';
      data.push({
        ndvi_id: `NDVI${String(i+1).padStart(5,'0')}`,
        latitude: (19.87 + (Math.random()-0.5)*0.15).toFixed(6),
        longitude: (74.47 + (Math.random()-0.5)*0.2).toFixed(6),
        date: '2025-05-01', ndvi, vegetation_health: health
      });
    }
    return data;
  }

  function generateHabitatsFallback() {
    return [
      { habitat_id:'HAB001', habitat_name:'Godavari River', vegetation_type:'Riparian', biodiversity_score:'8.9' },
      { habitat_id:'HAB002', habitat_name:'Wetland', vegetation_type:'Marshland', biodiversity_score:'8.2' },
      { habitat_id:'HAB003', habitat_name:'Agricultural Field', vegetation_type:'Cropland', biodiversity_score:'4.5' },
      { habitat_id:'HAB004', habitat_name:'Grassland', vegetation_type:'Grassland', biodiversity_score:'6.0' },
    ];
  }

  function generateProtectedAreasFallback() {
    return [
      { protected_area_id:'PA001', name:'Chaskaon Sacred Grove', type:'Sacred Grove', latitude:'19.843', longitude:'74.496', area_sqkm:'1.95', established_year:'2001' },
      { protected_area_id:'PA002', name:'Sangamner Reserved Forest', type:'Reserved Forest', latitude:'19.929', longitude:'74.417', area_sqkm:'0.71', established_year:'1994' },
    ];
  }

  function generateEducationFallback() {
    return [
      { resource_id:'EDU0001', species_id:'SP0001', title:'Getting to know Indian Peafowl', description:'An educational overview of Indian Peafowl.', habitat:'Grassland', conservation_status:'Least Concern', interesting_fact:'National bird of India.' },
      { resource_id:'EDU0002', species_id:'SP0002', title:'Getting to know Common Myna', description:'An educational overview of Common Myna.', habitat:'Urban Garden', conservation_status:'Least Concern', interesting_fact:'Highly adaptable bird.' },
    ];
  }

  // ── Utility: Group array by key ─────────────────────────────────────────
  function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key] || 'Unknown';
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  // ── Utility: Count by key ───────────────────────────────────────────────
  function countBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key] || 'Unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  // ── Utility: Get numeric field ──────────────────────────────────────────
  function num(val) { return parseFloat(val) || 0; }
  function int(val) { return parseInt(val) || 0; }

  // ── Clear cache ─────────────────────────────────────────────────────────
  function clearCache() { Object.keys(cache).forEach(k => delete cache[k]); }

  // ── Public API ──────────────────────────────────────────────────────────
  return { load, loadAll, groupBy, countBy, num, int, clearCache, parseCSV };
})();

// Make globally available
window.DataLoader = DataLoader;
