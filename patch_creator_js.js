const fs = require('fs');
let code = fs.readFileSync('Frontend/js/creator-challenge.js', 'utf8');

const targetInit = "  loadCreatorProfile();";
const insertInit = targetInit + "\n  checkAdminAndLoadReels();";

code = code.replace(targetInit, insertInit);

const appendCode = `

async function checkAdminAndLoadReels() {
  const user = Auth.getUser();
  if (!user) return;
  if (user.email === 'admin@kbic.in' || user.role === 'super_admin' || user.role === 'Administrator') {
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminReels();
  }
}

async function loadAdminReels() {
  try {
    const res = await fetch('/api/admin/creator-challenge', {
      headers: { 'Authorization': \`Bearer \${Auth.getToken()}\` }
    });
    if(!res.ok) return;
    const data = await res.json();
    
    const tbody = document.getElementById('adminReelsBody');
    tbody.innerHTML = '';
    
    const pending = data.filter(r => r.status === 'PENDING');
    if(pending.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa;">No pending reels.</td></tr>';
      return;
    }
    
    pending.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>
          <div style="font-weight:600; margin-bottom:5px;">\${r.title}</div>
          <a href="\${r.file_path}" target="_blank" style="color:var(--cyan); font-size:12px;"><i class="fa fa-external-link-alt"></i> View Video</a>
        </td>
        <td>
          \${r.reporter_name}<br>
          <span style="font-size:10px; color:#888;">\${r.reporter_email}</span>
        </td>
        <td>
          <button onclick="verifyReel('\${r.id}', 'APPROVED')" style="background:var(--green-primary); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:4px;">Approve</button>
          <button onclick="verifyReel('\${r.id}', 'REJECTED')" style="background:var(--red); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Reject</button>
        </td>
      \`;
      tbody.appendChild(tr);
    });
  } catch(e) { console.error('Error loading admin reels', e); }
}

window.verifyReel = async function(id, status) {
  let reason = '';
  if (status === 'REJECTED') {
    reason = prompt('Reason for rejection?');
    if(reason === null) return;
  }
  
  if(!confirm(\`Are you sure you want to \${status} this reel?\`)) return;
  
  try {
    const res = await fetch(\`/api/admin/creator-challenge/\${id}/status\`, {
      method: 'PATCH',
      headers: { 
        'Authorization': \`Bearer \${Auth.getToken()}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, admin_reason: reason })
    });
    
    if(res.ok) {
      alert(\`Reel \${status} successfully.\`);
      loadAdminReels();
      loadLeaderboard(); // refresh leaderboard if approved
    } else {
      const err = await res.json();
      alert(err.error || 'Verification failed.');
    }
  } catch(e) {
    console.error(e);
    alert('An error occurred.');
  }
};
`;

code += appendCode;
fs.writeFileSync('Frontend/js/creator-challenge.js', code, 'utf8');
console.log('Creator JS patched');
