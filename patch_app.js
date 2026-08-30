const fs = require('fs');
let code = fs.readFileSync('Frontend/js/app.js', 'utf8');
const target = "{ id: 'citizen',       label: 'Citizen Reports',     icon: 'fa-file-alt',       href: 'citizen-reports.html',       badge: null },";
const insert = target + "\n    { id: 'creator',       label: 'Creator Challenge',   icon: 'fa-video',          href: 'creator-challenge.html',     badge: 'NEW' },";

code = code.replace(target, insert);

fs.writeFileSync('Frontend/js/app.js', code, 'utf8');
console.log('App JS patched');
