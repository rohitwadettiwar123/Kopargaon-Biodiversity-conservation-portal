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
      const response = await fetch((window.location.hostname === 'localhost' || window.location.protocol === 'file:') ? 'http://localhost:3000/api/auth/login' : '/api/auth/login', {
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
      const response = await fetch((window.location.hostname === 'localhost' || window.location.protocol === 'file:') ? 'http://localhost:3000/api/auth/register' : '/api/auth/register', {
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

  // ── RBAC Role + Permission Map ─────────────────────────────────────────
  const ROLE_PERMISSION_MAP = {
    super_admin:      ['water_bodies.view','water_bodies.create','water_bodies.edit','water_bodies.delete',
                       'threats.view','threats.create','threats.edit','threats.delete',
                       'citizen_reports.verify','admin.access'],
    water_admin:      ['water_bodies.view','water_bodies.create','water_bodies.edit','water_bodies.delete',
                       'threats.view'],
    threat_admin:     ['threats.view','threats.create','threats.edit','threats.delete',
                       'water_bodies.view'],
    Administrator:    ['citizen_reports.verify','admin.access','water_bodies.view','threats.view'],
    'Forest Officer': ['water_bodies.view','threats.view'],
    Observer:         ['water_bodies.view','threats.view'],
    Citizen:          ['water_bodies.view','threats.view'],
  };

  // Legacy map kept for backward compatibility
  const ROLE_PERMISSIONS = {
    'Administrator': ['verify_citizen_reports'],
    'Admin': ['verify_citizen_reports'],
    'Citizen': ['submit_reports'],
    'Observer': ['submit_reports']
  };

  /**
   * Returns effective role string — treats admin@kbic.in as super_admin
   */
  function _effectiveRole() {
    const user = getUser();
    if (!user) return 'Citizen';
    if (user.email === 'admin@kbic.in') return 'super_admin';
    return user.role || 'Citizen';
  }

  /** Check if user has a named permission (e.g. 'water_bodies.edit') */
  function hasPermission(permission) {
    const user = getUser();
    if (!user) return false;
    // Legacy support
    if (permission === 'verify_citizen_reports') return user.email === 'admin@kbic.in';
    const role = _effectiveRole();
    const perms = ROLE_PERMISSION_MAP[role] || ROLE_PERMISSION_MAP['Citizen'];
    return perms.includes(permission);
  }

  /** Check if user has one of the given roles */
  function hasRole(...roles) {
    return roles.includes(_effectiveRole());
  }

  /** Quick helpers for the two new feature roles */
  function canEditWaterBodies() { return hasPermission('water_bodies.edit'); }
  function canEditThreats()     { return hasPermission('threats.edit'); }
  function isSuperAdmin()       { return _effectiveRole() === 'super_admin'; }

  /** Returns a small styled role badge HTML string */
  function getRoleBadgeHTML() {
    const role = _effectiveRole();
    const BADGE_CONFIG = {
      super_admin:      { label: 'SUPER ADMIN',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: '👑' },
      water_admin:      { label: 'WATER ADMIN',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: '💧' },
      threat_admin:     { label: 'THREAT ADMIN',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '⚠️' },
      Administrator:    { label: 'ADMIN',          color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   icon: '🛡️' },
      'Forest Officer': { label: 'FOREST OFFICER', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🌲' },
      Observer:         { label: 'OBSERVER',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: '👁️' },
      Citizen:          { label: 'CITIZEN',        color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: '👤' },
    };
    const cfg = BADGE_CONFIG[role] || BADGE_CONFIG['Citizen'];
    return `<span class="role-badge" style="
      display:inline-flex;align-items:center;gap:4px;
      padding:2px 8px;border-radius:12px;font-size:9px;font-weight:800;
      letter-spacing:0.5px;text-transform:uppercase;
      color:${cfg.color};background:${cfg.bg};border:1px solid ${cfg.color}44;
      margin-top:2px;line-height:1.6;
    ">${cfg.icon} ${cfg.label}</span>`;
  }

  function isAdmin()         { return ['super_admin','Administrator','Admin'].includes(_effectiveRole()); }
  function isForestOfficer() { return _effectiveRole() === 'Forest Officer' || isAdmin(); }

  function isLoggedIn()         { return !!currentUser; }
  function getToken()           { return currentUser?.token || null; }

  // Restored core user helpers
  function getUser()            { return currentUser; }
  function getUserInitials()    { const p = (currentUser?.full_name || 'U').split(' '); return (p[0][0] + (p[1]?.[0] || '')).toUpperCase(); }
  function getUserDisplayName() { return currentUser?.full_name?.split(' ')[0] || 'User'; }
  function getUserRole()        { return currentUser?.role || 'Citizen'; }

  function renderUserUI() {
    if (!currentUser) return;
    document.querySelectorAll('.user-avatar').forEach(el => el.textContent = getUserInitials());
    document.querySelectorAll('.user-name').forEach(el => el.textContent = getUserDisplayName());
    
    const roleText = getUserRole();
    const badgeHtml = getRoleBadgeHTML();
    
    document.querySelectorAll('.user-role').forEach(el => {
      // Clear out text and append plain text + badge HTML
      el.innerHTML = `${roleText} ${badgeHtml}`;
    });
    
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
    isAdmin, isForestOfficer, isLoggedIn, renderUserUI, hasPermission, getToken,
    // New RBAC helpers
    hasRole, canEditWaterBodies, canEditThreats, isSuperAdmin, getRoleBadgeHTML
  };
})();

window.Auth = Auth;
