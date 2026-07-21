-- Supersession key for pending_analyses. The client sends a stable attempt_id
-- per logging attempt; the analyze insert upserts on (user_id, attempt_id) so a
-- re-analysis (cheat-clarify, retry) overwrites its predecessor instead of
-- leaving an orphan row that renders as a duplicate "unsaved" card. Nullable so
-- legacy rows and non-analyze staging paths (barcode, cheat-repeat) keep
-- working; Postgres treats NULLs as distinct in a unique index, so they never
-- collide.
ALTER TABLE "pending_analyses" ADD COLUMN "attempt_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_analyses_user_attempt_key" ON "pending_analyses" USING btree ("user_id","attempt_id");