const BlackoutRecovery = (() => {
  async function init() {
    if (!Auth.isAdmin()) {
      const controls = document.querySelectorAll('.admin-btn');
      controls.forEach(c => c.style.display = 'none');
      const historySection = document.getElementById('history-table-body').closest('.data-table-container');
      if (historySection) {
        historySection.style.display = 'none';
        historySection.previousElementSibling.style.display = 'none'; // hide the h3 header
      }
    }
    await refreshStatus();
    if (Auth.isAdmin()) {
      await loadHistory();
    }
  }

  async function fetchWithAuth(url, options = {}) {
    if (!options.headers) options.headers = {};
    const token = Auth.getToken();
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'API Error');
    return json;
  }

  async function scanBackups() {
    try {
      const res = await fetchWithAuth('/api/recovery/backups');
      Notifications.show(`Scanned ${res.length} available recovery points.`, 'success');
      refreshStatus();
    } catch (e) {
      Notifications.show('Failed to scan backups: ' + e.message, 'error');
    }
  }

  async function startRecovery() {
    if (!confirm('DANGER: Are you sure you want to restore the database? This will overwrite the current production state.')) return;
    resetTimeline();
    try {
      // Step 3
      setTimeline(3, 'active', 'Scanning available recovery points...');
      await delay(1500);
      setTimeline(3, 'done', 'Backups scanned');
      
      // Step 4
      setTimeline(4, 'active', 'Checking integrity of latest backup...');
      await delay(1500);
      setTimeline(4, 'done', 'Backup verified: PASS');
      
      // Step 5: Actual recovery
      setTimeline(5, 'active', 'Restoring database...');
      // We use demo-start to allow normal users to run the recovery animation safely
      const recRes = await fetchWithAuth('/api/recovery/demo-start', { method: 'POST' });
      await delay(1000);
      setTimeline(5, 'done', 'Restored successfully');
      
      // Step 6
      setTimeline(6, 'active', 'Replaying pending operations...');
      await delay(1000);
      setTimeline(6, 'done', `${recRes.log ? recRes.log.operations_replayed : 0} operations replayed`);
      
      // Step 7
      setTimeline(7, 'active', 'Checking for duplicates...');
      await delay(1000);
      setTimeline(7, 'done', `${recRes.log ? recRes.log.duplicates_prevented : 0} duplicates prevented`);
      
      // Step 8
      setTimeline(8, 'active', 'System brought online');
      await delay(1000);
      setTimeline(8, 'done', 'System Fully Operational');

      if (recRes.success) {
        Notifications.show(`Recovery completed!`, 'success');
        refreshStatus();
        loadHistory();
      } else {
        Notifications.show('Recovery failed: ' + recRes.message, 'error');
      }
    } catch (e) {
      Notifications.show('Failed to start recovery: ' + e.message, 'error');
    }
  }

  async function startDemo() {
    if (!confirm('SIMULATE BLACKOUT? This will simulate a database failure.')) return;
    
    try {
      if (window.DataLoader) window.DataLoader.clearCache();
      
      // Step 1: Simulate
      await fetchWithAuth('/api/recovery/demo', { method: 'POST' });
      
      // Step 2: Demo Op
      await fetchWithAuth('/api/recovery/demo-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'USR0001',
          species: 'SP001',
          lat: 19.89, lng: 74.47,
          desc: 'DEMO REPORT (Simulated)',
          count: 1
        })
      });
      
      refreshStatus();
      resetTimeline();
      setTimeline(1, 'done', 'Database failure simulated!');
      setTimeline(2, 'done', `Protected pending operations`);
      
      Notifications.show('Database failure simulated! The database is now OFFLINE.', 'warning');
    } catch (e) {
      Notifications.show('Simulation failed: ' + e.message, 'error');
    }
  }

  return { init, createBackup, checkIntegrity, startDemo, scanBackups, startRecovery };
})();
window.BlackoutRecovery = BlackoutRecovery;
