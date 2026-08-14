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

  // ── Core Auth Actions ──────────────────────────────────────────────────

  /**
   * Attempt login. Returns { success, error, user }
   */
  async function login(email, password) {
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error || 'Login failed' };
      
      const sessionUser = { ...data.user, token: data.token };
      currentUser = sessionUser;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    } catch (e) {
      return { success: false, error: 'Network error connecting to server.' };
    }
  }

  /**
   * Register a new user. Returns { success, error, user }
   */
  async function register(fullName, email, password) {
    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password })
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error || 'Registration failed' };
      
      const sessionUser = { ...data.user, token: data.token };
      currentUser = sessionUser;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    } catch (e) {
      return { success: false, error: 'Network error connecting to server.' };
    }
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

  const ROLE_PERMISSIONS = {
    'Administrator': ['verify_citizen_reports'],
    'Admin': ['verify_citizen_reports'],
    'Citizen': ['submit_reports'],
    'Observer': ['submit_reports']
  };

  /**
   * Check if the current user has a specific permission based on their role
   */
  function hasPermission(permission) {
    const user = getUser();
    if (!user) return false;
    
    // Strict email-based permission for verification
    if (permission === 'verify_citizen_reports') {
      return user.email === 'admin@kbic.in';
    }

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
  function getToken()           { return currentUser?.token || null; }

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
    isAdmin, isForestOfficer, isLoggedIn, renderUserUI, hasPermission, getToken
  };
})();

window.Auth = Auth;
