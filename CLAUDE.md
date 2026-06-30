# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

K-egg POS — an **ingredient-based point-of-sale** PWA for a Korean egg food stall. Built on Next.js 15 (App Router) + React 19 + Firebase (Auth/Firestore/Storage) + Tailwind v4. Multi-branch, role-based, and **offline-first**: a cashier must be able to take orders and print receipts with no network, syncing when it returns.

## Commands

```bash
pnpm dev          # next dev on 0.0.0.0 (LAN-accessible for tablets/phones)
pnpm build        # production build (also the only way to exercise the service worker)
pnpm start        # serve the production build
pnpm lint         # next lint (eslint flat config; most rules are warnings, see eslint.config.mjs)

node scripts/seed.js     # seed Firestore: categories, 1 branch, sample ingredients + menu, admin user doc
node scripts/reseed.js   # reseed variant
```

`pnpm` is the package manager (note: both `pnpm-lock.yaml` and `package-lock.json` are committed — prefer pnpm, the `node_modules` layout is pnpm's). There is **no test suite**.

The service worker only registers when `process.env.NODE_ENV === "production"` (see `components/PWARegistration.tsx`), so offline behavior is **not testable under `pnpm dev`** — use `pnpm build && pnpm start`.

## Environment / secrets

- Client Firebase config comes from `NEXT_PUBLIC_*` env vars (see `firebase-config.js`). Without a `.env` the app cannot reach Firebase.
- Firebase Admin (used by `app/api/admin/workers/route.ts` and `lib/firebase-admin.ts`) reads `FIREBASE_SERVICE_ACCOUNT_KEY` (a JSON string, for prod/Vercel) and otherwise falls back to a local `k-egg-89f8f-firebase-adminsdk-*.json` file in the repo root. That file is gitignored (`*-firebase-adminsdk-*.json`); seed scripts require it.

## Architecture

### The DataStore is the heart of the app

`stores/dataStore.ts` is a **client-side singleton** that owns every Firestore realtime listener (`onSnapshot`) and re-broadcasts changes through a tiny `EventEmitter`. Nothing else should open snapshot listeners for the shared collections.

- Collections are either **global** (`categories`, `branches`) or **branch-scoped** (`ingredients`, `menuItems`, `orders`, `discounts`, keyed by `branchId`) or **user-scoped** (`workers`/`users` doc, keyed by `uid`).
- Listeners are started lazily on first `subscribeTo*` call and de-duplicated via `active*Listeners` sets. `cleanupBranch(branchId)` / `cleanupAll()` tear them down.
- The `orders` listener intentionally only loads the **last 31 days** (`startOrdersListener`) — historical reporting must query Firestore directly (see `orderService.getOrdersByDateRange`).
- React consumes the store through two contexts, never directly: `contexts/RealtimeDataContext.tsx` (menu/ingredients/orders/categories for the current branch) and `contexts/BranchContext.tsx` (branches + current worker).

### Provider hierarchy

Root providers wrap everything in `app/layout.tsx`:
`NetworkProvider → AuthProvider → BluetoothProvider → TimeTrackingProvider → BranchProvider → DateTimeProvider`.

Inside a branch, `app/(main)/[branchId]/layout.tsx` adds: `AuthGuard → BranchProvider(initialBranchId) → RealtimeDataProvider → StockAlertProvider → DrawerProvider`.

### Auth, roles, and routing

- `contexts/AuthContext.tsx` is the authority on permissions. A user has `isAdmin` plus `roleAssignments: { branchId, role: "manager" | "worker", isActive }[]`. Hierarchy is **admin > manager > worker**; admins are not "managers" or "workers" and are not assigned to specific branches. All the `canX` / `isX` / `getUserHierarchyLevel` helpers live here — reuse them rather than re-deriving roles.
- Routing is **branch-in-the-URL**: `/[branchId]/store`, etc. Route groups encode role intent: `app/(main)/[branchId]/(worker)/...` (store, orders, ingredients) and `app/(main)/[branchId]/(manager)/...` (sales, discounts, logs, settings, manage/*). `app/(main)/admin/...` is the admin console (branches, users). Route groups are organizational only — actual gating is done by `components/AuthGuard.tsx` and `components/POSAccessGuard.tsx`.
- `app/page.tsx` redirects post-login by role: admin → `/admin/branches`, otherwise → `/{firstBranchId}/store`, no roles → `/login`. `AuthGuard` sends role-less non-admins to `/waiting-room`.

### Offline-first mechanics (don't break these)

- Firestore is initialized with `persistentLocalCache` + `persistentMultipleTabManager` (`firebase-config.js`), stashed on `globalThis` to survive HMR/multi-init.
- Writes are **optimistic**. `orderService.createOrder` builds a `writeBatch` and returns the order id *without awaiting* `batch.commit()` so the UI advances offline; the commit resolves against the local cache and syncs later. Preserve this pattern for POS-critical writes.
- `contexts/NetworkContext.tsx` exposes `isOnline` + `hasPendingWrites`, polling `waitForPendingWrites(db)` (with an 80ms race so it doesn't hang offline) and `onSnapshotsInSync`.
- The auth session is mirrored to `localStorage` (`kegg_pos_auth_user`) in `AuthContext` so a cached user renders instantly without a blocking spinner on reload.
- `public/sw.js` is a hand-written service worker: stale-while-revalidate for the app shell / `_next/static` / RSC data, with `/offline.html` fallback. It **bypasses** `/api/*` and all Firebase/Firestore hosts. Cache version is keyed to the build id (`next.config.ts` `generateBuildId`); bumping a build invalidates old caches.

### Inventory / stock model (two coexisting approaches — be careful)

Menu items carry a `recipe: { ingredientId, quantity, unit }[]`. Selling an item deducts its recipe ingredients.

1. **Event-sourced deltas (current order path):** `orderService.createOrder` and `voidOrder` write immutable docs to the `ingredients/{id}/stockDeltas` subcollection (`reason: ORDER_DEDUCTION | ORDER_VOID`) inside the order batch, and only bump the ingredient's `updatedAt` — they do **not** overwrite `stock`.
2. **Direct stock overwrite (legacy/manual path):** `ingredientService.bulkDeductIngredientStock` / `bulkAddIngredientStock` (via `ingredientDeductionService`) read-then-write the absolute `stock` field.

When touching inventory, know which path you're on. `services/restockService.ts` and stock-alert logic (`contexts/StockAlertContext.tsx`) also participate.

### Services layer

`services/*.ts` hold Firestore CRUD + business logic (one file per domain: branch, worker, menuItem, ingredient, order, discount, sales, category, restock, settings, availability, workSession). Mutations that matter for compliance call `auditService.logAction` (writes to an audit log; see `types/AuditLog.ts`). Services use the **client** SDK (`db` from `firebase-config`); only worker auth account create/delete go through the Admin SDK API route.

### Receipt printing

Two printer backends, switchable in settings (persisted to `localStorage`), both in `contexts/BluetoothContext.tsx`:
- **`bluetooth`**: Web Bluetooth → ESC/POS bytes built by `lib/esc_formatter.ts` (58mm, handles CJK/Hangul full-width column math, logo bitmap via `lib/logo_processor.ts`, cash-drawer kick).
- **`web_print`**: renders an HTML receipt into a hidden iframe and calls `window.print()` (AirPrint / system dialog).

`58MM_Programmer_Manual.pdf` in the repo root is the printer's ESC/POS command reference.

## Conventions

- **Import alias:** `@/*` → repo root (`tsconfig.json`). e.g. `@/contexts/AuthContext`, `@/firebase-config`.
- **Indentation is tabs** in most `.tsx`/`.ts` files; match the file you're editing.
- Almost every component is `"use client"` — this is a heavily client-rendered SPA. Server components / API routes are the exception (only `app/api/admin/workers`).
- **Styling:** Tailwind v4 via PostCSS (`@tailwindcss/postcss`, no `tailwind.config`); theme colors are CSS variables like `var(--background)`, `var(--secondary)`, `var(--primary)` defined in `app/globals.css`.
- Currency is PHP (`₱`); use `lib/currency_formatter.ts` / `lib/date_formatter.ts` rather than ad-hoc formatting.
- Icons live as React components under `components/icons/**` and per-feature `icons/` folders (not imported SVG files, despite `svgr.d.ts` / `@svgr/webpack` being present).
- Remote image hosts are allowlisted in `next.config.ts` (Cloudinary, Firebase/Google storage) — add new hosts there for `next/image`.

## Gotchas

- Branch-scoped queries in `dataStore.ts` combine `where(...)` + `orderBy(...)`, which require **Firestore composite indexes**. A listener silently failing (empty data) often means a missing index — check the browser console for the index-creation link.
- Deleting a worker must go through `DELETE /api/admin/workers` (Admin SDK) — it removes the Auth user, the `users/{uid}` doc, and the user's `workSessions`. Deleting only the Firestore doc leaves an orphaned Auth session, which `AuthContext` detects and force-logs-out.
- `ts_errors.txt` in the repo root is a scratch/log file, not a build artifact to rely on.
