# Migration Audit Report - PlotTwist
**Date:** 2025-02-16

## Migration Files (in order)
1. `001_initial_schema.sql` - Base schema, RLS, indexes, RPCs
2. `002_clan_premium.sql` - Clan XP/level, add_clan_xp, get_clan_leaderboard
3. `003_clan_chat.sql` - clan_messages table
4. `004_resolve_prediction.sql` - resolve_prediction RPC
5. `005_critical_ux.sql` - resolve_prediction (enhanced), clan leave/delete, notifications, prediction_comments, award_clan_xp_for_user
6. `006_fix_bet_balance.sql` - increment_coins (balance check), place_bet RPC
7. `007_daily_bonus_limit.sql` - last_daily_bonus, claim_daily_bonus, accept_challenge
8. `008_secure_rpcs.sql` - auth.uid() checks on RPCs, transactions policy
9. `009_ALL_IN_ONE_FIX.sql` - Consolidates 005-008
10. `010_shows_insert_policy.sql` - Shows INSERT policy for authenticated users

---

## CRITICAL Issues

### 1. add_clan_xp RPC - No auth.uid() check
**File:** `002_clan_premium.sql`, Line 13  
**Severity:** CRITICAL  
**Issue:** Any authenticated user can call `add_clan_xp(clan_id_param, xp_amount)` and add arbitrary XP to any clan.  
**Fix:** Add auth check or restrict to internal use only (called from award_clan_xp_for_user and resolve_prediction). Use REVOKE EXECUTE from authenticated and GRANT only to specific roles, or add auth.uid() check that caller must be clan member/admin.

### 2. Transactions INSERT - Overly permissive "System can insert" policy
**File:** `001_initial_schema.sql`, Line 230  
**Severity:** CRITICAL  
**Issue:** Policy `"System can insert transactions"` with `WITH CHECK (true)` allows anyone (including anon) to insert transactions for any user_id. 008/009 add "Users can insert own transactions" but never DROP the permissive policy.  
**Fix:** DROP POLICY "System can insert transactions" and rely on "Users can insert own transactions" for client. RPCs run as SECURITY DEFINER (postgres) and bypass RLS. Server uses supabaseAdmin (service role) and bypasses RLS.

### 3. Notifications INSERT - Overly permissive policy
**File:** `005_critical_ux.sql` Line 133, `009_ALL_IN_ONE_FIX.sql` Line 64  
**Severity:** CRITICAL  
**Issue:** Policy `"System can insert notifications"` with `WITH CHECK (true)` allows anyone to insert notifications for any user_id. Attacker could spam users.  
**Fix:** DROP this policy. Notifications should be inserted only by server (supabaseAdmin bypasses RLS) or via SECURITY DEFINER RPCs. Add no client-facing INSERT policy.

### 4. increment_coins - Server calls with other users' IDs will fail
**File:** `008_secure_rpcs.sql` Line 14, `009_ALL_IN_ONE_FIX.sql` Line 110  
**Severity:** CRITICAL  
**Issue:** `increment_coins` now requires `user_id_param = auth.uid()`. The server calls it for other users (e.g. challenge decline refunds `challenger_id`). When using supabaseAdmin (service role), auth.uid() may be null or the requesting user - so server's `increment_coins(challenger_id, amount)` will RAISE EXCEPTION.  
**Fix:** Create separate `admin_increment_coins` for server use, or allow when `auth.jwt() ->> 'role' = 'service_role'`.

### 5. Predictions INSERT - creator_id not validated
**File:** `001_initial_schema.sql`, Line 207  
**Severity:** CRITICAL  
**Issue:** Policy `"Authenticated users can create predictions"` uses `auth.role() = 'authenticated'` only. Attacker can insert prediction with `creator_id = victim_id`, impersonating victim.  
**Fix:** Add `WITH CHECK (auth.uid() = creator_id)`.

### 6. Clans INSERT - creator_id not validated
**File:** `001_initial_schema.sql`, Line 216  
**Severity:** CRITICAL  
**Issue:** Same as predictions - attacker can create clan with `creator_id = victim_id`.  
**Fix:** Add `WITH CHECK (auth.uid() = creator_id)`.

### 7. Clan_members INSERT - No membership validation
**File:** `001_initial_schema.sql`, Line 221  
**Severity:** CRITICAL  
**Issue:** Policy allows any authenticated user to add anyone to any clan.  
**Fix:** Add WITH CHECK: caller must be clan member/admin OR joining via valid invite. Complex - consider RPC for join.

### 8. Challenges INSERT - challenger_id not validated
**File:** `001_initial_schema.sql`, Line 225  
**Severity:** CRITICAL  
**Issue:** Attacker can create challenge with `challenger_id = victim_id`.  
**Fix:** Add `WITH CHECK (auth.uid() = challenger_id)`.

