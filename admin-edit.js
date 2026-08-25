/* ══ SHARED ADMIN EDIT HELPERS ══ */

// Auth guard
if (localStorage.getItem('adminLoggedIn') !== 'true') {
  window.location.href = 'admin-login.html';
}

function authHeaders(json) {
  const h = { 'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '') };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function apiGet(url) {
  const res = await fetch(url, { headers: authHeaders()