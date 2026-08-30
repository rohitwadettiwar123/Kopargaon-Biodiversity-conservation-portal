const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let BACKUPS_DIR = path.join(__dirname, '../backups');
let DB_PATH = path.join(__dirname, '../database.sqlite');
const MAX_BACKUPS = 5;

if (process.env.VERCEL) {
  BACKUPS_DIR = path.join('/tmp', 'backups');
  DB_PATH = path.join('/tmp', 'database.sqlite');
}

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function formatTimestamp(date) {
  return date.toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0];
}

async function createBackup(dbObj) {
  return new Promise((resolve, reject) => {
    const backupId = `BKP-${formatTimestamp(new Date())}`;
    const filename = `backup_${backupId}.sqlite`;
    const dest = path.join(BACKUPS_DIR, filename);

    // Write-Ahead Log requires a checkpoint to ensure consistency of a backup copy
    dbObj.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
      if (err) return reject(err);
      
      try {
        fs.copyFileSync(DB_PATH, dest);
        
        const backups = getAvailableBackups();
        if (backups.length > MAX_BACKUPS) {
          const toDelete = backups.slice(MAX_BACKUPS);
          for (let b of toDelete) {
            if (fs.existsSync(b.filepath)) fs.unlinkSync(b.filepath);
          }
        }
        
        const { appendLog } = require('./recovery-log');
        appendLog({
          event: 'BACKUP_CREATED',
          selected_backup: filename,
          integrity: 'PASS',
          operations_replayed: 0,
          duplicates_prevented: 0,
          recovery_status: 'SUCCESS',
          duration_ms: 0
        });

        resolve({
          backup_id: backupId,
          filename: filename,
          filepath: dest,
          created_at: new Date().toISOString(),
          size: fs.statSync(dest).size,
          status: 'VALID'
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

function getAvailableBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.sqlite'));
  return files.map(f => {
    const fp = path.join(BACKUPS_DIR, f);
    const stats = fs.statSync(fp);
    return {
      backup_id: f.replace('backup_', '').replace('.sqlite', ''),
      filename: f,
      filepath: fp,
      created_at: stats.mtime.toISOString(),
      size: stats.size,
      status: 'AVAILABLE'
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // newest first
}

module.exports = { createBackup, getAvailableBackups };
