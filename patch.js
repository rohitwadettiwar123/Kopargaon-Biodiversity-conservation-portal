const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');
const target = "    if (!row) return res.status(404).json({ error: 'Report not found.' });\r\n    res.json(row);";
const insert = "    if (!row) return res.status(404).json({ error: 'Report not found.' });\r\n\r\n    try {\r\n      const reel = await dbGet('SELECT * FROM citizen_report_reels WHERE report_id=?', [req.params.id]);\r\n      if (reel) row.reel = reel;\r\n    } catch(err) {}\r\n\r\n    res.json(row);";
code = code.replace(target, insert);

const target2 = "    if (!row) return res.status(404).json({ error: 'Report not found.' });\n    res.json(row);";
const insert2 = "    if (!row) return res.status(404).json({ error: 'Report not found.' });\n\n    try {\n      const reel = await dbGet('SELECT * FROM citizen_report_reels WHERE report_id=?', [req.params.id]);\n      if (reel) row.reel = reel;\n    } catch(err) {}\n\n    res.json(row);";
code = code.replace(target2, insert2);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched');
