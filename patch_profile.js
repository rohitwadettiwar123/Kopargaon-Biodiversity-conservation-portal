const fs = require('fs');
let code = fs.readFileSync('Frontend/js/profile.js', 'utf8');

const targetInit = "loadMyReports();";
const insertInit = targetInit + "\n    loadCreatorStats();";

code = code.replace(targetInit, insertInit);

const appendCode = `
  async function loadCreatorStats() {
    if (!document.getElementById('cc-code')) return; // elements don't exist
    try {
      const res = await fetch(\`\${API}/creator-challenge/profile\`, {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      if(res.ok) {
        const data = await res.json();
        document.getElementById('cc-code').textContent = data.creator_code || '---';
        document.getElementById('cc-reels').textContent = data.approved_reels || 0;
        document.getElementById('cc-rank').textContent = data.rank || '-';
      }
    } catch (e) {
      console.warn('Error loading creator stats:', e);
    }
  }
`;

code = code + appendCode;
fs.writeFileSync('Frontend/js/profile.js', code, 'utf8');
console.log('Profile JS patched');
