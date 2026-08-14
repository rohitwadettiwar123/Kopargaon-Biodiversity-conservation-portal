const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const CSV_DIR = 'C:\\Users\\hp\\Downloads\\Kopargaon_Biodiversity_Dataset';

// Remove old DB if exists
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);

// Helper to run query as promise
const run = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

async function importTable(tableName, filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (hdr) => {
        headers = hdr.map(h => h.trim());
      })
      .on('data', (data) => {
        const row = {};
        for (const key of Object.keys(data)) {
          row[key.trim()] = data[key];
        }
        results.push(row);
      })
      .on('end', async () => {
        if (headers.length === 0) return resolve();
        
        try {
          // Add password to users table
          if (tableName === 'users' && !headers.includes('password')) {
            headers.push('password');
          }

          // Create table
          const cols = headers.map(h => `"${h}" TEXT`).join(', ');
          await run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${cols})`);
          
          // Insert data
          const placeholders = headers.map(() => '?').join(', ');
          const insertSql = `INSERT INTO "${tableName}" ("${headers.join('", "')}") VALUES (${placeholders})`;
          
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(insertSql);
            
            for (const row of results) {
              const values = headers.map(h => {
                if (tableName === 'users' && h === 'password') {
                  // Admin user gets admin123, others get password123
                  const pwd = (row.email && row.email.toLowerCase().includes('admin')) ? 'admin123' : 'password123';
                  return bcrypt.hashSync(pwd, 10);
                }
                return row[h] !== undefined ? row[h] : null;
              });
              stmt.run(values);
            }
            
            stmt.finalize();
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (e) {
          reject(e);
        }
      });
  });
}

async function runImport() {
  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  for (const file of files) {
    const tableName = path.basename(file, '.csv');
    console.log(`Importing ${tableName}...`);
    await importTable(tableName, path.join(CSV_DIR, file));
  }
  
  // Custom schema overrides or extra tables
  // Let's ensure citizen reports have proper status
  console.log('Import complete.');
  db.close();
}

runImport().catch(console.error);
