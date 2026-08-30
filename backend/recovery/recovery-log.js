const fs = require('fs');
const path = require('path');
let LOG_FILE = path.join(__dirname, '../recovery-data/recovery-log.json');
if (process.env.VERCEL) {
  LOG_FILE = path.join('/tmp', 'recovery-log.json');
}

if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function getLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch (e) { return []; }
}

function appendLog(logEntry) {
  const logs = getLogs();
  logs.unshift({ ...logEntry, timestamp: new Date().toISOString() });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

module.exports = { getLogs, appendLog };
