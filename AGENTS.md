# AGENTS.md

## Cursor Cloud specific instructions

### Product overview
Kid Commute is a monolithic full-stack TypeScript application (Express.js + React SPA) for student transportation management. A single server process on port 5000 serves both the REST API and the Vite-built React frontend plus WebSockets. See `README.md` and `replit.md` for detailed architecture.

### Local PostgreSQL + Neon driver
The app uses `@neondatabase/serverless` which connects to PostgreSQL over WebSocket. For local development with a standard PostgreSQL instance, two helper scripts in `.dev/` bridge the gap:
- `.dev/ws-proxy.mjs` — WebSocket-to-TCP proxy (ws://localhost:5433 → tcp://localhost:5432)
- `.dev/neon-local.mjs` — Node.js preload that configures `neonConfig` for non-secure local WebSocket

**Starting the dev server locally:**
```bash
# 1. Ensure PostgreSQL is running
sudo pg_ctlcluster 16 main start

# 2. Start the WebSocket proxy (background)
node .dev/ws-proxy.mjs &

# 3. Start the dev server with the Neon local config
NODE_OPTIONS="--import /workspace/.dev/neon-local.mjs" npm run dev
```

The `.env` file must contain `DATABASE_URL` and `SESSION_SECRET`. A working local config:
```
DATABASE_URL=postgresql://kidcommute:kidcommute@localhost:5432/kidcommute
SESSION_SECRET=dev-secret-key-for-local-development-only-12345
```

### Key commands
- `npm run dev` — start dev server (port 5000); must be run with `NODE_OPTIONS` as above for local PostgreSQL
- `npm run build` — production build (Vite frontend + esbuild backend)
- `npm run check` — TypeScript type-checking (has pre-existing errors; does not block builds)
- `npm run db:push` — push Drizzle schema to PostgreSQL (uses `pg` driver directly, no proxy needed)

### Auth for local testing
Register via `POST /api/auth/register` with `{email, password, firstName, lastName, phone}`. Login via `POST /api/auth/login` with `{identifier, password}`. Self-registration creates "parent" role; promote to admin via SQL: `UPDATE users SET role = 'admin' WHERE email = '...';`

### Non-obvious caveats
- The data-retention and auto-clockout background tasks may log timeout errors on first startup; these are transient and do not affect API functionality.
- `npm run check` (TypeScript) has ~30 pre-existing type errors; the build still succeeds because Vite/esbuild skip type checking.
- Optional integrations (Samsara GPS, Firebase push, BambooHR payroll, Resend email) degrade gracefully when their env vars are absent; the app runs fine without them.
- `drizzle-kit push` uses the standard `pg` driver and connects directly to PostgreSQL via TCP — it does **not** need the WebSocket proxy.
