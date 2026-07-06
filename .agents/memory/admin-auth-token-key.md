---
name: Admin auth token localStorage key
description: All admin-facing HTML pages must read/write the JWT under the same localStorage key, or admin API calls silently fail with no visible error.
---

In multi-page vanilla HTML admin panels (no shared JS module/bundler), each page independently reads the auth token from `localStorage`. If one page saves it under a different key name than another page reads (e.g. login page writes `adminToken` but a feature page reads `token`), the feature page's `fetch` calls silently send `Authorization: Bearer undefined` (or fail entirely) — there's no build-time check to catch this since it's just string literals scattered across files.

**Why:** Found this bug in Ibom Sports Hub — `admin-login.html` stored the JWT as `adminToken`, but `admin-support.html` read it as `token`, so ticket loading (and later, admin analytics) never worked despite correct backend logic.

**How to apply:** When adding any new admin page/feature that calls a protected endpoint, grep all admin-*.html files for `localStorage.getItem(` / `localStorage.setItem(` to confirm the token key name matches the one set at login before assuming an auth failure is a backend bug.
