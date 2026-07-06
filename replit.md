# Ibom Sports Hub

An e-commerce site for selling football boots, jerseys, and gear. The frontend is plain HTML/CSS/JS pages and the backend is an Express server that also serves the static files.

## Stack
- Node.js 20 (via Replit module)
- Express 4 (`index.js`) — single server handling both API and static asset serving
- Multer for image uploads (saved to `uploads/`)
- bcrypt + jsonwebtoken for admin auth
- JSON file storage (`products.json`, `admins.json`) — no external DB

## Layout
- `index.js` — Express server (entry point, listens on `0.0.0.0:5000`)
- `index-memory.js` — Older in-memory variant of the server (not used)
- `index.html` — Customer-facing storefront (includes Customer Support: AI Assistant chat, Direct Ticket, Email, Phone Call, WhatsApp)
- `admin-login.html`, `admin-dashboard.html`, `add-products.html`, `add-boots.html`, `admin-support.html` — Admin pages
- `*.jpg`, `logo.png` — Static assets served directly from project root

## Customer Support Features
- **AI Assistant** — chat backed by OpenAI `gpt-4o-mini` plus a ticket-answer-pool fallback; requires `OPENAI_API_KEY` with active billing/credits (falls back gracefully with a Retry button if the key has no quota).
- **Direct Ticket** — live chat ticket system between customer and admin (`admin-support.html`).
- **Phone Call** — "PLACE A CALL" button that silently resolves the active company number (day/night, Africa/Lagos time) and launches `tel:`; shows a copy-number toast if the dialer doesn't open.
- **Support Channel Analytics** — every support option click is tracked (`ai`, `ticket`, `email`, `phone`, `whatsapp`) and viewable as an "Analytics" tab in `admin-support.html` (bar chart of totals + 7-day breakdown).
- Admin pages must all read the JWT from the same `localStorage` key (`adminToken`) — see `.agents/memory/admin-auth-token-key.md` if adding new admin pages.

## API Endpoints
- `GET  /products` — List all products
- `POST /add-product` — Add a product (multipart, requires Bearer token)
- `POST /create-admin` — Create an admin account
- `POST /login` — Admin login, returns a JWT (1h expiry)
- `POST /ai-chat/sessions`, `GET /ai-chat/sessions`, `POST /ai-chat/sessions/:id/messages` — AI Assistant chat
- `GET  /call-number` — Returns the currently active support phone number (day/night)
- `POST /support-analytics/track` — Log a support channel click (public, body: `{ channel }`)
- `GET  /support-analytics/stats` — Aggregated support channel stats (requires Bearer token)

## Replit Setup
- Workflow `Start application` runs `npm start` and waits on port 5000 (webview).
- Frontend uses **relative URLs** (`/products`, `/login`, `/add-product`) so it works in the Replit proxy and in production without code changes.
- Server binds to `0.0.0.0` and uses `process.env.PORT || 5000`.
- Deployment: `vm` target (chosen because the app writes products + uploads to the local filesystem, which `autoscale` would not persist).

## Environment Variables
- `JWT_SECRET` (optional) — overrides the default JWT signing secret. Set this before publishing for any real use.
- `PORT` (optional) — overrides the listening port (defaults to 5000).
- `OPENAI_API_KEY` — required for the AI Assistant chat to call OpenAI (must have active billing/credits, or the chat falls back to a canned response).
- `COMPANY_PHONE_DAY` / `COMPANY_PHONE_NIGHT` (optional) — override the placeholder day/night support phone numbers used by the Phone Call feature.

## Recent Changes
- 2026-07-06: Added Support Channel Analytics — tracks clicks on each customer support option (AI Assistant, Direct Ticket, Email, Phone Call, WhatsApp) and shows totals/7-day breakdown in a new "Analytics" tab on `admin-support.html`. Fixed a pre-existing bug where `admin-support.html` read the auth token under a different localStorage key than `admin-login.html` wrote it, which had been silently breaking ticket loading.
- 2026-04-29: Imported from GitHub. Consolidated server into `index.js`, added missing `bcrypt`/`jsonwebtoken` deps, switched server to port 5000 / host 0.0.0.0, added static file serving, swapped hardcoded `your-replit-link.repl.co` URLs for relative paths, configured workflow + VM deployment.
