# T03: 01-database-schema-infrastructure 03

**Slice:** S01 — **Milestone:** M001

## Description

Create RLS policies for all new tables so users can only access their own data.

Purpose: Security boundary enforcement. Without RLS, any authenticated user could read/modify any other user's meals, weight entries, and nutrition data. This is a Supabase requirement for any user-facing table.

Output: One raw SQL migration file (Domain B) with RLS policies for meals, meal_items, body_weight_log, and unmatched_ingredients.

## Must-Haves

- [ ] "User A cannot read or write User B's meals"
- [ ] "User A cannot read or write User B's meal items"
- [ ] "User A cannot read or write User B's body weight entries"
- [ ] "Unmatched ingredients are insert-only for authenticated users and readable by service role only"
- [ ] "All new tables have RLS enabled with no permissive default"

## Files

- `supabase/migrations/_rls_new_tables.sql`
