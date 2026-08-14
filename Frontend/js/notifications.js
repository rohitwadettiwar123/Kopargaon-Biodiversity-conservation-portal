/**
 * notifications.js
 * Toast notification system and notification dropdown management
 */

const Notifications = (() => {

  // ── Toast System ────────────────────────────────────────────────────────

  function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(type, title, desc = '', duration = 4000) {
    const container = createToastContainer();
    const icons = {
      success: '<i class="fa fa-check-circle"></i>',
      warning: '<i class="fa fa-exclamation-triangle"></i>',
      error:   '<i class="fa fa-times-circle"></i>',
      info:    '<i class="fa fa-info-circle"></i>'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-text">
        <div class="toast-title">${title}</div>
        ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
      </div>
      <span class="toast-close" onclick="this.closest('.toast').remove()">
        <i class="fa fa-times"></i>
      </span>
    `;
    container.appendChild(toast);
    // Auto remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  const success = (title, desc, dur) => showToast('success', title, desc, dur);
  const warning = (title, desc, dur) => showToast('warning', title, desc, dur);
  const error   = (title, desc, dur) => showToast('error', title, desc, dur);
  const info    = (title, desc, dur) => showToast('info', title, desc, dur);

  // ── Notification Dropdown ───────────────────────────────────────────────

  const notificationData = [
    { id: 1, type: 'rare', icon: '🦚', iconColor: 'var(--green-primary)', title: 'Rare Species Sighted', desc: 'Indian Peafowl spotted near Godavari bank', time: '5 min ago', unread: true },
    { id: 2, type: 'threat', icon: '⚠️', iconColor: 'var(--accent-amber)', title: 'Threat Alert', desc: 'Encroachment reported near Chaskaon Grove', time: '22 min ago', unread: true },
    { id: 3, type: 'verify', icon: '✅', iconColor: 'var(--accent-blue)', title: 'Report Verified', desc: 'Your report CR00312 has been verified', time: '1 hr ago', unread: true },
    { id: 4, type: 'event', icon: '📅', iconColor: 'var(--accent-purple)', title: 'Conservation Event', desc: 'Tree Plantation Drive on 15 Aug at Loni', time: '2 hr ago', unread: false },
    { id: 5, type: 'edu', icon: '📚', iconColor: 'var(--accent-cyan)', title: 'New Educational Resource', desc: 'Added: Guide to Kopargaon Butterflies', time: '3 hr ago', unread: false },
    { id: 6, type: 'badge', icon: '🏆', iconColor: 'var(--accent-amber)', title: 'Achievement Unlocked!', desc: 'You earned the "Bird Watcher" badge', time: '1 day ago', unread: false },
  ];

  function renderNotifications() {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;

    const unreadCount = notificationData.filter(n => n.unread).length;

    // Update badge
    const badge = document.querySelector('.notif-badge');
    if (badge) badge.textContent = unreadCount;

    const list = dropdown.querySelector('.notif-list');
    if (!list) return;

    list.innerHTML = notificationData.map(n => `
      <div class="notif-item ${n.unread ? 'unread' : ''}" data-id="${n.id}">
        <div class="notif-icon" style="background: ${n.iconColor}20; color: ${n.iconColor}">
          ${n.icon}
        </div>
        <div class="notif-text">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-time">${n.time}</div>
        </div>
        ${n.unread ? '<div class="unread-dot"></div>' : ''}
      </div>
    `).join('');

    // Click to mark read
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        const notif = notificationData.find(n => n.id === id);
        if (notif) notif.unread = false;
        item.classList.remove('unread');
        item.querySelector('.unread-dot')?.remove();
        updateUnreadBadge();
      });
    });
  }

  function updateUnreadBadge() {
    const unreadCount = notificationData.filter(n => n.unread).length;
    const badge = document.querySelector('.notif-badge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
  }

  function markAllRead() {
    notificationData.forEach(n => n.unread = false);
    renderNotifications();
    updateUnreadBadge();
  }

  function init() {
    renderNotifications();

    // Mark all read button
    const markAllBtn = document.querySelector('.notif-mark-all');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', markAllRead);
    }
  }

  return { showToast, success, warning, error, info, init, renderNotifications, markAllRead };
})();

window.Notifications = Notifications;
window.showToast = Notifications.showToast;
