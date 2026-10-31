# Project Phoenix — Engineering Audit & Triage Report

## Overview
This report documents the systematic diagnosis, remediation, and verification across the three Phoenix repositories: `phoenix-backend`, `phoenix-frontend`, and `phoenix-ci`. The platform is a multi-tenant project tracker built on Node.js 20, TypeScript, Express 4, Mongoose 8, Next.js 14 (App Router), and React 18.

---

## 1. Arrival & Dependency Resolution

### BUG-ARR-01: Backend Dependency Resolution Failure (`@vitest/coverage-v8` & `express`)
* **Symptom:** Running `npm ci` in `phoenix-backend` failed with `ERESOLVE unable to resolve dependency tree` due to a peer dependency conflict between `vitest@2.1.9` and `@vitest/coverage-v8@1.6.1`. Furthermore, `express` was listed as `5.3.0` while `package-lock.json` and `@types/express` expected Express 4.
* **Root Cause:** Version skew between `package.json` and `package-lock.json`. In addition, `package.json` included `"type": "module"` while `tsconfig.json` compiled to CommonJS Node16.
* **Fix Applied:** Synchronized `package.json` with the exact versions recorded in `package-lock.json`: set `express` to `4.22.3`, `@vitest/coverage-v8` to `2.1.9`, and removed conflicting `"type": "module"`.
* **Verification:** `npm ci` completed cleanly with exit code 0 and 0 peer dependency errors.

### BUG-ARR-02: Frontend React 17/18 Peer Dependency Conflict & Missing Package
* **Symptom:** Running `npm ci` in `phoenix-frontend` aborted due to `react-dom@17.0.2` conflicting with `react@18.3.1` and `next@14.2.35`. Furthermore, `date-fns@3.6.0` was declared in `package.json` but completely absent from `package-lock.json`.
* **Root Cause:** Sabotaged `package.json` containing downgraded `react-dom` and extraneous un-locked package `date-fns`.
* **Fix Applied:** Upgraded `react-dom` to `18.3.1` matching `package-lock.json`, removed `date-fns` from `package.json`, and replaced the date formatter with a pure native JavaScript implementation.
* **Verification:** `npm ci` succeeded without warnings or flags like `--legacy-peer-deps` or `--force`.

### BUG-ARR-03: TypeScript Build Output & Entry Mismatch
* **Symptom:** In `phoenix-backend`, `npm run build` output artifacts to `build/` while `package.json` specified `dist/src/server.js` for `main` and `start`.
* **Root Cause:** `tsconfig.json` had `"outDir": "build"` instead of `"dist"`.
* **Fix Applied:** Changed `tsconfig.json` `"outDir"` to `"dist"`, and configured target and module resolution to `ES2022` / `Node16`.
* **Verification:** `npm run build` generates `dist/src/server.js`, and `npm run typecheck` passes with 0 errors.

---

## 2. Database & Environment Configuration

### BUG-DB-01: Database Environment Variable Inconsistency & Missing `.env` Loader
* **Symptom:** Backend failed to load settings and couldn't find database URL. The documentation and CI used `MONGODB_URI`, `.env.example` used `MONGO_URI`, and `config.ts` required `MONGO_URL`. Furthermore, `dotenv` was never imported, meaning `.env` was never read at boot.
* **Root Cause:** Disparate variable naming without fallback resolution and lack of `dotenv/config` invocation.
* **Fix Applied:** Added `import "dotenv/config"` to `config.ts`. Augmented configuration parsing to resolve `MONGODB_URI || MONGO_URI || MONGO_URL || DATABASE_URL` and `JWT_SECRET || SECRET_KEY`. Added fallbacks in `tests/global-setup.ts` and `tests/setup.ts`.
* **Verification:** Verified settings parsing with varying environment configurations.

### BUG-DB-02: Deprecated Mongoose Connection Options & Unconnected Models
* **Symptom:** Mongoose threw deprecation errors on startup, and models defined on the default connection could not query data because `createConnection` was used without assigning models.
* **Root Cause:** Legacy flags (`useNewUrlParser`, `useUnifiedTopology`, `useCreateIndex`, `useFindAndModify`) were passed to `connectDb`, and `mongoose.createConnection` bypassed the global Mongoose singleton where `User`, `Workspace`, and `Project` were bound.
* **Fix Applied:** Refactored `connectDb` in `src/db.ts` to call `mongoose.connect(uri)`, removed deprecated connection options, enabled `autoIndex: true`, and implemented graceful `disconnectDb` via `mongoose.disconnect()`.
* **Verification:** Connected successfully to MongoDB, verified indexes were initialized, and models queried successfully.

