# Gather

Gather is an installable, mobile-first shared shopping-list app. Each list has an edit link: anyone with it can add, complete, or remove items; only its creator can rename or delete the list.

## Prerequisites

- Node.js 18–20 and npm
- A Supabase project with **Anonymous Sign-Ins** enabled
- A Supabase **Publishable key** (or legacy `anon` key), never a secret or `service_role` key

## Local development

1. Apply every SQL file in `supabase/migrations/` in filename order through the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` to your project URL and Publishable key.
3. Run `npm install` and `npm run dev`.

The migration adds the required Realtime tables. Run `npm test`, `npm run lint`, and `npm run build` before committing.

## Install on iPhone or iPad

Open Gather in Safari, tap Share, choose **Add to Home Screen**, then tap Add. It opens in standalone app mode. iOS installation is manual; it has no browser install prompt.

## Raspberry Pi deployment

Copy `.env.example` to an untracked `.env` on the Pi, set real values, and run:

```bash
docker compose up -d --build
```

The container listens only at `http://127.0.0.1:8081`. Point the existing Cloudflare Tunnel ingress rule to `http://localhost:8081`; keep tunnel credentials and configuration outside this repository. Vite variables are compiled into the browser bundle, so rebuild after changing either Supabase value.
