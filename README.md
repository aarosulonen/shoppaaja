# Gather

Gather is an installable, mobile-first shared shopping-list app. Sign in with Google to access your lists on any device. Each list has an edit link: anyone who signs in with it can add, complete, or remove items; only its creator can rename or delete the list.

## Prerequisites

- Node.js 18–20 and npm
- A Supabase project with **Google** sign-in enabled
- A Supabase **Publishable key** (or legacy `anon` key), never a secret or `service_role` key

## Local development

1. Apply every SQL file in `supabase/migrations/` in filename order through the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` to your project URL and Publishable key.
3. Run `npm install` and `npm run dev`.

The migration adds the required Realtime tables. Run `npm test`, `npm run lint`, and `npm run build` before committing.

## Google sign-in setup

1. In Google Cloud, configure the OAuth consent screen and create a **Web application** OAuth client. If the consent screen is in testing mode, add the Google accounts that will test the app as test users.
2. Add your Supabase callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as a Google **Authorized redirect URI**. Add the production app origin and `http://localhost:5173` as authorized JavaScript origins.
3. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the client ID and client secret. Keep the secret in Supabase; do not add it to Vite environment variables or commit it.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to your public HTTPS app origin. Allow the exact return URLs `https://<your-app-domain>/` and `http://localhost:5173/`. Use the public Cloudflare Tunnel domain for the Pi, not its loopback address.
5. Disable **Anonymous Sign-Ins** and apply all migrations, including `202609070001_google_auth.sql`, before deploying the updated application. Leave other permanent sign-in providers disabled.

See the [Supabase Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google) for provider configuration details. No additional browser environment variables are required.

Existing guest lists stay in the database but are not transferred to Google accounts. Save any needed edit links before upgrading: opening one after Google login restores editor access, not ownership. Old anonymous sessions cannot access lists after the migration. Sign-out affects only the current device.

After configuration, sign into the same Google account in two browsers/devices. Create a list, verify it appears when returning to the other device's dashboard, and verify item changes update in both open list views. Test a shared invitation while signed out, cancellation/retry of Google login, sign-out, and a different account with no invitation. Repeat login and sign-out in mobile Safari and the installed PWA.

## Raspberry Pi deployment

Copy `.env.example` to an untracked `.env` on the Pi, set real values, and run:

```bash
docker compose up -d --build
```

The container listens only at `http://127.0.0.1:8081`. Point the existing Cloudflare Tunnel ingress rule to `http://localhost:8081`; keep tunnel credentials and configuration outside this repository. Vite variables are compiled into the browser bundle, so rebuild after changing either Supabase value.
