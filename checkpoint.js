const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite', (err) => {
  if (err) throw err;
  // Checkpoint WAL to merge it fully into database.sqlite
  db.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
    if (err) console.error(err);
    else console.log('WAL Checkpointed');
    
    // Switch back to DELETE mode so WAL is removed
    db.run('PRAGMA journal_mode=DELETE', (err) => {
      if (err) console.error(err);
      else console.log('Switched to DELETE mode');
      db.close();
    });
  });
});
