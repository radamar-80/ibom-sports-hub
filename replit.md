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
- `index.html` — Customer-facing storefront
- `admin-login.html`, `admin-dashboard.html`, `add-products.html`, `add-boots.html` — Admin pages
- `*.jpg`, `logo.png` — Static assets served directly from project root

## API Endpoints
- `GET  /products` — List all products
- `POST /add-product` — Add a product (multipart, requires Bearer token)
- `POST /create-admin` — Create an admin account
- `POST /login` — Admin login, returns a JWT (1h expiry)

## Replit Setup
- Workflow `Start application` runs `npm start` and waits on port 5000 (webview).
- Frontend uses **relative URLs** (`/products`, `/login`, `/add-product`) so it works in the Replit proxy and in production without code changes.
- Server binds to `0.0.0.0` and uses `process.env.PORT || 5000`.
- Deployment: `vm` target (chosen because the app writes products + uploads to the local filesystem, which `autoscale` would not persist).

## Environment Variables
- `JWT_SECRET` (optional) — overrides the default JWT signing secret. Set this before publishing for any real use.
- `PORT` (optional) — overrides the listening port (defaults to 5000).

## Recent Changes
- 2026-04-29: Imported from GitHub. Consolidated server into `index.js`, added missing `bcrypt`/`jsonwebtoken` deps, switched server to port 5000 / host 0.0.0.0, added static file serving, swapped hardcoded `your-replit-link.repl.co` URLs for relative paths, configured workflow + VM deployment.
