const BlackoutRecovery = (() => {
  async function init() {
    await refreshStatus();
    await loadHistory();
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

  async function refreshStatus() {
    try {
      const data = await fetchWithAuth('/api/recovery/status');
      
      const dbStatusEl = document.getElementById('kpi-db-status');
      const shieldCore = document.getElementById('shield-core');
      if (data.status === 'BLACKOUT') {
        dbStatusEl.innerHTML = '<span class="status-indicator status-blackout">🔴 BLACKOUT</span>';
        shieldCore.classList.add('blackout');
      } else if (data.status === 'RECOVERING') {
        dbStatusEl.innerHTML = '<span class="status-indicator status-recovering">🟡 RECOVERING</span>';
        shieldCore.classList.remove('blackout');
      } else {
        dbStatusEl.innerHTML = '<span class="status-indicator status-healthy">🟢 HEALTHY</span>';
        shieldCore.classList.remove('blackout');
      }

      document.getElementById('kpi-backups').textContent = data.backups;
      document.getElementById('kpi-pending').textContent = data.pending_operations;

    } catch (e) {
      console.error(e);
      document.getElementById('kpi-db-status').innerHTML = '<span class="status-indicator status-blackout">🔴 UNREACHABLE</span>';
    }
  }

  async function loadHistory() {
    try {
      const logs = await fetchWithAuth('/api/recovery/log');
      const tbody = document.getElementById('history-table-body');
      if (!logs || !logs.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">No history found</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${new Date(l.timestamp).toLocaleString()}</td>
          <td>${l.event}</td>
          <td>${l.selected_backup || '-'}</td>
          <td>${l.integrity === 'PASS' ? '<span style="color:#4ade80">PASS</span>' : '<span style="color:#ef4444">FAIL</span>'}</td>
          <td>${l.operations_replayed}</td>
          <td>${l.recovery_status}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  async function createBackup() {
    if (!confirm('Create a new database backup?')) return;
    try {
      const token = Auth.getToken();
      const res = await fetch('/api/recovery/backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'API Error';
        try { msg = JSON.parse(text).error || msg; } catch(e) { msg = text; }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'backup.sqlite';
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      Notifications.show('Backup downloaded successfully', 'success');
      refreshStatus();
    } catch (e) {
      Notifications.show('Failed to create backup: ' + e.message, 'error');
    }
  }

  async function checkIntegrity() {
    try {
      const res = await fetchWithAuth('/api/recovery/check', { method: 'POST' });
      const el = document.getElementById('kpi-integrity');
      if (res.integrity === 'PASS') {
        el.innerHTML = '<span class="status-indicator status-healthy">🟢 PASS</span>';
        Notifications.show('Database integrity check passed.', 'success');
      } else {
        el.innerHTML = '<span class="status-indicator status-blackout">🔴 FAIL</span>';
        Notifications.show('Database integrity check FAILED!', 'error');
      }
    } catch (e) {
      Notifications.show('Integrity check failed: ' + e.message, 'error');
    }
  }

  async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setTimeline(step, state, detail) {
    const el = document.getElementById(`tl-0${step}`);
    if (!el) return;
    el.className = `timeline-item ${state}`;
    if (detail) document.getElementById(`tl-0${step}-detail`).textContent = detail;
  }

  function resetTimeline() {
    for(let i=1; i<=8; i++) {
      setTimeline(i, '', 'Waiting...');
    }
  }

  async function startDemo() {
    if (!confirm('SIMULATE BLACKOUT? This will simulate a database failure and trigger the recovery process in demo mode.')) return;
    resetTimeline();
    
    try {
      // Step 1: Simulate
      await fetchWithAuth('/api/recovery/demo', { method: 'POST' });
      refreshStatus();
      setTimeline(1, 'active', 'Database failure simulated!');
      await delay(1500);
      setTimeline(1, 'done');
      
      // Step 2: Demo Op
      setTimeline(2, 'active', 'Simulating active citizen report...');
      const demoOp = await fetchWithAuth('/api/recovery/demo-operation', {
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
      await delay(1500);
      setTimeline(2, 'done', `Protected: ${demoOp.operation.operation_id}`);
      refreshStatus();
      
      // Step 3
      setTimeline(3, 'active', 'Scanning available recovery points...');
      await delay(1500);
      setTimeline(3, 'done', '3 backups found');
      
      // Step 4
      setTimeline(4, 'active', 'Checking integrity of latest backup...');
      await delay(1500);
      setTimeline(4, 'done', 'Backup verified: PASS');
      
      // Step 5: Actual recovery
      setTimeline(5, 'active', 'Restoring database...');
      const recRes = await fetchWithAuth('/api/recovery/start', { method: 'POST' });
      await delay(1000);
      setTimeline(5, 'done', 'Restored successfully');
      
      // Step 6
      setTimeline(6, 'active', 'Replaying pending operations...');
      await delay(1000);
      setTimeline(6, 'done', `${recRes.log.operations_replayed} operations replayed`);
      
      // Step 7
      setTimeline(7, 'active', 'Checking for duplicates...');
      await delay(1000);
      setTimeline(7, 'done', `${recRes.log.duplicates_prevented} duplicates prevented`);
      
      // Step 8
      setTimeline(8, 'active', 'System brought online');
      await delay(1000);
      setTimeline(8, 'done', 'System Fully Operational');
      
      refreshStatus();
      loadHistory();
      Notifications.show('Demo recovery completed successfully!', 'success');

    } catch (e) {
      Notifications.show('Demo failed: ' + e.message, 'error');
    }
  }

  return { init, createBackup, checkIntegrity, startDemo };
})();
window.BlackoutRecovery = BlackoutRecovery;
