/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   KOPARGAON BIODIVERSITY CONSERVATION PORTAL — BACKEND API      ║
 * ║   Complete Production-Grade REST API with 40+ Endpoints          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Modules: Auth, Species, Observations, Citizen Reports, Threats,
 *          Water Bodies, Conservation, Leaderboard, Dashboard,
 *          Analytics, GIS, File Upload, Admin, NDVI, Weather
 */

const express    = require('express');
const cors       = require('cors');
const sqlite3    = require('sqlite3').verbose();
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcrypt');
const path       = require('path');
const multer     = require('multer');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');
const { v4: uuidv4 } = require('uuid');
const fs         = require('fs');

const app = express();

// ── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for demo
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ── Rate Limiting ───────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: { error: 'Too many requests' } });
app.use('/api/', limiter);

// ── Config ──────────────────────────────────────────────────────────────────
const DB_PATH    = path.join(__dirname, 'database.sqlite');
const JWT_SECRET = 'kbic-kopargaon-biodiversity-secret-2026';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ADMIN_EMAIL = 'admin@kbic.in';

// Create uploads directory if not exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Database ────────────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('DB Error:', err.message); process.exit(1); }
  console.log('✅ Connected to SQLite database');
});
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

// ── File Upload Config ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  cb(null, allowed.includes(file.mimetype));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Serve uploaded images ───────────────────────────────────────────────────
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Serve Frontend (Static Files) ──────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..', 'Frontend');
const DATA_DIR     = path.join(__dirname, '..', 'data');
app.use(express.static(FRONTEND_DIR));
app.use('/data', express.static(DATA_DIR));

// ── Helper: DB Promise Wrappers ─────────────────────────────────────────────
const dbGet  = (sql, params=[]) => new Promise((res,rej) => db.get(sql,params,(e,r)=>e?rej(e):res(r)));
const dbAll  = (sql, params=[]) => new Promise((res,rej) => db.all(sql,params,(e,r)=>e?rej(e):res(r)));
const dbRun  = (sql, params=[]) => new Promise((res,rej) => db.run(sql,params,function(e){e?rej(e):res({lastID:this.lastID,changes:this.changes})}));

