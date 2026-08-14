const fs = require('fs');
const path = require('path');
const jsDir = 'Frontend/js';
const files = fs.readdirSync(jsDir);
files.forEach(f => {
  const content = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const lines = content.split('\n');
  let count = 0;
  lines.forEach(l => { if (l.includes('\\`') || l.includes('\\${')) count++; });
  if (count > 0) console.log(f + ': ' + count + ' problematic lines');
});
