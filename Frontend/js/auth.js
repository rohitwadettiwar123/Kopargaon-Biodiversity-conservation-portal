/**
 * auth.js — Full Authentication System
 * Kopargaon Biodiversity Portal
 *
 * Features:
 *  - Email + password login (with demo accounts)
 *  - User registration (stored in localStorage)
 *  - Session persistence via sessionStorage
 *  - Page guard: redirects unauthenticated users to index.html
 *  - User profile rendering in header
 *  - Logout
 */

const Auth = (() => {
  const SESSION_KEY = 'kb_session';
  const USERS_KEY   = 'kb_users';

  // ── Built-in demo accounts ─────────────────────────────────────────────
  const DEMO_USERS = [
    {
      user_id: 'USR0001',
      full_name: 'Kalyani Patil',
      email: 'kalyani@kbic.in',
      password: 'biodiversity123',
      role: 'Observer',
      village_id: 'VLG001',
      points: '245',
      reports_submitted: '18',
      badges: 'Green Guardian,Bird Watcher',
      join_date: '2022-03-15',
    },
    {
      user_id: 'USR0002',
      full_name: 'Admin User',
      email: 'admin@kbic.in',
      password: 'admin123',
      role: 'Administrator',
      village_id: 'VLG001',
      points: '1200',
      reports_submitted: '85',
      badges: 'Biodiversity Champion,Nature Protector',
      join_date: '2021-01-01',
    },
    {
      user_id: 'USR0003',
      full_name: 'Ravi Deshpande',
      email: 'ravi@kbic.in',
      password: 'forest123',
      role: 'Forest Officer',
      village_id: 'VLG010',
      points: '820',
      reports_submitted: '31',
      badges: 'Bird Watcher,Nature Protector',
      join_date: '2021-06-20',
    },
  ];

  // ── Role & Permission Matrix ─────────────────────────────────────────────
  const ROLE_PERMISSIONS = {
    'Citizen': ['view_dashboard', 'submit_observation', 'submit_citizen_report'],
    'Observer': ['view_dashboard', 'submit_observation', 'submit_citizen_report'], // Alias for Citizen in demo data
    'Forest Officer': ['view_dashboard', 'submit_observation', 'submit_citizen_report', 'verify_observations', 'log_threats', 'resolve_threats', 'export_data'],
    'Researcher': ['view_dashboard', 'submit_observation', 'submit_citizen_report', 'export_data'],
    'Administrator': ['view_dashboard', 'submit_observation', 'submit_citizen_report', 'verify_observations', 'verify_citizen_reports', 'log_threats', 'resolve_threats', 'add_edit_species', 'manage_users', 'manage_projects', 'export_data', 'view_admin_panel']
  };

  let currentUser = null;

  // ── Helpers ────────────────────────────────────────────────────────────
  function _getAllUsers() {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      const registered = stored ? JSON.parse(stored) : [];
      return [...DEMO_USERS, ...registered];
    } catch { return [...DEMO_USERS]; }
  }

  function _getRegisteredUsers() {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  function _saveRegisteredUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function _genId() {
    return 'USR' + Date.now().toString().slice(-6);
  }

  // ── Core Auth Actions ──────────────────────────────────────────────────

  /**
   * Attempt login. Returns { success, error, user }
   */
  function login(email, password) {
    const users = _getAllUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim()
    );
    if (!user) return { success: false, error: 'No account found with this email.' };
    if (user.password !== password) return { success: false, error: 'Incorrect password.' };

    const sessionUser = { ...user };
    delete sessionUser.password; // Never store password in session
    currentUser = sessionUser;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  }

  /**
   * Register a new user. Returns { success, error, user }
   */
  function register(fullName, email, password) {
    const allUsers = _getAllUsers();
    const exists = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (exists) return { success: false, error: 'An account with this email already exists.' };
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
    if (!fullName.trim()) return { success: false, error: 'Please enter your full name.' };

    const newUser = {
      user_id: _genId(),
      full_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'Citizen',
      village_id: '',
      points: '0',
      reports_submitted: '0',
      badges: '',
      join_date: new Date().toISOString().slice(0, 10),
    };

    const registered = _getRegisteredUsers();
    registered.push(newUser);
    _saveRegisteredUsers(registered);

    // Auto-login after register
    const sessionUser = { ...newUser };
    delete sessionUser.password;
    currentUser = sessionUser;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  }

  function logout() {
    currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
    // Redirect to home (works for both root and /pages/ subfolders)
    const depth = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = depth + 'index.html';
  }

  // ── Session Restore ────────────────────────────────────────────────────
  function _restoreSession() {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        currentUser = JSON.parse(stored);
        return true;
      }
    } catch {}
    return false;
  }

  // ── Page Guard ─────────────────────────────────────────────────────────
  /**
   * Call this on every sub-page to protect it.
   * If not logged in, redirect to index.html immediately.
   */
  function guard() {
    if (!_restoreSession()) {
      const depth = window.location.pathname.includes('/pages/') ? '../' : '';
      sessionStorage.setItem('kb_redirect', window.location.href);
      window.location.replace(depth + 'index.html');
      return false;
    }
    return true;
  }

  /**
   * Check if the current user has a specific permission based on their role
   */
  function hasPermission(permission) {
    const user = getUser();
    if (!user) return false;
    const role = user.role || 'Observer';
    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Observer'];
    return perms.includes(permission);
  }

  // ── UI Rendering ───────────────────────────────────────────────────────
  function getUser()            { return currentUser; }
  function getUserInitials()    { const p = (currentUser?.full_name || 'U').split(' '); return (p[0][0] + (p[1]?.[0] || '')).toUpperCase(); }
  function getUserDisplayName() { return currentUser?.full_name?.split(' ')[0] || 'User'; }
  function getUserRole()        { return currentUser?.role || 'Citizen'; }
  function isAdmin()            { return ['administrator','admin'].includes(getUserRole().toLowerCase()); }
  function isForestOfficer()    { return ['forest officer'].includes(getUserRole().toLowerCase()) || isAdmin(); }
  function isLoggedIn()         { return !!currentUser; }

  function renderUserUI() {
    if (!currentUser) return;
    document.querySelectorAll('.user-avatar').forEach(el => el.textContent = getUserInitials());
    document.querySelectorAll('.user-name').forEach(el => el.textContent = getUserDisplayName());
    document.querySelectorAll('.user-role').forEach(el => el.textContent = getUserRole());
    // Also update nav-user-name if it exists (index.html navbar)
    const navName = document.getElementById('nav-user-name');
    if (navName) navName.textContent = getUserDisplayName();
    const navProfile = document.getElementById('nav-user-profile');
    if (navProfile) navProfile.style.display = 'flex';
  }

  // ── Init (called by app.js on sub-pages) ──────────────────────────────
  function init() {
    _restoreSession();
    renderUserUI();
    // Wire logout buttons
    document.querySelectorAll('#logout-dropdown-btn, .logout-btn').forEach(btn => {
      btn.addEventListener('click', logout);
    });
    return currentUser;
  }

  return {
    init, guard, login, register, logout,
    getUser, getUserInitials, getUserDisplayName, getUserRole,
    isAdmin, isForestOfficer, isLoggedIn, renderUserUI, hasPermission
  };
})();

window.Auth = Auth;