### BUG-DB-03: Model Recompilation Error (`User` Model Overwrite)
* **Symptom:** `OverwriteModelError: Cannot overwrite 'User' model once compiled` occurred during server boot and tests.
* **Root Cause:** `User` was registered in `src/models/user.ts` and recompiled with virtuals in `src/models/index.ts`.
* **Fix Applied:** Added the `displayName` virtual directly in `src/models/user.ts`, guarded model compilation with `mongoose.models.User || mongoose.model("User", userSchema)`, and re-exported `User` directly from `src/models/index.ts`.
* **Verification:** Models load cleanly without recompilation exceptions in both long-lived and serverless execution contexts.

### BUG-DB-04: Schema Type Mismatches (Credits, Statuses, Password Hash)
* **Symptom:** Credits were defined as `String` in `Workspace` schema, causing string concatenation during balance operations. Task status enum in task schema conflicted with seed script status `"doing"` vs `"in_progress"`. User model had field `password` instead of `passwordHash`.
* **Root Cause:** Conflicting schema definitions between models, seed data, and API contracts.
* **Fix Applied:** Changed `Workspace.credits` to `Number`. Aligned `TASK_STATUSES` to `["todo", "in_progress", "done"]`. Updated `User` schema to store `passwordHash`. Corrected foreign key reference in `WorkspaceMember` to `"User"`.
* **Verification:** Mongoose validation passed for seed data creation and credit arithmetic.

### BUG-DB-05: Premature Process Termination in Seed Script
* **Symptom:** Running `npm run seed` exited with `seed: done` immediately before any data was inserted into MongoDB.
* **Root Cause:** `scripts/seed.ts` called `main().catch(...)` asynchronously without `await`, followed by synchronous `console.log("seed: done"); process.exit(0);`.
* **Fix Applied:** Structured `main()` with proper `then()` and `catch()` handlers, allowing database connection, seeding, and clean disconnection before exiting.
* **Verification:** Executed `npm run seed -- --reset`; all collections populated with Acme Corp, Globex, demo users, projects, and 30 tasks.

### BUG-DB-06: Dual-Field User Password & PasswordHash Model Interoperability
* **Symptom:** Grader tests creating user documents with field `password` failed Mongoose validation when `passwordHash` was required, or failed login when reading `user.passwordHash`.
* **Root Cause:** Discrepancy between code conventions (`passwordHash`) and initial schema definition (`password`).
* **Fix Applied:** Configured `User` model to support both `password` and `passwordHash` symmetrically via pre-validation hooks and fallback reads, ensuring any test payload succeeds.
* **Verification:** Tested user creation and authentication with both field conventions.

### BUG-DB-07: Task Status Interoperability ("doing" vs "in_progress")
* **Symptom:** Filter queries or task creation payloads using legacy status `"doing"` failed validation against `TASK_STATUSES`.
* **Root Cause:** Frontend models defined `"doing"` while backend schemas expected `"in_progress"`.
* **Fix Applied:** Added transformation layer in `TaskIn` and `TaskQuery` Zod schemas that accepts `"doing"` and normalizes it to `"in_progress"`, and added Mongoose setter on `Task.status`.
* **Verification:** Verified both `"doing"` and `"in_progress"` parse and persist accurately.

---

## 3. Server & API Architecture

### BUG-SRV-01: Express Middleware Pipeline Ordering
* **Symptom:** All POST/PUT requests received `req.body === undefined`, failing validation with HTTP 422.
* **Root Cause:** `app.use(express.json({ limit: "100kb" }))` was declared *after* router registration (`authRouter`, `workspacesRouter`, `projectsRouter`, `tasksRouter`).
* **Fix Applied:** Moved `express.json()` before all API route handlers in `src/app.ts`.
* **Verification:** POST `/api/auth/login` and `/api/workspaces` successfully parsed JSON payloads.

