/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   KOPARGAON BIODIVERSITY CONSERVATION PORTAL — BACKEND API      ║
 * ║   Complete Production-Grade REST API with 40+ Endpoints          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Modules: Auth, Species, Observations, Citizen Reports, Threats,
 *          Water Bodies, Conservation, Leaderboard, Dashboard,
 *          Analytics, GIS, File Upload, Admin, NDVI
 */

const express    = require('express');
const path       = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cors       = require('cors');
const sqlite3    = require('sqlite3').verbose();
const { checkImageAuthenticity } = require('./services/image-authenticity');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcrypt');
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

// -- Blackout Simulation Interceptor ------------------------------------------
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/recovery/') || req.path.startsWith('/auth/')) return next();
  const recState = require('./recovery/recovery-state');
  if (recState.getState() === 'BLACKOUT') {
    return res.status(503).json({ error: 'Data temporarily unavailable because the primary database is offline.' });
  }
  next();
});

// ── Config ──────────────────────────────────────────────────────────────────
const DB_SOURCE = path.join(__dirname, 'database.sqlite');
let DB_PATH = DB_SOURCE;
let UPLOADS_DIR = path.join(__dirname, 'uploads');

if (process.env.VERCEL) {
  DB_PATH = path.join('/tmp', 'database.sqlite');
  UPLOADS_DIR = path.join('/tmp', 'uploads');
  if (!fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_SOURCE, DB_PATH);
  }
}

const JWT_SECRET = 'kbic-kopargaon-biodiversity-secret-2026';
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

// ── RBAC: Role & Permission System ─────────────────────────────────────────
// Role hierarchy (highest → lowest privilege)
const ROLES = {
  super_admin:   'super_admin',
  water_admin:   'water_admin',
  threat_admin:  'threat_admin',
  Administrator: 'Administrator',
  'Forest Officer': 'Forest Officer',
  Observer:      'Observer',
  Citizen:       'Citizen',
};

// Permission map: which roles have which permissions
const ROLE_PERMISSION_MAP = {
  super_admin:      ['water_bodies.view','water_bodies.create','water_bodies.edit','water_bodies.delete',
                     'threats.view','threats.create','threats.edit','threats.delete',
                     'citizen_reports.verify','admin.access'],
  water_admin:      ['water_bodies.view','water_bodies.create','water_bodies.edit','water_bodies.delete',
                     'threats.view'],
  threat_admin:     ['threats.view','threats.create','threats.edit','threats.delete',
                     'water_bodies.view'],
  Administrator:    ['citizen_reports.verify','admin.access',
                     'water_bodies.view','threats.view'],
  'Forest Officer': ['water_bodies.view','threats.view'],
  Observer:         ['water_bodies.view','threats.view'],
  Citizen:          ['water_bodies.view','threats.view'],
};

/**
 * Middleware: require that the authenticated user has one of the given roles.
 * Usage: requireRole('super_admin', 'water_admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
    // super_admin email check for backward compat
    const userRole = req.user.role || '';
    if (roles.includes(userRole) || req.user.email === 'admin@kbic.in' && roles.includes('super_admin')) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access Restricted. Required role: ${roles.join(' or ')}.`
    });
  };
}

/**
 * Middleware: require a specific named permission.
 * Usage: requirePermission('water_bodies.edit')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    // super_admin (by email) gets everything
    if (req.user.email === 'admin@kbic.in') return next();

    const userRole = req.user.role || 'Citizen';
    const perms = ROLE_PERMISSION_MAP[userRole] || ROLE_PERMISSION_MAP['Citizen'];

    if (perms.includes(permission)) return next();

    // Friendly error messages per resource
    let message = `You do not have permission to perform this action.`;
    if (permission.startsWith('water_bodies.')) {
      message = 'You do not have permission to manage water bodies. Only Zilla Parishad or Super Admin can perform this action.';
    } else if (permission.startsWith('threats.')) {
      message = 'You do not have permission to manage environmental threats. Only Municipal Corporation or Super Admin can perform this action.';
    } else if (permission === 'citizen_reports.verify') {
      message = 'Only administrators can verify citizen reports.';
    }

    return res.status(403).json({ success: false, message });
  };
}

/**
 * Audit log helper — fire-and-forget, never blocks request.
 */
