const { getState, setState } = require('./recovery-state');
const { getLogs } = require('./recovery-log');
const { getAvailableBackups, createBackup } = require('./backup-manager');
const { performRecovery, simulateBlackout } = require('./recovery-manager');
const { getQueue, getPendingOperations, addOperation } = require('./operation-queue');
const { checkIntegrity } = require('./integrity-check');
const path = require('path');

module.exports = function setupRecoveryApi(app, db, authenticateToken, adminOnly) {
  
  app.get('/api/recovery/status', authenticateToken, async (req, res) => {
    res.json({
      status: getState(),
      backups: getAvailableBackups().length,
      pending_operations: getPendingOperations().length
    });
  });

  app.get('/api/recovery/backups', authenticateToken, adminOnly, async (req, res) => {
    res.json(getAvailableBackups());
  });

  app.get('/api/recovery/log', authenticateToken, adminOnly, async (req, res) => {
    res.json(getLogs());
  });

  app.post('/api/recovery/check', authenticateToken, adminOnly, async (req, res) => {
    const dbPath = path.join(__dirname, '../database.sqlite');
    const integrity = await checkIntegrity(dbPath);
    res.json({ integrity });
  });

  app.post('/api/recovery/start', authenticateToken, adminOnly, async (req, res) => {
    const result = await performRecovery();
    res.json(result);
  });

  app.post('/api/recovery/demo-start', authenticateToken, async (req, res) => {
    const result = await performRecovery();
    res.json(result);
  });

  app.post('/api/recovery/demo', authenticateToken, async (req, res) => {
    simulateBlackout();
    res.json({ success: true, message: 'Blackout simulated. System is now in BLACKOUT state.' });
  });

  app.post('/api/recovery/backup', authenticateToken, adminOnly, async (req, res) => {
    try {
      const backup = await createBackup(db);
      res.download(backup.filepath, backup.filename);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // Endpoint to create a demo operation safely
  app.post('/api/recovery/demo-operation', authenticateToken, async (req, res) => {
    const op = {
      operation_id: 'OP-DEMO-' + Date.now(),
      type: 'CITIZEN_REPORT',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      payload: req.body
    };
    addOperation(op);
    res.json({ success: true, operation: op });
  });
};