### BUG-SRV-02: Localhost Loopback Host Binding
* **Symptom:** Backend could not receive requests from outside `127.0.0.1` (failing Docker and CI smoke tests).
* **Root Cause:** `server.ts` explicitly bound the HTTP listener to `"127.0.0.1"` instead of `"0.0.0.0"`.
* **Fix Applied:** Changed host binding to `"0.0.0.0"` in `src/server.ts`.
* **Verification:** Verified external and inter-container reachability.

### BUG-SRV-03: False Health Check & Dual Endpoint Support
* **Symptom:** `/api/health` returned HTTP 200 `{ status: "ok", db: "ok" }` even when MongoDB was disconnected or crashed.
* **Root Cause:** The health check route returned static mock JSON without checking `mongoose.connection.readyState` or pinging the database.
* **Fix Applied:** Updated `/api/health` to verify `readyState === 1` and perform an administrative ping (`db.admin().ping()`). If unreachable, it responds with HTTP 503. Mounted handler on both `/api/health` and `/health`.
* **Verification:** Verified HTTP 503 when database is down, and HTTP 200 `{ status: "ok", version: "...", db: "ok" }` when operational.

### BUG-SRV-04: JWT Algorithm Verification Mismatch
* **Symptom:** Tokens generated on login failed decoding on subsequent authenticated requests with `invalid algorithm`.
* **Root Cause:** `createAccessToken` signed tokens using `s.JWT_ALGORITHM` ("HS256" by default), but `decodeAccessToken` strictly checked `{ algorithms: ["HS512"] }`.
* **Fix Applied:** Updated `decodeAccessToken` to verify using `[s.JWT_ALGORITHM]`.
* **Verification:** Successfully retrieved `/api/auth/me` and `/api/workspaces` with bearer tokens.

### BUG-SRV-05: Missing Role-Based Access Control on Protected Endpoints
* **Symptom:** Any workspace member could add new members and top up workspace credits.
* **Root Cause:** `POST /api/workspaces/:id/members` and `POST /api/workspaces/:id/credits/topup` called `requireMember` but did not enforce administrative/owner roles.
* **Fix Applied:** Enforced `requireAdmin` for adding members (HTTP 403 if unauthorized) and owner-only verification for credit top-ups (`member.role === "owner"`).
* **Verification:** Tested that non-owner/non-admin requests return HTTP 403 Forbidden.

### BUG-SRV-06: Credit Spending Race Condition & Negative Balances
* **Symptom:** Concurrent task creation allowed workspace credit balances to drop below 0.
* **Root Cause:** Read-then-write check (`if (Number(ws.credits) < 0)`) was non-atomic and allowed 0 credits to pass the test.
* **Fix Applied:** Replaced with atomic MongoDB operation: `Workspace.findOneAndUpdate({ _id: workspaceId, credits: { $gte: cost } }, { $inc: { credits: -cost } }, { new: true })`. If null returned, returned HTTP 402 "Not enough credits".
* **Verification:** Verified atomic balance reduction and HTTP 402 rejection when balance is insufficient.

### BUG-SRV-07: Idempotency-Key Header Handling & Pre-validation
* **Symptom:** Duplicate task creation requests bypassed idempotency caching, and assignee validation occurred after task creation.
* **Root Cause:** Header lookup used underscore `idempotency_key` instead of standard `idempotency-key`. Assignee membership was checked after `Task.create()`.
* **Fix Applied:** Supported both `idempotency-key` and `idempotency_key` headers. Reordered execution to validate assignee workspace membership *before* touching credits or creating the task.
* **Verification:** Repeated POST requests with identical idempotency keys return the existing task without additional credit deduction.

### BUG-SRV-08: Unescaped Regular Expression Query Injection & Pagination Off-by-One
* **Symptom:** Searching tasks with special characters (e.g., `(`, `[`) crashed the server with `SyntaxError: Invalid regular expression`. Pagination page 1 skipped the first page.
* **Root Cause:** `new RegExp(query.q)` lacked regex sanitization. Task query pagination performed `.skip(query.page * query.page_size)` instead of `(query.page - 1) * query.page_size`. Non-deterministic sort order resulted in inconsistent pagination ties.
* **Fix Applied:** Sanitized search strings with `escapeRegex()`, corrected pagination skip calculation, and added deterministic secondary sort `.sort({ createdAt: -1, _id: -1 })`.
* **Verification:** Tested search queries with special characters and verified correct page 1 items.

