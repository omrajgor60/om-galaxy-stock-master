# Audit & Fix Plan

The app removed authentication and switched to a client-side `ModeContext` (localStorage `app_mode`), but the database still enforces RLS via `auth.uid()` and `has_role()`. Since no user is signed in, `auth.uid()` is always `null`, so every write except `sales` is silently blocked or requires policies that were hot-patched to `true`. This is both a functional bug and a serious security hole.

## Critical issues found

### 1. Broken writes (auth.uid() is null everywhere)
- `stock_logs` INSERT policy: `auth.uid() = scanned_by` — scanning items fails.
- `customers` INSERT policy: `auth.uid() = created_by` — creating customers fails.
- `stock_transfers` INSERT policy: `auth.uid() = transferred_by` — transfers fail.
- `products` / `master_inventory` / `outlets` admin policies require `has_role(auth.uid(), 'admin')` — always false.
- `notifications`, `stock_alerts`, `profiles`, `user_roles`, `issue_reports`, `time_off_requests`, `backups` — all effectively locked.

### 2. Security holes
- `sales` table has `USING/WITH CHECK true` on SELECT/INSERT/UPDATE/DELETE — any anon key holder can read/modify all sales.
- `ModeContext` grants "admin" purely from localStorage — a user can flip to admin in devtools and hit every admin route/UI. There is no server-side enforcement.
- Broken FK query on Dashboard: `profiles!sales_sold_by_fkey(full_name)` returns 400 (no such FK / relationship). Sales leaderboard is broken.
- Leaked-password protection status should be re-verified.

### 3. Incomplete features / bugs
- Sales, Scanner, Transfers, Customers, Outlets, Settings all pass `null` for user-id columns, then rely on policies being `true`. Once RLS is tightened, they'll break unless the columns become nullable and policies are rewritten.
- Dashboard leaderboard query crashes with PGRST200 (see network logs).

## Fix plan

### A. Database migration (single migration)
1. Make user-id tracking columns nullable where the app now passes `null`:
   - `sales.sold_by`, `stock_logs.scanned_by`, `customers.created_by`, `stock_transfers.transferred_by`, `products.created_by`.
2. Replace every policy that depends on `auth.uid()`/`has_role()` with permissive policies scoped to the `anon` role, since the app runs unauthenticated. Grant `SELECT, INSERT, UPDATE, DELETE` to `anon` on: `products, customers, sales, stock_logs, stock_transfers, outlets, master_inventory, profiles, user_roles, notifications, stock_alerts, issue_reports, time_off_requests, backups`.
   - Rewrite each table's policies to `USING (true) WITH CHECK (true)` for the actions the app performs. This matches the current no-auth model and stops silent write failures. (Documented trade-off: without auth there is no per-user isolation — see section D.)
3. Drop the broken FK-implicit relationship expectation; instead of adding an FK from `sales.sold_by → profiles`, change the Dashboard query to fetch profiles separately (client-side join).

### B. Client fixes
1. `src/pages/DashboardPage.tsx` — replace the embedded `profiles!sales_sold_by_fkey(full_name)` select with two queries: fetch sales, then fetch profiles by `user_id IN (...)` and merge in JS.
2. Add a small utility guard so admin-only actions still fail gracefully if RLS ever rejects.

### C. Verify
1. Re-run `supabase--linter` after migration.
2. Manually test: scan an item, record a sale, create a customer, create/cancel a transfer, accept incoming stock, add outlet, import CSV.

### D. Explicit trade-off to acknowledge to the user
Because authentication was intentionally removed, "Admin vs Staff" is a UI-only distinction — anyone with the app URL and anon key can perform every action. If real security is needed, auth must be re-introduced. This plan restores full functionality under the current no-auth model; it does not add real access control.

## Out of scope (not fixing this turn)
- Re-introducing Supabase Auth and role-based server enforcement.
- New feature requests (product editing, sales history, request approvals) — surface only if you ask.

## Files to change
- New migration (via `supabase--migration`): nullability + policy rewrites + anon grants.
- `src/pages/DashboardPage.tsx`: split leaderboard query.
