---
key: android-auth-proxy-build-config
name: Task
task_name: "Point Android release builds at the Supabase auth proxy"
visibility: workspace
priority: low
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Reported:** 2026-07-02 · **Reporter:** Claude (auth-proxy investigation) · **Severity:** low · **Area:** mobile / release config

## Summary

When Android release lanes are set up, their `SUPABASE_URL` dart-define must point at `<API_BASE_URL>/api/supabase-proxy` (like the iOS `beta` lane in `apps/mobile-flutter/ios/fastlane/Fastfile`), not at supabase.co directly — otherwise Android users on affected VN networks can't log in.

## Notes

- Mirror the iOS Fastfile pattern: derive the default from `API_BASE_URL` so the two can't drift, with an env override to go direct.
- Origin: mobile-login network investigation, 2026-07-02 (see `app/api/supabase-proxy`).
