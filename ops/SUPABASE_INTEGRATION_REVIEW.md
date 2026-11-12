# Dabbir Supabase integration review

Status: **NOT READY TO MERGE OR DEPLOY**.

- Integration branch starts from the current `main` so the live custom domain and deployed demo are preserved.
- Source of Supabase backend changes: `feature/supabase-backend` (PR #2). That PR currently reports `mergeable_state=dirty`; resolve conflicts manually, preserving newer `main` changes.
- Keep only publishable/anon Supabase keys in browser builds. Never commit service_role or secret keys.
- Verify GitHub Actions deploy configuration, `dabbir.online` custom domain, and SPA routing.
- Verify Auth site URL and redirect allowlist, signup confirmation, password recovery and new-device flows in real browsers.
- Verify Data API grants and RLS ownership predicates, including column-level UPDATE grants on `profiles`.
- Run unit, integration, RLS and E2E checks; use separate test users and confirm cross-account isolation.
- Supabase security advisor currently reports leaked-password protection disabled; review before release.
- Do not merge to `main` until conflicts and checks are resolved.
