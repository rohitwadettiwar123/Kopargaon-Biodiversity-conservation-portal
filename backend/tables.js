const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  console.log(rows);
  db.close();
});
