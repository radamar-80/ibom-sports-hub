/* ══ SHARED ADMIN EDIT HELPERS ══ */

// Auth guard. The page includes admin-auth.js before this file.
adminRequireSession();

function authHeaders(json) {
  const h = { 'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '') };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function apiGet(url) {
  const res = await fetch(url, { headers: authHeaders()