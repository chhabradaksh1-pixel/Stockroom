# StockRoom — Inventory, Billing & Wholesale CRM

A retail tool for a fabric / kurti / lehenga business: inventory in/out,
GST billing, suppliers, purchase orders, and a wholesale CRM.
Data is saved per-device in the browser (localStorage).

## Deploy to Vercel (recommended)

Option A — Vercel CLI:
  1. npm i -g vercel        (if not installed)
  2. vercel login
  3. In this folder: vercel          (preview)
  4. When happy:   vercel --prod     (production URL)
  Vercel auto-detects Vite. Accept the defaults.

Option B — GitHub import:
  Push this folder to a GitHub repo, then vercel.com → Add New Project →
  import the repo. Framework preset: Vite. Build: `vite build`. Output: `dist`.

## Run on localhost

  npm install
  npm run dev        → http://localhost:5173

## Important notes

- The Vercel URL is PUBLIC. Anyone with the link can open the app.
  Data is per-browser though — visitors see only their own local data,
  never yours. For real protection, enable Deployment Protection in
  Vercel project settings, or keep usage on localhost.
- Data lives in each device's browser. Your shop counter PC and your
  phone each keep separate data. Clearing browser data erases it.
  A shared database is the upgrade path for multi-device use.
- Main application code: src/App.jsx

## Install as an app (PWA)

This project is an installable Progressive Web App.

On laptop (Chrome/Edge):
  1. Deploy to Vercel (or run `npm run build && npm run preview` locally)
  2. Open the URL → an install icon appears in the address bar
     (or browser menu → "Install StockRoom")
  3. It opens in its own window, with a Start-menu / dock icon,
     and works offline after the first load.

On phone/tablet:
  Open the Vercel URL → browser menu → "Add to Home Screen" /
  "Install app". Launches full-screen like a native app.

Note: PWA install requires HTTPS — Vercel provides this automatically.
localhost also works for testing installs.