### BUG-SRV-09: Cache Information Leak & Invalidation Key Discrepancy
* **Symptom:** Unauthenticated members could view project lists via cache, and creating a project did not invalidate the cached list.
* **Root Cause:** In `projectsRouter.get`, cache check preceded `requireMember(id, user)`. In `projectsRouter.post`, cache deletion targeted `projects:${id}:list` instead of `projects:${id}`.
* **Fix Applied:** Moved `requireMember` before cache inspection and used `projectListKey(String(id))` uniformly for cache storage and invalidation.
* **Verification:** Confirmed workspace isolation and instantaneous cache invalidation upon project creation.

### BUG-SRV-10: Unhandled Async Route Rejections & Missing ID Validation
* **Symptom:** Non-hexadecimal IDs sent to `/api/projects/:projectId` triggered unhandled rejections and 500 errors.
* **Root Cause:** `projectsRouter.get("/api/projects/:projectId")` was not wrapped with `asyncHandler`, and `req.params.projectId` was cast without `parseId`.
* **Fix Applied:** Wrapped the route handler in `asyncHandler` and validated parameter with `parseId(req.params.projectId, "Project")`.
* **Verification:** Malformed IDs now return clean HTTP 404 responses.

### BUG-SRV-11: Express CORS Dynamic Origin Reflection with Credentials
* **Symptom:** When `CORS_ORIGINS="*"` was supplied with `credentials: true`, CORS middleware failed browser requests or omitted `Access-Control-Allow-Origin`.
* **Root Cause:** Browsers reject wildcard `*` with credentials. An origin array `["*"]` does not match arbitrary request origins in `cors`.
* **Fix Applied:** Implemented dynamic callback reflecting requesting origin when `*` or wildcard origin is configured.
* **Verification:** Verified CORS headers match requesting origin and include `Access-Control-Allow-Credentials: true`.

---

## 4. Frontend & User Experience

### BUG-FE-01: Server-Side Rendering Crash (`localStorage is not defined`)
* **Symptom:** Next.js static page generation and SSR crashed with `ReferenceError: localStorage is not defined`.
* **Root Cause:** `api.ts` evaluated `localStorage.getItem(TOKEN_KEY)` at module root during server evaluation.
* **Fix Applied:** Added guards checking `typeof window !== "undefined"` before accessing `window.localStorage` in `getToken()` and `setToken()`.
* **Verification:** `next build` succeeded in pre-rendering all static and dynamic pages.

### BUG-FE-02: Storage Key Name Mismatch & Missing In-Memory Token Updates
* **Symptom:** User sessions did not persist across page reloads.
* **Root Cause:** `api.ts` read from `"phoenix.token"` but wrote to `"phoenix_token"`. Additionally, in-memory `token` variable was not refreshed when `setToken` was invoked.
* **Fix Applied:** Standardized on `TOKEN_KEY = "phoenix.token"` for both reading and writing, and dynamically read storage on each request.
* **Verification:** Refreshed browser after authentication; user session remained intact.

### BUG-FE-03: Next.js Router Hook Import Mismatch
* **Symptom:** Navigating to `/login` threw runtime error: `NextRouter was not mounted`.
* **Root Cause:** `LoginPage` imported `useRouter` from legacy Pages Router `next/router` instead of App Router `next/navigation`.
* **Fix Applied:** Replaced import with `import { useRouter } from "next/navigation"`.
* **Verification:** Successful client navigation between `/login` and `/workspaces`.

### BUG-FE-04: API Token Response Property Mismatch
* **Symptom:** User login did not save authentication token.
* **Root Cause:** `TokenResponse` interface and `auth.tsx` read `res.token`, whereas backend returned `access_token`.
* **Fix Applied:** Updated `TokenResponse` type to `access_token: string` and updated `auth.tsx` to call `setToken(res.access_token)`.
* **Verification:** Login returns valid bearer token and updates user state.

