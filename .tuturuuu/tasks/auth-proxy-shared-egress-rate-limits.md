---
key: auth-proxy-shared-egress-rate-limits
name: Task
task_name: "Monitor Supabase per-IP auth rate limits behind the proxy"
visibility: workspace
priority: low
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Reported:** 2026-07-02 · **Reporter:** Claude (auth-proxy investigation) · **Severity:** low · **Area:** auth / infrastructure

## Summary

All users routed through `app/api/supabase-proxy` now share the Cloud Run service's egress IP against Supabase's **per-IP** auth rate limits (one shared bucket instead of one per user). Fine at current scale; needs watching as usage grows.

## Notes

- Signal to watch: `over_request_rate_limit` / HTTP 429 responses from proxied auth calls (both clients already surface a rate-limit message: `auth.errors.rateLimited`).
- If it bites: raise per-IP limits with Supabase, forward a client-IP header Supabase honors, or shard egress.
- Origin: mobile-login network investigation, 2026-07-02.
