const fs = require('fs');
let code = fs.readFileSync('Frontend/js/creator-challenge.js', 'utf8');

const apiDef = `const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';\n\n`;

code = apiDef + code;

code = code.replace(/'\/api\/creator-challenge\/profile'/g, "API + '/creator-challenge/profile'");
code = code.replace(/'\/api\/creator-challenge\/leaderboard'/g, "API + '/creator-challenge/leaderboard'");
code = code.replace(/'\/api\/creator-challenge\/reel'/g, "API + '/creator-challenge/reel'");
code = code.replace(/'\/api\/admin\/creator-challenge'/g, "API + '/admin/creator-challenge'");
code = code.replace(/\`\/api\/admin\/creator-challenge\/\$\{id\}\/status\`/g, "\`\${API}/admin/creator-challenge/\${id}/status\`");

fs.writeFileSync('Frontend/js/creator-challenge.js', code, 'utf8');
console.log('Fixed API routes');