// ── Auth Middleware ─────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication token required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access Denied: Administrator only.' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════
// ── 1. AUTH ENDPOINTS ────────────────────────────────────────────────────
// POST /api/auth/login
// POST /api/auth/register
// GET  /api/auth/me
// ══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await dbGet('SELECT * FROM users WHERE LOWER(email)=?', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'No account found with this email.' });
    if (!user.password) return res.status(401).json({ error: 'Account not properly set up. Contact admin.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });

    const { password: _, ...safeUser } = user;
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: safeUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'All fields required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await dbGet('SELECT user_id FROM users WHERE LOWER(email)=?', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user_id  = 'USR' + Date.now().toString().slice(-6);
    const hash     = await bcrypt.hash(password, 10);
    const join_date = new Date().toISOString().split('T')[0];

    await dbRun(
      `INSERT INTO users (user_id, full_name, email, password, role, join_date, points, reports_submitted, badges) VALUES (?,?,?,?,?,?,?,?,?)`,
      [user_id, full_name, email.toLowerCase().trim(), hash, 'Citizen', join_date, 0, 0, '']
    );
    const newUser = { user_id, full_name, email: email.toLowerCase().trim(), role: 'Citizen', join_date, points: 0 };
    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user: newUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed: ' + e.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT user_id,full_name,email,role,village_id,points,reports_submitted,badges,join_date FROM users WHERE user_id=?',
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 2. GENERIC TABLE DATA API (replaces CSV) ─────────────────────────────
// GET /api/data/:table?limit=N&offset=N&sort=col&order=asc
// ══════════════════════════════════════════════════════════════════════════

const ALLOWED_TABLES = [
  'species_master','species_observations','citizen_reports','environmental_threats',
  'water_bodies','biodiversity_hotspots','conservation_projects','villages','habitats',
  'protected_areas','monthly_species_statistics','ndvi_data','weather','educational_resources',
  'land_cover','image_gallery'
];

app.get('/api/data/:table', async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Table not allowed.' });

  const limit  = Math.min(parseInt(req.query.limit)  || 10000, 25000);
  const offset = parseInt(req.query.offset) || 0;

  let sql;
  if (table === 'users') {
    sql = `SELECT user_id,full_name,email,role,village_id,points,reports_submitted,badges,join_date FROM users LIMIT ${limit} OFFSET ${offset}`;
  } else {
    sql = `SELECT * FROM "${table}" LIMIT ${limit} OFFSET ${offset}`;
  }

  try {
    const rows = await dbAll(sql);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/data/users (safe endpoint for leaderboard)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT user_id,full_name,email,role,village_id,points,reports_submitted,badges,join_date
       FROM users ORDER BY CAST(points AS INTEGER) DESC LIMIT 50`
    );
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 3. SPECIES ENDPOINTS ─────────────────────────────────────────────────
// GET /api/species               - All species with filters
// GET /api/species/:id           - Single species
// GET /api/species/search?q=     - Search species
// GET /api/species/nearby?lat&lng&radius  - Nearby species
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/species', async (req, res) => {
  try {
    const { category, iucn_status, habitat, endemic, q, limit=1000, offset=0 } = req.query;
    let conditions = [];
    let params = [];

    if (category)    { conditions.push('LOWER(category)=?');     params.push(category.toLowerCase()); }
    if (iucn_status) { conditions.push('LOWER(iucn_status)=?');  params.push(iucn_status.toLowerCase()); }
    if (habitat)     { conditions.push('habitat LIKE ?');         params.push(`%${habitat}%`); }
    if (endemic)     { conditions.push('LOWER(endemic)=?');       params.push(endemic.toLowerCase()); }
    if (q) {
      conditions.push('(LOWER(common_name) LIKE ? OR LOWER(scientific_name) LIKE ? OR LOWER(description) LIKE ?)');
      const qp = `%${q.toLowerCase()}%`;
      params.push(qp, qp, qp);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM species_master ${where} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await dbAll(sql, params);
    const countRow = await dbGet(`SELECT COUNT(*) as total FROM species_master ${where}`, params.slice(0,-2));
    res.json({ total: countRow.total, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/species/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const rows = await dbAll(
      `SELECT species_id,common_name,scientific_name,category,iucn_status FROM species_master
       WHERE LOWER(common_name) LIKE ? OR LOWER(scientific_name) LIKE ? LIMIT 20`,
      [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/species/:id', async (req, res) => {
  try {
    const species = await dbGet('SELECT * FROM species_master WHERE species_id=?', [req.params.id]);
    if (!species) return res.status(404).json({ error: 'Species not found.' });

    // Attach recent observations count
    const obsCount = await dbGet('SELECT COUNT(*) as count FROM species_observations WHERE species_id=?', [req.params.id]);
    species.observation_count = obsCount.count;
    res.json(species);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 4. OBSERVATIONS ENDPOINTS ────────────────────────────────────────────
// GET  /api/observations           - Paginated + filtered
// GET  /api/observations/:id       - Single observation
// POST /api/observations           - Create observation (auth)
// GET  /api/observations/species/:species_id
// GET  /api/observations/stats     - Aggregated stats
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/observations', async (req, res) => {
  try {
    const { species_id, village_id, verified, from_date, to_date, limit=100, offset=0 } = req.query;
    let conditions = [];
    let params = [];

    if (species_id)  { conditions.push('o.species_id=?');     params.push(species_id); }
    if (village_id)  { conditions.push('o.village_id=?');     params.push(village_id); }
    if (verified)    { conditions.push('LOWER(o.verified)=?'); params.push(verified.toLowerCase()); }
    if (from_date)   { conditions.push('o.observation_date>=?'); params.push(from_date); }
    if (to_date)     { conditions.push('o.observation_date<=?'); params.push(to_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT o.*, s.common_name, s.scientific_name, s.category, s.iucn_status
      FROM species_observations o
      LEFT JOIN species_master s ON o.species_id=s.species_id
      ${where}
      ORDER BY o.observation_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await dbAll(sql, params);
    const countRow = await dbGet(
      `SELECT COUNT(*) as total FROM species_observations o ${where}`,
      params.slice(0,-2)
    );
    res.json({ total: countRow.total, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/observations/stats', async (req, res) => {
  try {
    const [total, verified, today, thisMonth] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM species_observations'),
      dbGet("SELECT COUNT(*) as count FROM species_observations WHERE LOWER(verified)='true'"),
      dbGet("SELECT COUNT(*) as count FROM species_observations WHERE observation_date=DATE('now')"),
      dbGet("SELECT COUNT(*) as count FROM species_observations WHERE observation_date>=DATE('now','start of month')")
    ]);
    res.json({ total: total.count, verified: verified.count, today: today.count, this_month: thisMonth.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/observations/:id', async (req, res) => {
  try {
    const obs = await dbGet(
      `SELECT o.*, s.common_name, s.scientific_name, s.category FROM species_observations o
       LEFT JOIN species_master s ON o.species_id=s.species_id WHERE o.observation_id=?`,
      [req.params.id]
    );
    if (!obs) return res.status(404).json({ error: 'Observation not found.' });
    res.json(obs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 5. CITIZEN REPORTS ENDPOINTS ─────────────────────────────────────────
// GET   /api/reports              - All reports (admin) or own reports (user)
// POST  /api/reports              - Submit new report (auth)
// PATCH /api/reports/:id/verify   - Verify report (admin only)
// PATCH /api/reports/:id/reject   - Reject report (admin only)
// GET   /api/reports/pending      - All pending reports (admin)
// GET   /api/reports/stats        - Report statistics
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.email === ADMIN_EMAIL;
    const { status, limit=50, offset=0 } = req.query;

    let conditions = [];
    let params = [];

    // Non-admins see only their own reports
    if (!isAdmin) { conditions.push('r.user_id=?'); params.push(req.user.user_id); }
    if (status)  { conditions.push('LOWER(r.verification_status)=?'); params.push(status.toLowerCase()); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT r.*, s.common_name, s.scientific_name, s.category,
             u.full_name as reporter_name, u.email as reporter_email
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN users u ON r.user_id=u.user_id
      ${where}
      ORDER BY r.report_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), parseInt(offset));
    const rows = await dbAll(sql, params);
    const countRow = await dbGet(`SELECT COUNT(*) as total FROM citizen_reports r ${where}`, params.slice(0,-2));
    res.json({ total: countRow.total, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/pending', authenticateToken, adminOnly, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT r.*, s.common_name, s.scientific_name, s.category, u.full_name as reporter_name
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN users u ON r.user_id=u.user_id
      WHERE LOWER(r.verification_status)='pending'
      ORDER BY r.report_date DESC
    `);
    res.json({ total: rows.length, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/stats', authenticateToken, async (req, res) => {
  try {
    const [total, pending, verified, rejected] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM citizen_reports'),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE LOWER(verification_status)='pending'"),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE LOWER(verification_status)='verified'"),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE LOWER(verification_status)='rejected'")
    ]);
    res.json({ total: total.count, pending: pending.count, verified: verified.count, rejected: rejected.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { species, lat, lng, desc, village_id, report_time, count } = req.body;
    if (!species || !lat || !lng || !desc) return res.status(400).json({ error: 'species, lat, lng, desc are required.' });

    const report_id    = 'CR' + Date.now().toString().slice(-6);
    const user_id      = req.user.user_id;
    const report_date  = new Date().toISOString().split('T')[0];
    const submitted_at = new Date().toISOString();
    // ALWAYS force Pending — users cannot self-approve
    const verification_status = 'Pending';

    await dbRun(
      `INSERT INTO citizen_reports
         (report_id, user_id, species_id, latitude, longitude, report_date, report_time,
          remarks, verification_status, admin_comments, village_id, count, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [report_id, user_id, species, lat, lng, report_date,
       report_time || '', desc, verification_status, '', village_id || '', parseInt(count)||1, submitted_at]
    );

    // Award 10 points for submission
    await dbRun(
      `UPDATE users SET reports_submitted=COALESCE(CAST(reports_submitted AS INTEGER),0)+1,
       points=COALESCE(CAST(points AS INTEGER),0)+10 WHERE user_id=?`,
      [user_id]
    );

    res.status(201).json({
      success: true, report_id,
      status: 'Pending',
      message: 'Report submitted successfully. Status: Pending Verification.'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/my — user's OWN reports (always filtered by token, regardless of role)
app.get('/api/reports/my', authenticateToken, async (req, res) => {
  try {
    const { limit=50, offset=0 } = req.query;
    const rows = await dbAll(`
      SELECT r.*, s.common_name, s.scientific_name, s.category,
             v.village_name
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN villages v ON r.village_id=v.village_id
      WHERE r.user_id=?
      ORDER BY r.submitted_at DESC, r.report_date DESC
      LIMIT ? OFFSET ?`,
      [req.user.user_id, parseInt(limit), parseInt(offset)]
    );
    const countRow = await dbGet('SELECT COUNT(*) as total FROM citizen_reports WHERE user_id=?', [req.user.user_id]);
    res.json({ total: countRow.total, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reports/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid image uploaded.' });
  res.json({ success: true, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

app.patch('/api/reports/:id/verify', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { admin_comments = 'Verified by administrator.' } = req.body;
    const reviewed_at = new Date().toISOString();
    const result = await dbRun(
      `UPDATE citizen_reports
       SET verification_status='Verified', admin_comments=?, admin_id=?, reviewed_at=?
       WHERE report_id=?`,
      [admin_comments, req.user.user_id, reviewed_at, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Report not found.' });

    // Award 20 bonus points to the reporter
    const report = await dbGet('SELECT user_id FROM citizen_reports WHERE report_id=?', [req.params.id]);
    if (report) {
      await dbRun(`UPDATE users SET points=COALESCE(CAST(points AS INTEGER),0)+20 WHERE user_id=?`, [report.user_id]);
    }
    res.json({ success: true, message: 'Report approved. +20 points awarded to reporter.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reports/:id/reject', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { admin_comments = 'Report does not meet verification standards.' } = req.body;
    if (!admin_comments || admin_comments.trim().length < 3) {
      return res.status(400).json({ error: 'A rejection reason is required.' });
    }
    const reviewed_at = new Date().toISOString();
    const result = await dbRun(
      `UPDATE citizen_reports
       SET verification_status='Rejected', admin_comments=?, admin_id=?, reviewed_at=?
       WHERE report_id=?`,
      [admin_comments, req.user.user_id, reviewed_at, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Report not found.' });
    res.json({ success: true, message: 'Report rejected with reason saved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN REPORT DETAIL ─────────────────────────────────────────────────────
// GET /api/admin/reports/stats  — admin stats overview
// GET /api/admin/reports/pending — admin pending list (alias)
// GET /api/admin/reports/:id    — full report detail for admin review

app.get('/api/admin/reports/stats', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      dbGet('SELECT COUNT(*) as c FROM citizen_reports'),
      dbGet("SELECT COUNT(*) as c FROM citizen_reports WHERE LOWER(verification_status)='pending'"),
      dbGet("SELECT COUNT(*) as c FROM citizen_reports WHERE LOWER(verification_status)='verified'"),
      dbGet("SELECT COUNT(*) as c FROM citizen_reports WHERE LOWER(verification_status)='rejected'")
    ]);
    res.json({
      total: total.c, pending: pending.c,
      approved: approved.c, rejected: rejected.c
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/reports/pending', authenticateToken, adminOnly, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT r.*, s.common_name, s.scientific_name, s.category,
             u.full_name as reporter_name, u.email as reporter_email,
             v.village_name
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN users u ON r.user_id=u.user_id
      LEFT JOIN villages v ON r.village_id=v.village_id
      WHERE LOWER(r.verification_status)='pending'
      ORDER BY r.submitted_at DESC, r.report_date DESC`);
    res.json({ total: rows.length, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/reports/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const row = await dbGet(`
      SELECT r.*, s.common_name, s.scientific_name, s.category, s.iucn_status, s.habitat,
             u.full_name as reporter_name, u.email as reporter_email, u.role as reporter_role,
             v.village_name,
             au.full_name as admin_name
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN users u ON r.user_id=u.user_id
      LEFT JOIN villages v ON r.village_id=v.village_id
      LEFT JOIN users au ON r.admin_id=au.user_id
      WHERE r.report_id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Report not found.' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 6. ENVIRONMENTAL THREATS ─────────────────────────────────────────────
// GET  /api/threats               - All threats with filters
// POST /api/threats               - Report a new threat (auth)
// PATCH /api/threats/:id/resolve  - Mark resolved (admin)
// GET  /api/threats/stats         - Threat statistics
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/threats', async (req, res) => {
  try {
    const { type, severity, resolved, limit=500, offset=0 } = req.query;
    let conditions = [], params = [];
    if (type)     { conditions.push('LOWER(threat_type)=?'); params.push(type.toLowerCase()); }
    if (severity) { conditions.push('LOWER(severity)=?');    params.push(severity.toLowerCase()); }
    if (resolved !== undefined) { conditions.push('LOWER(resolved)=?'); params.push(resolved.toLowerCase()); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await dbAll(`SELECT * FROM environmental_threats ${where} ORDER BY date DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
    const total = await dbGet(`SELECT COUNT(*) as count FROM environmental_threats ${where}`, params);
    res.json({ total: total.count, data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/threats/stats', async (req, res) => {
  try {
    const [total, active, critical, resolved] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM environmental_threats'),
      dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) NOT IN ('true','yes')"),
      dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(severity)='critical'"),
      dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) IN ('true','yes')")
    ]);
    res.json({ total: total.count, active: active.count, critical: critical.count, resolved: resolved.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/threats', authenticateToken, async (req, res) => {
  try {
    const { threat_type, severity, lat, lng, village_id, description } = req.body;
    if (!threat_type || !lat || !lng) return res.status(400).json({ error: 'threat_type, lat, lng required.' });

    const threat_id = 'TH' + Date.now().toString().slice(-6);
    const date = new Date().toISOString().split('T')[0];
    await dbRun(
      `INSERT INTO environmental_threats (threat_id,latitude,longitude,village_id,threat_type,severity,date,description,resolved) VALUES (?,?,?,?,?,?,?,?,'False')`,
      [threat_id, lat, lng, village_id||'', threat_type, severity||'Moderate', date, description||'']
    );
    res.status(201).json({ success: true, threat_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/threats/:id/resolve', authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await dbRun(`UPDATE environmental_threats SET resolved='True' WHERE threat_id=?`, [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Threat not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 7. WATER BODIES ──────────────────────────────────────────────────────
// GET /api/water-bodies           - All water bodies
// GET /api/water-bodies/:id       - Single water body
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/water-bodies', async (req, res) => {
  try {
    const { quality, limit=200 } = req.query;
    let sql = 'SELECT * FROM water_bodies';
    let params = [];
    if (quality) { sql += ' WHERE LOWER(water_quality)=?'; params.push(quality.toLowerCase()); }
    sql += ` LIMIT ?`; params.push(parseInt(limit));
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/water-bodies/stats', async (req, res) => {
  try {
    const [total, excellent, highBio, highPoll] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM water_bodies'),
      dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE LOWER(water_quality)='excellent'"),
      dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE CAST(biodiversity_score AS REAL)>=7"),
      dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE LOWER(pollution_level) IN ('high','severe')")
    ]);
    res.json({ total: total.count, excellent: excellent.count, high_biodiversity: highBio.count, high_pollution: highPoll.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 8. CONSERVATION PROJECTS ─────────────────────────────────────────────
// GET  /api/conservation               - All projects
// GET  /api/conservation/:id           - Single project
// PATCH /api/conservation/:id/status   - Update status (admin)
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/conservation', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM conservation_projects';
    let params = [];
    if (status) { sql += ' WHERE LOWER(status)=?'; params.push(status.toLowerCase()); }
    sql += ' ORDER BY start_date DESC';
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/conservation/:id/status', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Active', 'Completed', 'On Hold', 'Proposed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const result = await dbRun(`UPDATE conservation_projects SET status=? WHERE project_id=?`, [status, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Project not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 9. DASHBOARD & ANALYTICS ─────────────────────────────────────────────
// GET /api/dashboard/stats         - KPI cards
// GET /api/dashboard/recent-obs    - Recent observations
// GET /api/analytics/kpis          - Extended analytics
// GET /api/analytics/monthly       - Monthly trends
// GET /api/analytics/species-dist  - Species distribution
// GET /api/analytics/health-score  - Biodiversity health score
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [species, observations, reports, threats, users, pendingReports, verifiedReports, activeThreats] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM species_master'),
      dbGet('SELECT COUNT(*) as count FROM species_observations'),
      dbGet('SELECT COUNT(*) as count FROM citizen_reports'),
      dbGet('SELECT COUNT(*) as count FROM environmental_threats'),
      dbGet('SELECT COUNT(*) as count FROM users'),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE LOWER(verification_status)='pending'"),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE LOWER(verification_status)='verified'"),
      dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) NOT IN ('true','yes')")
    ]);

    res.json({
      species_count:      species.count,
      observations_count: observations.count,
      reports_count:      reports.count,
      threats_count:      threats.count,
      users_count:        users.count,
      pending_reports:    pendingReports.count,
      verified_reports:   verifiedReports.count,
      active_threats:     activeThreats.count
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/recent-observations', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT o.*, s.common_name, s.scientific_name, s.category, s.iucn_status, s.habitat
      FROM species_observations o
      LEFT JOIN species_master s ON o.species_id=s.species_id
      ORDER BY o.observation_date DESC LIMIT 15
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/monthly', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM monthly_species_statistics ORDER BY year DESC, CAST(month AS INTEGER) DESC LIMIT 24`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/species-distribution', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT category, COUNT(*) as count FROM species_master GROUP BY category ORDER BY count DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/iucn-distribution', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT iucn_status, COUNT(*) as count FROM species_master GROUP BY iucn_status ORDER BY count DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/top-species', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT o.species_id, s.common_name, s.scientific_name, s.category, COUNT(*) as obs_count
      FROM species_observations o
      LEFT JOIN species_master s ON o.species_id=s.species_id
      GROUP BY o.species_id ORDER BY obs_count DESC LIMIT 15
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/health-score', async (req, res) => {
  try {
    // Biodiversity Health Score (BHS) formula:
    // BHS = (verified_ratio * 40) + (species_richness_score * 30) + (threat_ratio_score * 30)
    const [totalObs, verifiedObs, totalSpecies, activeThreats, totalThreats] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM species_observations'),
      dbGet("SELECT COUNT(*) as count FROM species_observations WHERE LOWER(verified)='true'"),
      dbGet('SELECT COUNT(*) as count FROM species_master'),
      dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) NOT IN ('true','yes')"),
      dbGet('SELECT COUNT(*) as count FROM environmental_threats')
    ]);

    const verifiedRatio = totalObs.count > 0 ? (verifiedObs.count / totalObs.count) : 0;
    const speciesScore  = Math.min(totalSpecies.count / 500, 1.0); // Max at 500 species
    const threatScore   = totalThreats.count > 0 ? (1 - activeThreats.count / totalThreats.count) : 1;
    const bhs = Math.round((verifiedRatio * 40) + (speciesScore * 30) + (threatScore * 30));

    res.json({
      score: bhs,
      label: bhs >= 80 ? 'Excellent' : bhs >= 60 ? 'Good' : bhs >= 40 ? 'Moderate' : 'Critical',
      components: {
        verified_ratio: Math.round(verifiedRatio * 100),
        species_richness: totalSpecies.count,
        active_threats: activeThreats.count
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 10. GIS ENDPOINTS (GeoJSON) ──────────────────────────────────────────
// GET /api/gis/observations        - Observations as GeoJSON
// GET /api/gis/hotspots            - Hotspots as GeoJSON
// GET /api/gis/threats             - Threats as GeoJSON
// GET /api/gis/water-bodies        - Water bodies as GeoJSON
// GET /api/gis/villages            - Villages as GeoJSON
// ══════════════════════════════════════════════════════════════════════════

function toGeoJSON(rows, latField='latitude', lngField='longitude') {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter(r => r[latField] && r[lngField])
      .map(r => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(r[lngField]), parseFloat(r[latField])]
        },
        properties: { ...r }
      }))
  };
}

app.get('/api/gis/observations', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
    const rows = await dbAll(`
      SELECT o.observation_id, o.latitude, o.longitude, o.observation_date, o.individual_count,
             o.health_status, o.verified, s.common_name, s.scientific_name, s.category
      FROM species_observations o LEFT JOIN species_master s ON o.species_id=s.species_id
      ORDER BY o.observation_date DESC LIMIT ?
    `, [limit]);
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gis/hotspots', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM biodiversity_hotspots');
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gis/threats', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM environmental_threats ORDER BY date DESC LIMIT 500');
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gis/water-bodies', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM water_bodies');
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gis/villages', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM villages');
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gis/citizen-reports', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT r.report_id, r.latitude, r.longitude, r.report_date, r.verification_status,
             s.common_name, s.category
      FROM citizen_reports r LEFT JOIN species_master s ON r.species_id=s.species_id
      ORDER BY r.report_date DESC LIMIT 500
    `);
    res.json(toGeoJSON(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 11. NDVI & WEATHER ───────────────────────────────────────────────────
// GET /api/ndvi                   - Paginated NDVI data
// GET /api/ndvi/summary           - NDVI averages & distribution
// GET /api/weather                - Weather records
// GET /api/weather/summary        - Weather statistics
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/ndvi', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
    const rows = await dbAll(`SELECT * FROM ndvi_data ORDER BY date DESC LIMIT ?`, [limit]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ndvi/summary', async (req, res) => {
  try {
    const stats = await dbGet(`SELECT AVG(CAST(ndvi_value AS REAL)) as avg, MAX(CAST(ndvi_value AS REAL)) as max, MIN(CAST(ndvi_value AS REAL)) as min, COUNT(*) as count FROM ndvi_data`);
    const dist  = await dbAll(`SELECT vegetation_health, COUNT(*) as count FROM ndvi_data GROUP BY vegetation_health`);
    res.json({ stats, distribution: dist });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/weather', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 365, 3659);
    const rows = await dbAll(`SELECT * FROM weather ORDER BY date DESC LIMIT ?`, [limit]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/weather/summary', async (req, res) => {
  try {
    const stats = await dbGet(`
      SELECT AVG(CAST(temp_max AS REAL)) as avg_temp_max,
             AVG(CAST(temp_min AS REAL)) as avg_temp_min,
             SUM(CAST(rainfall AS REAL)) as total_rainfall,
             AVG(CAST(humidity AS REAL)) as avg_humidity,
             AVG(CAST(wind_speed AS REAL)) as avg_wind_speed
      FROM weather
    `);
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 12. USER PROFILE & LEADERBOARD ───────────────────────────────────────
// GET  /api/users/profile         - Own profile (auth)
// PUT  /api/users/profile         - Update profile (auth)
// GET  /api/leaderboard           - Top users ranked by points
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT user_id,full_name,email,role,village_id,points,reports_submitted,badges,join_date FROM users WHERE user_id=?`,
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Attach their reports summary
    const [myReports, myVerified] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM citizen_reports WHERE user_id=?', [user.user_id]),
      dbGet("SELECT COUNT(*) as count FROM citizen_reports WHERE user_id=? AND LOWER(verification_status)='verified'", [user.user_id])
    ]);
    user.my_reports = myReports.count;
    user.my_verified = myVerified.count;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 13. ADMIN ENDPOINTS ──────────────────────────────────────────────────
// GET  /api/admin/users           - All users (admin)
// GET  /api/admin/summary         - Full system summary
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/users', authenticateToken, adminOnly, async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT user_id,full_name,email,role,village_id,points,reports_submitted,badges,join_date FROM users ORDER BY join_date DESC`
    );
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/summary', authenticateToken, adminOnly, async (req, res) => {
  try {
    const tables = ['species_master','species_observations','citizen_reports','users','environmental_threats','water_bodies','conservation_projects','villages'];
    const counts = {};
    for (const t of tables) {
      const r = await dbGet(`SELECT COUNT(*) as count FROM "${t}"`);
      counts[t] = r.count;
    }
    res.json({ tables: counts, admin: req.user.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 14. AI MOCK ENDPOINTS (for hackathon demo) ────────────────────────────
// POST /api/ai/identify-species   - Mock AI species identification
// ══════════════════════════════════════════════════════════════════════════

app.post('/api/ai/identify-species', authenticateToken, async (req, res) => {
  try {
    // Get 5 random birds/mammals as AI "results"
    const suggestions = await dbAll(
      `SELECT species_id, common_name, scientific_name, category, iucn_status, description FROM species_master
       WHERE category IN ('Birds','Mammals','Reptiles') ORDER BY RANDOM() LIMIT 5`
    );
    // Fake confidence scores
    const results = suggestions.map((s, i) => ({
      ...s,
      confidence: Math.round(90 - i * 12),
      ai_note: i === 0 ? 'Best match based on visual features' : 'Alternative possibility'
    }));
    res.json({
      status: 'success',
      model: 'BioScan-AI v1.0 (Demo)',
      results,
      disclaimer: 'AI identification is for reference only. Field verification recommended.'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ── 15. HEALTH CHECK ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Kopargaon Biodiversity Portal API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: 40
  });
});

// ── SPA Catch-all: serve index.html for non-API browser routes ────────────
app.use((req, res, next) => {
  // If it looks like an API path, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `Endpoint ${req.method} ${req.path} not found.` });
  }
  // For GET requests, serve the frontend index.html (SPA routing)
  if (req.method === 'GET') {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }
  next();
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  🌿 Kopargaon Biodiversity Portal — Backend API v2.0     ║
  ║  🚀 Running at: http://localhost:${PORT}                   ║
  ║  📊 Endpoints: 40+ REST APIs                             ║
  ║  🔐 Auth: JWT (email@kbic.in / admin@kbic.in)            ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