async function auditLog(userId, role, action, resourceType, resourceId) {
  try {
    await dbRun(
      `INSERT INTO audit_logs (user_id, role, action, resource_type, resource_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || 'unknown', role || 'unknown', action, resourceType, resourceId || '', new Date().toISOString()]
    );
  } catch (e) {
    // Never let audit failures crash the request
    console.error('[AUDIT] Failed to log:', e.message);
  }
}


// ══════════════════════════════════════════════════════════════════════════
// ── RBAC: DB init + Demo Account Seeding ───────────────────────────────────
// Creates audit_logs table and demo accounts if they don't already exist.
// Uses INSERT OR IGNORE — completely safe to run on every server start.
(async () => {
  try {
    // 1. Create audit_logs table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT    NOT NULL,
        role         TEXT    NOT NULL,
        action       TEXT    NOT NULL,
        resource_type TEXT   NOT NULL,
        resource_id  TEXT    DEFAULT '',
        timestamp    TEXT    NOT NULL
      )
    `);
    console.log('✅ audit_logs table ready');

    // Ensure image authenticity fields exist in citizen_reports
    const addColumn = async (table, col, type) => {
      try {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        console.log(`[DB] Added column ${col} to ${table}`);
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.warn(`[DB] Could not add column ${col} to ${table}: ${e.message}`);
        }
      }
    };

    await addColumn('citizen_reports', 'image_auth_status', 'TEXT');
    await addColumn('citizen_reports', 'image_ai_probability', 'REAL');
    await addColumn('citizen_reports', 'image_auth_checked_at', 'TEXT');
    await addColumn('citizen_reports', 'image_auth_requires_review', 'INTEGER');
    await addColumn('users', 'creator_code', 'TEXT');

    await dbRun(`
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
    `);
    console.log('✅ creator_challenge_reels table ready');



    // 2. Seed Zilla Parishad (water_admin)
    const zillaExists = await dbGet("SELECT user_id FROM users WHERE email='zilla@kbic.in'");
    if (!zillaExists) {
      const hash = await bcrypt.hash('zilla123', 10);
      await dbRun(
        `INSERT INTO users (user_id, full_name, email, password, role, join_date, points, reports_submitted, badges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['USR_ZILLA', 'Zilla Parishad', 'zilla@kbic.in', hash, 'water_admin',
         new Date().toISOString().split('T')[0], 0, 0, 'Water Guardian']
      );
      console.log('✅ Demo account created: Zilla Parishad (water_admin)');
    }

    // 3. Seed Municipal Corporation (threat_admin)
    const muniExists = await dbGet("SELECT user_id FROM users WHERE email='municipal@kbic.in'");
    if (!muniExists) {
      const hash = await bcrypt.hash('municipal123', 10);
      await dbRun(
        `INSERT INTO users (user_id, full_name, email, password, role, join_date, points, reports_submitted, badges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['USR_MUNI', 'Municipal Corporation', 'municipal@kbic.in', hash, 'threat_admin',
         new Date().toISOString().split('T')[0], 0, 0, 'Threat Watcher']
      );
      console.log('✅ Demo account created: Municipal Corporation (threat_admin)');
    }

    // 4. Ensure Kalyani citizen demo account has unique user_id (USR_KALYANI)
    //    Fixes a potential collision with CSV-seeded USR0001 user
    const kalyaniExists = await dbGet("SELECT user_id FROM users WHERE email='kalyani@kbic.in'");
    if (!kalyaniExists) {
      const hash = await bcrypt.hash('biodiversity123', 10);
      await dbRun(
        `INSERT INTO users (user_id, full_name, email, password, role, join_date, points, reports_submitted, badges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['USR_KALYANI', 'Kalyani S.', 'kalyani@kbic.in', hash, 'Citizen',
         new Date().toISOString().split('T')[0], 0, 0, 'Citizen Reporter']
      );
      console.log('✅ Demo account created: Kalyani (Citizen)');
    } else if (kalyaniExists.user_id === 'USR0001') {
      // Fix collision: update to unique id
      await dbRun("UPDATE users SET user_id='USR_KALYANI' WHERE email='kalyani@kbic.in'");
      await dbRun("UPDATE citizen_reports SET user_id='USR_KALYANI' WHERE user_id='USR0001' AND submitted_at >= date('now','-7 days')");
      console.log('[CitizenReport] Fixed Kalyani user_id collision: USR0001 → USR_KALYANI');
    }
  } catch (e) {
    console.error('RBAC seed error:', e.message);
  }
})();

// ── RBAC: Permissions endpoint (frontend calls this to get its own perms) ──
// GET /api/rbac/my-permissions
// Returns the permission set for the authenticated user's role.
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
  'protected_areas','monthly_species_statistics','ndvi_data','educational_resources',
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
        AND u.rowid = (SELECT MAX(rowid) FROM users WHERE user_id=r.user_id)
      ${where}
      ORDER BY r.submitted_at DESC, r.report_date DESC
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
      SELECT r.*, s.common_name, s.scientific_name, s.category,
             u.full_name as reporter_name, u.email as reporter_email
      FROM citizen_reports r
      LEFT JOIN species_master s ON r.species_id=s.species_id
      LEFT JOIN users u ON r.user_id=u.user_id
        AND u.rowid = (SELECT MAX(rowid) FROM users WHERE user_id=r.user_id)
      WHERE LOWER(r.verification_status)='pending'
      ORDER BY r.submitted_at DESC, r.report_date DESC
    `);
    console.log('[AdminReports] Fetching reports');
    console.log('[AdminReports] Reports returned:', rows.length);
    if (rows.length > 0) console.log('[AdminReports] Latest report ID:', rows[0].report_id);
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
    const { species, lat, lng, desc, village_id, report_time, count, image_auth_status, image_ai_probability, image_auth_requires_review } = req.body;
    if (!species || !lat || !lng || !desc) return res.status(400).json({ error: 'species, lat, lng, desc are required.' });

    const report_id    = 'CR' + Date.now().toString().slice(-6);
    const user_id      = req.user.user_id;
    const report_date  = new Date().toISOString().split('T')[0];
    const submitted_at = new Date().toISOString();
    // ALWAYS force Pending — users cannot self-approve
    const verification_status = 'Pending';
      
      const opQueue = require('./recovery/operation-queue');
      const recState = require('./recovery/recovery-state');
      
      if (recState.getState() === 'BLACKOUT') {
        opQueue.addOperation({
          operation_id: report_id,
          type: 'CITIZEN_REPORT',
          status: 'PENDING',
          created_at: submitted_at,
          payload: { user_id, species, lat, lng, desc, village_id, report_time, count, image_auth_status, image_ai_probability, image_auth_requires_review, report_date, submitted_at }
        });
        return res.status(201).json({ success: true, report_id, message: 'System blackout detected. Your operation has been safely queued and will be synchronized when the system is restored.' });
      }

      opQueue.addOperation({
        operation_id: report_id,
        type: 'CITIZEN_REPORT',
        status: 'PENDING',
        created_at: submitted_at,
        payload: { user_id, species, lat, lng, desc, village_id, report_time, count, image_auth_status, image_ai_probability, image_auth_requires_review, report_date, submitted_at }
      });

      try {
        await dbRun(
      `INSERT INTO citizen_reports
         (report_id, user_id, species_id, latitude, longitude, report_date, report_time,
          remarks, verification_status, admin_comments, village_id, count, submitted_at,
          image_auth_status, image_ai_probability, image_auth_checked_at, image_auth_requires_review)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [report_id, user_id, species, lat, lng, report_date,
       report_time || '', desc, verification_status, '', village_id || '', parseInt(count)||1, submitted_at,
       image_auth_status || null, image_ai_probability !== undefined ? image_ai_probability : null,
       image_auth_status ? submitted_at : null, image_auth_requires_review ? 1 : 0]
        );
        opQueue.updateOperationStatus(report_id, 'COMPLETED');
      } catch (err) { throw err; }

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

app.post('/api/citizen-reports/check-image-authenticity', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No valid image uploaded.' });
  
  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  const result = await checkImageAuthenticity(filePath);
  
  res.json(result);
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
        AND u.rowid = (SELECT MAX(rowid) FROM users WHERE user_id=r.user_id)
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

app.post('/api/threats', authenticateToken, requirePermission('threats.create'), async (req, res) => {
  try {
    const { threat_type, severity, lat, lng, village_id, description } = req.body;
    if (!threat_type || !lat || !lng) return res.status(400).json({ error: 'threat_type, lat, lng required.' });

    const threat_id = 'TH' + Date.now().toString().slice(-6);
    const date = new Date().toISOString().split('T')[0];
    await dbRun(
      `INSERT INTO environmental_threats (threat_id,latitude,longitude,village_id,threat_type,severity,date,description,resolved) VALUES (?,?,?,?,?,?,?,?,'False')`,
      [threat_id, lat, lng, village_id||'', threat_type, severity||'Moderate', date, description||'']
    );
    auditLog(req.user.user_id, req.user.role, 'CREATE', 'threat', threat_id);
    res.status(201).json({ success: true, threat_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/threats/:id', authenticateToken, requirePermission('threats.edit'), async (req, res) => {
  try {
    const { threat_type, severity, description, resolved, village_id, lat, lng } = req.body;
    const result = await dbRun(
      `UPDATE environmental_threats SET
         threat_type=COALESCE(?,threat_type),
         severity=COALESCE(?,severity),
         description=COALESCE(?,description),
         resolved=COALESCE(?,resolved),
         village_id=COALESCE(?,village_id),
         latitude=COALESCE(?,latitude),
         longitude=COALESCE(?,longitude)
       WHERE threat_id=?`,
      [threat_type||null, severity||null, description||null, resolved||null,
       village_id||null, lat||null, lng||null, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Threat not found.' });
    auditLog(req.user.user_id, req.user.role, 'EDIT', 'threat', req.params.id);
    res.json({ success: true, message: 'Threat updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/threats/:id/resolve', authenticateToken, requirePermission('threats.edit'), async (req, res) => {
  try {
    const result = await dbRun(`UPDATE environmental_threats SET resolved='True' WHERE threat_id=?`, [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Threat not found.' });
    auditLog(req.user.user_id, req.user.role, 'RESOLVE', 'threat', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/threats/:id', authenticateToken, requirePermission('threats.delete'), async (req, res) => {
  try {
    const result = await dbRun(`DELETE FROM environmental_threats WHERE threat_id=?`, [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Threat not found.' });
    auditLog(req.user.user_id, req.user.role, 'DELETE', 'threat', req.params.id);
    res.json({ success: true, message: 'Threat deleted.' });
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

app.get('/api/water-bodies/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM water_bodies WHERE waterbody_id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Water body not found.' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/water-bodies', authenticateToken, requirePermission('water_bodies.create'), async (req, res) => {
  try {
    const { name, type, village_id, area_sqkm, depth_m, water_quality, biodiversity_score, pollution_level, lat, lng } = req.body;
    if (!name) return res.status(400).json({ error: 'Water body name is required.' });
    const wb_id = 'WB' + Date.now().toString().slice(-6);
    await dbRun(
      `INSERT INTO water_bodies (waterbody_id, name, type, village_id, area_sqkm, depth_m, water_quality, biodiversity_score, pollution_level, latitude, longitude, last_inspection)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [wb_id, name, type||'Lake', village_id||'', area_sqkm||'0', depth_m||'0',
       water_quality||'Good', biodiversity_score||'5', pollution_level||'Low',
       lat||'', lng||'', new Date().toISOString().split('T')[0]]
    );
    auditLog(req.user.user_id, req.user.role, 'CREATE', 'water_body', wb_id);
    res.status(201).json({ success: true, waterbody_id: wb_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/water-bodies/:id', authenticateToken, requirePermission('water_bodies.edit'), async (req, res) => {
  try {
    const { name, type, area_sqkm, depth_m, water_quality, biodiversity_score, pollution_level, lat, lng } = req.body;
    const result = await dbRun(
      `UPDATE water_bodies SET
         name=COALESCE(?,name),
         type=COALESCE(?,type),
         area_sqkm=COALESCE(?,area_sqkm),
         depth_m=COALESCE(?,depth_m),
         water_quality=COALESCE(?,water_quality),
         biodiversity_score=COALESCE(?,biodiversity_score),
         pollution_level=COALESCE(?,pollution_level),
         latitude=COALESCE(?,latitude),
         longitude=COALESCE(?,longitude),
         last_inspection=?
       WHERE waterbody_id=?`,
      [name||null, type||null, area_sqkm||null, depth_m||null, water_quality||null,
       biodiversity_score||null, pollution_level||null, lat||null, lng||null,
       new Date().toISOString().split('T')[0], req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Water body not found.' });
    auditLog(req.user.user_id, req.user.role, 'EDIT', 'water_body', req.params.id);
    res.json({ success: true, message: 'Water body updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/water-bodies/:id', authenticateToken, requirePermission('water_bodies.delete'), async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM water_bodies WHERE waterbody_id=?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Water body not found.' });
    auditLog(req.user.user_id, req.user.role, 'DELETE', 'water_body', req.params.id);
    res.json({ success: true, message: 'Water body deleted.' });
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
// ── 11. NDVI ───────────────────────────────────────────────────────────
// GET /api/ndvi                   - Paginated NDVI data
// GET /api/ndvi/summary           - NDVI averages & distribution
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
    const stats = await dbGet(`SELECT AVG(CAST(ndvi AS REAL)) as avg, MAX(CAST(ndvi AS REAL)) as max, MIN(CAST(ndvi AS REAL)) as min, COUNT(*) as count FROM ndvi_data`);
    const dist  = await dbAll(`SELECT vegetation_health, COUNT(*) as count FROM ndvi_data GROUP BY vegetation_health`);
    res.json({ stats, distribution: dist });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ndvi/ml-insights', (req, res) => {
  const { exec } = require('child_process');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'services', 'ndvi_ml.py');
  
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('Python error:', error);
      return res.status(500).json({ error: 'Failed to run ML models', details: stderr || error.message });
    }
    try {
      const result = JSON.parse(stdout);
      if (result.error === 'MODELS_MISSING') {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Invalid output from ML models', stdout });
    }
  });
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

// ══════════════════════════════════════════════════════════════════════════
// ── RBAC ENDPOINTS ───────────────────────────────────────────────────────
// GET /api/rbac/my-permissions   - My permissions (auth)
// GET /api/rbac/audit-logs       - Audit log (super_admin / admin only)
// GET /api/rbac/dashboard-context - Role-specific dashboard widgets
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/rbac/my-permissions', authenticateToken, (req, res) => {
  const role = req.user.role || 'Citizen';
  // super_admin by email gets all permissions
  const effectiveRole = req.user.email === 'admin@kbic.in' ? 'super_admin' : role;
  const perms = ROLE_PERMISSION_MAP[effectiveRole] || ROLE_PERMISSION_MAP['Citizen'];
  res.json({
    user_id:     req.user.user_id,
    role:        effectiveRole,
    displayName: req.user.full_name,
    permissions: perms
  });
});

app.get('/api/rbac/audit-logs', authenticateToken, requirePermission('admin.access'), async (req, res) => {
  try {
    const { limit = 100, resource_type } = req.query;
    let sql = 'SELECT * FROM audit_logs';
    let params = [];
    if (resource_type) { sql += ' WHERE resource_type=?'; params.push(resource_type); }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    // Also allow water_admin and threat_admin to see their own logs
    const userRole = req.user.role;
    if (userRole === 'water_admin') {
      sql = `SELECT * FROM audit_logs WHERE user_id=? ORDER BY timestamp DESC LIMIT ?`;
      params = [req.user.user_id, parseInt(limit)];
    } else if (userRole === 'threat_admin') {
      sql = `SELECT * FROM audit_logs WHERE user_id=? ORDER BY timestamp DESC LIMIT ?`;
      params = [req.user.user_id, parseInt(limit)];
    }
    const logs = await dbAll(sql, params);
    res.json({ total: logs.length, data: logs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rbac/dashboard-context', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role || 'Citizen';
    const effectiveRole = req.user.email === 'admin@kbic.in' ? 'super_admin' : role;
    let context = { role: effectiveRole, widgets: [] };

    if (effectiveRole === 'water_admin') {
      const [total, excellent, highBio, highPoll] = await Promise.all([
        dbGet('SELECT COUNT(*) as count FROM water_bodies'),
        dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE LOWER(water_quality)='excellent'"),
        dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE CAST(biodiversity_score AS REAL)>=7"),
        dbGet("SELECT COUNT(*) as count FROM water_bodies WHERE LOWER(pollution_level) IN ('high','severe')")
      ]);
      context.widgets.push({
        type: 'water_bodies',
        title: 'Water Body Management',
        stats: {
          total: total.count,
          excellent_quality: excellent.count,
          high_biodiversity: highBio.count,
          at_risk: highPoll.count
        }
      });
    }

    if (effectiveRole === 'threat_admin') {
      const [total, active, critical, resolved] = await Promise.all([
        dbGet('SELECT COUNT(*) as count FROM environmental_threats'),
        dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) NOT IN ('true','yes')"),
        dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(severity)='critical'"),
        dbGet("SELECT COUNT(*) as count FROM environmental_threats WHERE LOWER(resolved) IN ('true','yes')")
      ]);
      context.widgets.push({
        type: 'threats',
        title: 'Threat Management',
        stats: {
          total: total.count,
          active: active.count,
          critical: critical.count,
          resolved: resolved.count
        }
      });
    }

    res.json(context);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    
    await dbRun(`
      INSERT INTO creator_challenge_reels 
      (id, user_id, title, category, description, village, recording_date, social_platform, social_url, creator_code, original_content, file_name, file_path, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    const data = await dbAll(`
      SELECT u.user_id, u.full_name as creator, u.points, u.creator_code, 
             COUNT(r.id) as approved_reels 
      FROM users u
      JOIN creator_challenge_reels r ON u.user_id = r.user_id
      WHERE r.status = 'APPROVED'
      GROUP BY u.user_id
      ORDER BY CAST(u.points AS INTEGER) DESC
      LIMIT 50
    `);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/creator-challenge', authenticateToken, adminOnly, async (req, res) => {
  try {
    const reels = await dbAll(`
      SELECT r.*, u.full_name as reporter_name, u.email as reporter_email 
      FROM creator_challenge_reels r
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.created_at DESC
    `);
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

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
require('./recovery/api')(app, db, authenticateToken, adminOnly);
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