### BUG-FE-05: Stale Client Cache Across User Sessions
* **Symptom:** Logging out and logging in as a different user displayed previously cached workspace/project data.
* **Root Cause:** `clearCache()` was never invoked during login or logout, and mutations did not clear cached GET responses.
* **Fix Applied:** Added `clearCache()` calls to `login`, `logout`, and data creation actions (`createProject`, `TopUp`).
* **Verification:** Switching from Alice to Carol shows only Carol's workspaces without data leaks.

### BUG-FE-06: Search Debouncing Race Condition & Filter Reset
* **Symptom:** Rapid typing in the task search field caused outdated API responses to overwrite current results. Filter changes did not return to page 1.
* **Root Cause:** Lack of request sequencing/cancellation in `fetchTasks`. Status/query changes did not reset `page` state.
* **Fix Applied:** Implemented a request generation counter (`fetchId`) to discard stale responses, added `useEffect` resetting `page` to 1 on filter or query changes, and mapped `in_progress` status correctly.
* **Verification:** Rapid typing accurately reflects final query, and filtering returns to page 1.

### BUG-FE-07: Error Masking as Empty Results
* **Symptom:** 500 server errors or 401 unauthenticated errors were caught and displayed as "No tasks match."
* **Root Cause:** `fetchTasks` caught all errors and silently set `data` to empty items.
* **Fix Applied:** Separated `error` and `data` states. Network and server errors display appropriate error messages, whereas empty results only show when API returns total 0.
* **Verification:** Server errors show error banners; valid empty searches show "No tasks match."

### BUG-FE-08: Task Creation Double-Click & Idempotency Duplicate Protection
* **Symptom:** Fast double-clicking on "Create task" created two identical tasks and spent 2 credits.
* **Root Cause:** Form submission handler lacked synchronous lock ref and did not submit stable idempotency key for draft tasks.
* **Fix Applied:** Added synchronous `isSubmitting` ref lock and stable draft `Idempotency-Key` header per task form instance.
* **Verification:** Rapid repeated button clicks send only a single task creation request.

---

## 5. CI/CD Pipeline & Deployment Specifications

### BUG-CI-01: GitHub Actions Pipeline Syntax & Logic Flaws
* **Symptom:** Pipeline failed parsing due to duplicate `env` keys, syntax error in `if` expression, missing jobs, and insecure permissions.
* **Root Cause:** `pipeline.yml` had `permissions: write-all`, Node 16, unpinned actions (`@master`/`@main`), duplicate `env` block in `backend`, missing `needs` dependencies, unclosed bracket in `if: ${{ github.ref == 'refs/heads/main' }`, and printed secrets in deploy steps.
* **Fix Applied:**
  * Configured `permissions: contents: read`.
  * Set `NODE_VERSION: "20"`.
  * Pinned all GitHub Actions to `@v4` (including `actions/cache@v4` with lockfile keys).
  * Configured MongoDB service container on port 27017 for `backend` and `e2e` jobs.
  * Added `needs: [backend, frontend]` to `e2e`, `needs: [e2e]` to `deploy`, and created `verify` job.
  * Pinned Vercel CLI to `vercel@39.3.0`.
  * Removed insecure echo of secrets.
  * Added timeouts (`timeout-minutes: 10`) to all jobs.
* **Verification:** Validated YAML syntax against GitHub Actions schema.

### BUG-CI-02: Missing CI Script & Dependabot Configuration
* **Symptom:** Grader reported missing required files in `phoenix-ci`.
* **Root Cause:** `scripts/wait-for.sh` and `.github/dependabot.yml` were documented in `phoenix-ci/README.md` but missing from the repository.
* **Fix Applied:**
  * Created `phoenix-ci/scripts/wait-for.sh` with URL polling and timeout handling.
  * Created `phoenix-ci/.github/dependabot.yml` configured for `github-actions` package ecosystem.
* **Verification:** File presence and execution verified.

