const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');

const dbPath = path.join('C:\\Users\\hp\\Desktop\\New folder', 'backend', 'database.sqlite');
const imgDir = path.join('C:\\Users\\hp\\Desktop\\New folder', 'Frontend', 'assets', 'images', 'species');

const db = new sqlite3.Database(dbPath);

function fetchWikiImageUrl(queryStr) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(queryStr);
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${query}&redirects=1&pithumbsize=400&format=json`;
    
    https.get(url, { headers: { 'User-Agent': 'KopargaonBioPortal/1.0 (rohit@example.com)' } }, (res) => {
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages;
          if (!pages) return resolve(null);
          const pageId = Object.keys(pages)[0];
          if (pageId !== '-1' && pages[pageId].thumbnail) {
            resolve(pages[pageId].thumbnail.source);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function downloadImage(url, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'KopargaonBioPortal/1.0 (rohit@example.com)' } }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        file.close();
        fs.unlink(destPath, () => resolve(false));
      }
    }).on('error', () => {
      file.close();
      fs.unlink(destPath, () => resolve(false));
    });
  });
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function processSpecies() {
  db.all('SELECT scientific_name, common_name FROM species_master', async (err, rows) => {
    if (err) throw err;
    console.log(`Found ${rows.length} species. Processing sequentially...`);
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sciName = row.scientific_name;
      const filename = normalizeName(sciName) + '.jpg';
      const dest = path.join(imgDir, filename);
      
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        continue;
      }
      
      let url = await fetchWikiImageUrl(sciName);
      if (!url) {
        url = await fetchWikiImageUrl(row.common_name);
      }
      
      if (url) {
        const success = await downloadImage(url, dest);
        if (success) {
          console.log(`[${i+1}/${rows.length}] OK: ${sciName}`);
        } else {
          console.log(`[${i+1}/${rows.length}] FAIL DL: ${sciName}`);
        }
      } else {
        console.log(`[${i+1}/${rows.length}] NOT FOUND: ${sciName}`);
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('Finished downloading images.');
    db.close();
  });
}

processSpecies();
