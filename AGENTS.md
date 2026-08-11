# Repository Guidelines

## Project Structure

`src/` contains the React application: `App.tsx` owns the UI, `lib/` contains Supabase access, and `*.test.tsx` files sit beside the code they test. `public/` contains PWA assets and the service worker. Versioned database changes belong in `supabase/migrations/`; never edit an applied migration—add the next numbered migration instead. Deployment files live at the repository root.

## Development Commands

- `npm install` installs dependencies; use `npm ci` for reproducible clean installs.
- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite once.
- `npm run lint` performs the TypeScript check.
- `npm run build` type-checks and produces the production bundle.

Run `npm test && npm run lint && npm run build` before committing application changes. To run the Pi deployment, set real Supabase values in untracked `.env`, then use `docker compose up -d --build`. It serves on `127.0.0.1:8081`.

## Code Style & Testing

Use TypeScript with two-space indentation, single quotes, and semicolon-free statements, matching the existing code. Prefer descriptive `camelCase` functions and `PascalCase` React components. Keep Supabase calls in `src/lib/`, not in UI components. Add deterministic tests for behavior changes; mock Supabase rather than calling a live project.

## Data, Security & Configuration

The browser uses `VITE_SUPABASE_URL` and the low-privilege Publishable key (legacy anon key). These values are compiled into the browser bundle; never use a secret or service-role key. RLS policies and RPCs enforce owner/editor access. Keep `.env`, `supabase/.temp/`, build output, and tokens untracked.

## Commits & Pull Requests

Make small, focused commits with imperative Conventional Commit-style subjects, such as `fix: refresh after clearing bought items`. Stage only related files and inspect `git diff --staged` first. Do not push automatically. Pull requests should summarize behavior, note verification, link issues when applicable, and include mobile screenshots for UI changes.