### 9. Bets INSERT - user_id not validated
**File:** `001_initial_schema.sql`, Line 212  
**Severity:** CRITICAL  
**Issue:** Policy allows any authenticated user to place bets as any user_id.  
**Fix:** Add `WITH CHECK (auth.uid() = user_id)`.

---

## MEDIUM Issues

### 10. increment_prediction_total - No auth.uid() check
**File:** `001_initial_schema.sql`, Line 143  
**Severity:** MEDIUM  
**Issue:** Client could call this RPC directly to inflate prediction totals. Only server uses it (predictions route).  
**Fix:** Add auth check or restrict to service role. REVOKE from authenticated, GRANT to service_role.

### 11. get_clan_leaderboard - No auth (acceptable)
**File:** `002_clan_premium.sql`, Line 49  
**Severity:** LOW (informational)  
**Issue:** Public read-only data. No auth needed. OK.

### 12. add_clan_xp - Race condition (missing FOR UPDATE)
**File:** `002_clan_premium.sql`, Lines 21-24  
**Severity:** MEDIUM  
**Issue:** `UPDATE clans SET xp = xp + xp_amount` without FOR UPDATE lock. Concurrent calls could have race.  
**Fix:** Use `SELECT ... FOR UPDATE` before update, or use atomic `UPDATE ... RETURNING` with proper locking.

### 13. resolve_prediction - Race condition on prediction
**File:** `004_resolve_prediction.sql`, `005_critical_ux.sql`, `009_ALL_IN_ONE_FIX.sql`  
**Severity:** MEDIUM  
**Issue:** Prediction row is read, then updated. Two creators could attempt to resolve simultaneously.  
**Fix:** Use `SELECT ... FOR UPDATE` when reading prediction.

### 14. Missing index on predictions.deadline
**File:** N/A  
**Severity:** MEDIUM  
**Issue:** Queries filter by `status = 'active'` and order by `deadline`. No composite index.  
**Fix:** `CREATE INDEX idx_predictions_active_deadline ON predictions(deadline) WHERE status = 'active'`.

### 15. Missing index on challenges(prediction_id, status)
**File:** N/A  
**Severity:** MEDIUM  
**Issue:** resolve_prediction queries `challenges WHERE prediction_id = ? AND status = 'accepted'`.  
**Fix:** `CREATE INDEX idx_challenges_pred_status ON challenges(prediction_id, status)`.

### 16. clan_messages - Missing UPDATE policy
**File:** `003_clan_chat.sql`  
**Severity:** LOW  
**Issue:** No UPDATE policy. Typically messages are not editable - OK. If edit needed, add policy.

### 17. Notifications type CHECK constraint missing in 009
**File:** `009_ALL_IN_ONE_FIX.sql`, Line 14  
**Severity:** MEDIUM  
**Issue:** 005 has `CHECK (type IN ('challenge_received', ...))`. 009's table creation omits it - type can be any text.  
**Fix:** Add CHECK constraint to notifications.type.

---

## LOW Issues

### 18. clan_members - Duplicate id in schema vs types
**File:** `001_initial_schema.sql` Line 75, `client/src/types/index.ts`  
**Severity:** LOW  
**Issue:** DB has `id` column on clan_members. Client ClanMember type uses (clan_id, user_id) as key. Not a mismatch - client may not need id. OK.

### 19. reference_id type - string vs UUID
**File:** `client/src/types/index.ts` Line 124, `001_initial_schema.sql` Line 107  
**Severity:** LOW  
**Issue:** DB uses UUID, client uses `string | null`. TypeScript string accepts UUID. OK.

### 20. client types - Missing ClanMessage, Notification, PredictionComment
**File:** `client/src/types/index.ts`  
**Severity:** LOW  
**Issue:** Tables exist in DB but no shared types. Components define local interfaces. Consider adding for consistency.

---

## Duplicate Function Definitions (no conflict - later migrations replace)
- `resolve_prediction`: 004 → 005 → 009 (correct, last wins)
- `increment_coins`: 001 → 006 → 008 → 009
- `place_bet`: 006 → 008 → 009
- `claim_daily_bonus`: 007 → 008 → 009
- `accept_challenge`: 007 → 009
- `award_clan_xp_for_user`: 005 → 008 → 009

---

## Tables/Columns Referenced in Code vs Migrations

| Referenced in code | Created in migration | Status |
|--------------------|----------------------|--------|
| clan_messages | 003 | OK |
| notifications | 005, 009 | OK |
| prediction_comments | 005, 009 | OK |
| profiles.last_daily_bonus | 007, 009 | OK |

---

## Summary
- **CRITICAL:** 9 issues (RLS policy holes, RPC auth bypass, server compatibility)
- **MEDIUM:** 7 issues (indexes, race conditions, constraints)
- **LOW:** 3 issues (types, minor)
