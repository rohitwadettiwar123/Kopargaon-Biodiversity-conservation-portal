const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Add table init for creator_challenge_reels
const targetInit = "    await addColumn('citizen_reports', 'image_auth_requires_review', 'INTEGER');";
const insertInit = targetInit + `
    await addColumn('users', 'creator_code', 'TEXT');

    await dbRun(\`
      CREATE TABLE IF NOT EXISTS creator_challenge_reels (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        village TEXT,
        recording_date TEXT,
        social_platform TEXT,
        social_url TEXT,
        creator_code TEXT,
        original_content INTEGER,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        status TEXT DEFAULT 'PENDING',
        admin_reason TEXT,
        created_at TEXT NOT NULL,
        approved_at TEXT
      )
    \`);
    console.log('✅ creator_challenge_reels table ready');
`;
if(code.includes(targetInit)) {
  code = code.replace(targetInit, insertInit);
}

// 2. Add endpoints:
const targetEndpoints = "// ── Global Error Handler ───────────────────────────────────────────────────";
const insertEndpoints = `
// ══════════════════════════════════════════════════════════════════════════
// ── CREATOR CHALLENGE ENDPOINTS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function generateCreatorCode() {
  return 'KPB-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

app.get('/api/creator-challenge/profile', authenticateToken, async (req, res) => {
  try {
    let user = await dbGet('SELECT user_id, full_name, creator_code, points, badges FROM users WHERE user_id=?', [req.user.user_id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (!user.creator_code) {
      const code = generateCreatorCode();
      await dbRun('UPDATE users SET creator_code=? WHERE user_id=?', [code, user.user_id]);
      user.creator_code = code;
    }
    
    const approvedReels = await dbGet("SELECT COUNT(*) as count FROM creator_challenge_reels WHERE user_id=? AND status='APPROVED'", [user.user_id]);
    
    // rank calculation
    const leaderboard = await dbAll('SELECT user_id FROM users ORDER BY CAST(points AS INTEGER) DESC');
    let rank = leaderboard.findIndex(u => u.user_id === user.user_id) + 1;
    if(rank === 0) rank = '-';
    
    res.json({
      creator_code: user.creator_code,
      approved_reels: approvedReels.count,
      points: user.points,
      rank: rank,
      badges: user.badges
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/creator-challenge/reel', authenticateToken, uploadReel.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No valid video uploaded.' });
    
    const { title, category, description, village, recording_date, social_platform, social_url, creator_code, original_content } = req.body;
    
    const reel_id = 'CHALLENGE_' + Date.now();
    const file_path = '/uploads/reels/' + req.file.filename;
    
    await dbRun(\`
      INSERT INTO creator_challenge_reels 
      (id, user_id, title, category, description, village, recording_date, social_platform, social_url, creator_code, original_content, file_name, file_path, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`, [
      reel_id, req.user.user_id, title, category, description, village, recording_date, social_platform, social_url, creator_code, 
      original_content === 'true' || original_content === '1' ? 1 : 0, 
      req.file.filename, file_path, req.file.size, new Date().toISOString()
    ]);
    
    res.json({ success: true, reel_id, file_path });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/creator-challenge/my-reels', authenticateToken, async (req, res) => {
  try {
    const reels = await dbAll('SELECT * FROM creator_challenge_reels WHERE user_id=? ORDER BY created_at DESC', [req.user.user_id]);
    res.json(reels);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/creator-challenge/leaderboard', async (req, res) => {
  try {
    const data = await dbAll(\`
      SELECT u.user_id, u.full_name as creator, u.points, u.creator_code, 
             COUNT(r.id) as approved_reels 
      FROM users u
      JOIN creator_challenge_reels r ON u.user_id = r.user_id
      WHERE r.status = 'APPROVED'
      GROUP BY u.user_id
      ORDER BY CAST(u.points AS INTEGER) DESC
      LIMIT 50
    \`);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/creator-challenge', authenticateToken, adminOnly, async (req, res) => {
  try {
    const reels = await dbAll(\`
      SELECT r.*, u.full_name as reporter_name, u.email as reporter_email 
      FROM creator_challenge_reels r
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.created_at DESC
    \`);
    res.json(reels);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/creator-challenge/:id/status', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { status, admin_reason } = req.body;
    if(!['APPROVED','REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    
    const reel = await dbGet('SELECT * FROM creator_challenge_reels WHERE id=?', [req.params.id]);
    if(!reel) return res.status(404).json({ error: 'Reel not found' });
    
    if(reel.status !== 'PENDING') return res.status(400).json({ error: 'Already processed' });
    
    await dbRun('UPDATE creator_challenge_reels SET status=?, admin_reason=?, approved_at=? WHERE id=?', [
      status, admin_reason || '', status === 'APPROVED' ? new Date().toISOString() : null, req.params.id
    ]);
    
    if(status === 'APPROVED') {
      await dbRun('UPDATE users SET points = COALESCE(CAST(points AS INTEGER),0) + 100 WHERE user_id=?', [reel.user_id]);
    }
    
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

` + targetEndpoints;
if(code.includes(targetEndpoints)) {
  code = code.replace(targetEndpoints, insertEndpoints);
} else {
  console.log("Could not find global error handler marker");
}

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Backend Patched');
