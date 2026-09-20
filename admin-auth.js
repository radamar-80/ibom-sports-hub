/* Shared admin session handling for the multi-page admin dashboard. */
(function () {
  const TOKEN_KEY = "adminToken";
  const LOGGED_IN_KEY = "adminLoggedIn";
  const LAST_ACTIVITY_KEY = "adminLastActivityAt";
  const SESSION_STARTED_KEY = "adminSessionStartedAt";
  const MAX_IDLE_MS = 60 * 60 * 1000;
  const REFRESH_LEAD_MS = 15 * 60 * 1000;
  const REFRESH_CHECK_MS = 5 * 60 * 1000;
  let lastRecordedActivity = 0;
  let refreshInProgress = false;
  let trackingStarted = false;

  function decodeToken(token) {
    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_STARTED_KEY);
  }

  function redirectToLogin() {
    if (!window.location.pathname.endsWith("admin-login.html")) {
      window.location.href = "admin-login.html";
    }
  }

  function sessionIsValid() {
    if (localStorage.getItem(LOGGED_IN_KEY) !== "true") return false;
    const token = localStorage.getItem(TOKEN_KEY);
    const claims = token && decodeToken(token);
    if (!token || !claims || !claims.exp) return false;

    const now = Date.now();
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || now;
    if (now - lastActivity >= MAX_IDLE_MS) return false;
    if (claims.exp * 1000 <= now) return false;
    return true;
  }

  async function refreshTokenIfNeeded() {
    if (refreshInProgress || !sessionIsValid()) return;
    const token = localStorage.getItem(TOKEN_KEY);
    const claims = decodeToken(token);
    if (!claims || (claims.exp * 1000 - Date.now()) > REFRESH_LEAD_MS) return;

    refreshInProgress = true;
    try {
      const res = await fetch("/admin/session/refresh", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        clearSession();
        redirectToLogin();
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
    } catch (e) {
      // A temporary network failure should not interrupt an active dashboard.
    } finally {
      refreshInProgress = false;
    }
  }

  function recordActivity() {
    const now = Date.now();
    if (now - lastRecordedActivity < 30 * 1000) return;
    lastRecordedActivity = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    refreshTokenIfNeeded();
  }

  function startActivityTracking() {
    if (trackingStarted) return;
    trackingStarted = true;
    ["click", "keydown", "pointerdown", "touchstart", "scroll"].forEach(eventName => {
      document.addEventListener(eventName, recordActivity, { passive: true });
    });
    window.setInterval(() => {
      if (!sessionIsValid()) {
        clearSession();
        redirectToLogin();
        return;
      }
      refreshTokenIfNeeded();
    }, REFRESH_CHECK_MS);
    refreshTokenIfNeeded();
  }

  window.adminRequireSession = function () {
    if (!sessionIsValid()) {
      clearSession();
      redirectToLogin();
      return false;
    }
    if (!localStorage.getItem(SESSION_STARTED_KEY)) {
      localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
    }
    startActivityTracking();
    return true;
  };

  window.adminBeginSession = function () {
    const now = Date.now();
    localStorage.setItem(LOGGED_IN_KEY, "true");
    localStorage.setItem(SESSION_STARTED_KEY, String(now));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  };

  window.adminLogout = function () {
    clearSession();
    window.location.href = "admin-login.html";
  };

  window.adminClearExpiredSession = function () {
    if (localStorage.getItem(LOGGED_IN_KEY) === "true" && !sessionIsValid()) {
      clearSession();
    }
  };
})();