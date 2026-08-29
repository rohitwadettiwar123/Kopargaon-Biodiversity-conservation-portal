const sqlite3 = require('sqlite3').verbose();

async function checkIntegrity(dbPath) {
  return new Promise((resolve) => {
    const testDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve('FAIL');
      testDb.get('PRAGMA integrity_check;', (err, row) => {
        testDb.close();
        if (err) return resolve('FAIL');
        if (row && row.integrity_check === 'ok') {
          resolve('PASS');
        } else {
          resolve('FAIL');
        }
      });
    });
  });
}

module.exports = { checkIntegrity };
