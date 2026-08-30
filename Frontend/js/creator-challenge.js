const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = '../index.html';
    return;
  }
  
  loadCreatorProfile();
  checkAdminAndLoadReels();
  loadLeaderboard();
  setupUploadZone();
  
  document.getElementById('creatorForm').addEventListener('submit', handleSubmission);
});

let selectedFile = null;

function setupUploadZone() {
  const zone = document.getElementById('reelUploadZone');
  const input = document.getElementById('reelInput');
  const preview = document.getElementById('reelPreview');
  const nameLabel = document.getElementById('reelFileName');

  zone.addEventListener('click', () => input.click());
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  
  input.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    if (file.size > 100 * 1024 * 1024) {
      alert('File size exceeds 100MB limit.');
      input.value = '';
      return;
    }
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      alert('Only MP4 and WebM videos are allowed.');
      input.value = '';
      return;
    }
    
    // Check duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = function() {
      window.URL.revokeObjectURL(video.src);
      if (video.duration > 61) {
        alert('Video must be 60 seconds or less.');
        input.value = '';
        selectedFile = null;
        preview.style.display = 'none';
        nameLabel.style.display = 'none';
        return;
      }
      
      selectedFile = file;
      nameLabel.textContent = file.name;
      nameLabel.style.display = 'block';
      
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.style.display = 'block';
    };
    video.src = URL.createObjectURL(file);
  }
}

async function loadCreatorProfile() {
  try {
    const res = await fetch(API + '/creator-challenge/profile', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    if(!res.ok) return;
    const data = await res.json();
    
    document.getElementById('myCode').textContent = data.creator_code || '---';
    document.getElementById('myApproved').textContent = data.approved_reels || 0;
    document.getElementById('myPoints').textContent = data.points || 0;
    document.getElementById('myRank').textContent = data.rank || '-';
    
    window.creatorCode = data.creator_code;
  } catch(e) {
    console.error('Error loading creator profile', e);
  }
}

function copyCreatorCode() {
  const code = document.getElementById('myCode').textContent;
  if(code && code !== '---' && code !== 'Loading...') {
    navigator.clipboard.writeText(code);
    alert('Creator Code copied: ' + code);
  }
}

async function loadLeaderboard() {
  try {
    const res = await fetch(API + '/creator-challenge/leaderboard');
    if(!res.ok) return;
    const data = await res.json();
    
    const tbody = document.getElementById('creatorLeaderboardBody');
    tbody.innerHTML = '';
    
    if(data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#aaa;">No approved reels yet. Be the first!</td></tr>';
      return;
    }
    
    data.forEach((row, index) => {
      const rank = index + 1;
      let rankHtml = `<span>${rank}</span>`;
      if(rank === 1) rankHtml = `<i class="fa fa-medal rank-1"></i> 1`;
      else if(rank === 2) rankHtml = `<i class="fa fa-medal rank-2"></i> 2`;
      else if(rank === 3) rankHtml = `<i class="fa fa-medal rank-3"></i> 3`;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rankHtml}</td>
        <td><strong>${row.creator}</strong> <span style="font-size:10px; color:#888;">${row.creator_code||''}</span></td>
        <td>${row.approved_reels}</td>
        <td><span style="color:var(--green-primary); font-weight:600;">${row.points}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) {
    console.error('Error loading leaderboard', e);
  }
}

async function handleSubmission(e) {
  e.preventDefault();
  
  if (!selectedFile) {
    alert('Please upload a video file.');
    return;
  }
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  
  try {
    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', document.getElementById('crTitle').value);
    formData.append('category', document.getElementById('crCategory').value);
    formData.append('description', document.getElementById('crDescription').value);
    formData.append('village', document.getElementById('crVillage').value);
    formData.append('recording_date', document.getElementById('crDate').value);
    formData.append('social_platform', document.getElementById('crPlatform').value);
    formData.append('social_url', document.getElementById('crUrl').value);
    formData.append('original_content', document.getElementById('crOriginal').checked ? 1 : 0);
    formData.append('creator_code', window.creatorCode || '');
    
    const res = await fetch(API + '/creator-challenge/reel', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      body: formData
    });
    
    const data = await res.json();
    if(res.ok) {
      alert('Reel submitted successfully! It is pending admin approval.');
      e.target.reset();
      selectedFile = null;
      document.getElementById('reelPreview').style.display = 'none';
      document.getElementById('reelFileName').style.display = 'none';
    } else {
      alert(data.error || 'Failed to submit reel.');
    }
  } catch(err) {
    console.error(err);
    alert('An error occurred during upload.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-paper-plane"></i> Submit Reel';
  }
}


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
    const res = await fetch(API + '/admin/creator-challenge', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
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
      tr.innerHTML = `
        <td>
          <div style="font-weight:600; margin-bottom:5px;">${r.title}</div>
          <a href="${r.file_path}" target="_blank" style="color:var(--cyan); font-size:12px;"><i class="fa fa-external-link-alt"></i> View Video</a>
        </td>
        <td>
          ${r.reporter_name}<br>
          <span style="font-size:10px; color:#888;">${r.reporter_email}</span>
        </td>
        <td>
          <button onclick="verifyReel('${r.id}', 'APPROVED')" style="background:var(--green-primary); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-right:4px;">Approve</button>
          <button onclick="verifyReel('${r.id}', 'REJECTED')" style="background:var(--red); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Reject</button>
        </td>
      `;
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
  
  if(!confirm(`Are you sure you want to ${status} this reel?`)) return;
  
  try {
    const res = await fetch(`${API}/admin/creator-challenge/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${Auth.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, admin_reason: reason })
    });
    
    if(res.ok) {
      alert(`Reel ${status} successfully.`);
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
