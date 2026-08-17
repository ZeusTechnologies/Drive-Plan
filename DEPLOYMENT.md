# DrivePlan on Vercel

## Build settings

The repository includes `vercel.json`, so Vercel will use:

- Framework: Vite
- Install command: `npm install --no-audit --no-fund` (lockfile-resolved; compatible with Vercel's Windows local builder)
- Build command: `npm run build`
- Output directory: `dist`

## Environment variables

Copy the Supabase browser values from `.env.example` into the Vercel project under **Settings → Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only use the Supabase publishable key. Do not add a secret or service-role key with a `VITE_` prefix because Vite compiles those values into browser JavaScript. `DATABASE_URL` and `SYNC_ENCRYPTION_KEY` remain reserved for a future authenticated cloud-sync API.

Supabase Auth URL Configuration must allow both the production site and local development callbacks:

- `https://driveplan.zeustechnologiesafrica.com`
- `http://localhost:5173`

## Deploy

```powershell
npm run deploy:preview
npm run deploy:production
```

Preview deployment is recommended before promoting to production.

## Custom domain

After the project is linked and the domain is known:

```powershell
vercel domains add YOUR_DOMAIN
vercel alias set YOUR_PRODUCTION_DEPLOYMENT_URL YOUR_DOMAIN
```

Vercel will display the required DNS records. Add them at the domain registrar, then confirm the domain under **Project → Settings → Domains**. Keep HTTPS enabled because service workers and PWA installation require a secure origin outside localhost.

## PWA behavior

- Android/Chrome and desktop Chromium show the native install prompt.
- iPhone/iPad users install through **Share → Add to Home Screen**.
- The app shell, manifest, logo, and production bundles are cached for offline use.
- Earnings and settings remain stored locally and synchronize between open tabs/windows.
- Secure cross-device financial-data sync requires authenticated server storage and is intentionally not simulated by this static deployment.
