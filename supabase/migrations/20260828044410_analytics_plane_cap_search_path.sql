
-- The Supabase linter flags any function without a pinned search_path.
-- _cap is pure arithmetic over its argument, but pin it anyway so the
-- analytics surface lints clean.
alter function analytics._cap(int) set search_path = '';