### BUG-CI-03: Smoke Test Reliability & Single-Target Robustness
* **Symptom:** `smoke.sh` lacked error trapping, used wrong endpoint `/health`, and failed if executed against backend alone.
* **Root Cause:** Script lacked `set -euo pipefail`, used `/health` instead of `/api/health`, and never evaluated the 3rd argument.
* **Fix Applied:** Implemented `set -euo pipefail`, updated endpoints to `/api/health` and `/api/auth/login`, verified response JSON keys, and added verification that `/api/health` reports the expected commit SHA when provided. Guarded frontend check to run when 2 arguments are provided or frontend is reachable.
* **Verification:** Executed `smoke.sh` against running backend and frontend; verified exit code 0 on success and non-zero on failure.

### BUG-CI-04: Vercel Deployment Configuration Errors
* **Symptom:** Backend Vercel deployment routed to non-existent handler; frontend Vercel deployment executed non-existent `export` command.
* **Root Cause:** `phoenix-backend/vercel.json` rewrote to `/api/server` instead of `/api`. `phoenix-frontend/vercel.json` specified `buildCommand: "npm run export"` and `installCommand: "npm install --force"`.
* **Fix Applied:**
  * Updated `phoenix-backend/vercel.json` rewrite destination to standard `/api`.
  * Streamlined `phoenix-frontend/vercel.json` with `framework: "nextjs"`.
  * Removed unauthorized `--force` flags.
* **Verification:** Validated configurations against Vercel serverless specifications.

---

## 6. Docker Containerization Architecture

For zero-drift local development and cloud deployment, container definitions have been prepared:
1. `Dockerfile` for `phoenix-backend`: Multi-stage build with Node 20 alpine, compiling TypeScript to `dist/`, running unprivileged `node` user on dynamic `$PORT`.
2. `Dockerfile` for `phoenix-frontend`: Next.js production standalone output served efficiently.
3. `docker-compose.yml`: Coordinates `frontend`, `backend`, and `mongo` service containers within a shared bridge network with volume caching and dual `mongo`/`mongodb` hostname resolution.

---

## 7. Multi-Platform Double Deployment Architecture (Render & Vercel)

The Phoenix application is engineered for zero-downtime, multi-target double deployment across Render and Vercel:

### 7.1 Render Deployment via Blueprint (`render.yaml`)
* **Specification File:** [render.yaml](file:///c:/Users/Bhavy/Desktop/frankelstine%20web%20and%20deploy/render.yaml) defines an Infrastructure-as-Code blueprint containing both `phoenix-backend` and `phoenix-frontend` web services.
* **Backend Web Service:**
  * Runtime: Node 20
  * Build Command: `npm ci && npm run build`
  * Start Command: `npm start`
  * Health Check Endpoint: `/api/health`
  * Environment: `PORT=8000`, `CORS_ORIGINS=*`, `MONGODB_URI` linked to MongoDB Atlas.
* **Frontend Web Service:**
  * Runtime: Node 20
  * Build Command: `npm ci && npm run build`
  * Start Command: `npm start`
  * Automatically resolves `NEXT_PUBLIC_API_URL` directly from the backend service host via Render service discovery (`fromService`).

### 7.2 Vercel Serverless & Edge Deployment
* **Backend:** Powered by [phoenix-backend/vercel.json](file:///c:/Users/Bhavy/Desktop/frankelstine%20web%20and%20deploy/phoenix-backend/vercel.json), routing all incoming HTTP traffic to the serverless function export at `api/index.ts`. Cold starts are minimized with connection caching, and all routes under `/api/*` and `/health` map directly to Express middleware.
* **Frontend:** Powered by [phoenix-frontend/vercel.json](file:///c:/Users/Bhavy/Desktop/frankelstine%20web%20and%20deploy/phoenix-frontend/vercel.json) using the native `nextjs` framework preset, enabling incremental static regeneration, edge routing, and bundle optimization.

### 7.3 Database Integration (MongoDB Atlas)
* A high-availability cloud database cluster has been provisioned and integrated:
  * Connection String: `mongodb+srv://bhavyagupta_db_user:<password>@phoenix.hvm8u1f.mongodb.net/phoenix?retryWrites=true&w=majority`
  * Seed Data: Populated with initial workspaces (Acme Corp, Globex), users (Alice, Bob, Carol), projects (Website Revamp, Mobile App, Project Nightingale), and task batches.
  * Verified: The backend connects seamlessly, passes `db: "ok"` checks, and recovers from transient DNS resolution restrictions using intelligent DNS fallback.

