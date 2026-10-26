# Real-run evidence

A change a user can see is opened in a real browser or simulator before its PR,
and the PR carries the screenshots. Between 2026-07-15 and 2026-10-19, 20 of the
38 fixes for something an earlier PR broke came within a day of the merge, found
by running the app where it really runs: a feed drawn at zero width (#307), a
grey crash screen on a handset (#353), product images that were never committed
(#241), a paywall that did not fit (#411). Tests and review had passed each one.
`/ship` Phase 3c runs this; the scripts live in `scripts/dev/evidence/`.

Everything here runs against the **dev** project from `.env.local`, signed in as
the dev evidence account. Never point it at prod, and never upload a screen that
shows a real person's data: the repo is public.

## One-time setup

`.env.local` needs the evidence account (dev only; `.env.example` lists them):

```bash
EVIDENCE_ACCOUNT_EMAIL=   # a dev account with realistic meal history
EVIDENCE_ACCOUNT_PASSWORD= # only for an iOS build released before code sign-in
```

Neither capture needs a password: the web capture signs in with an admin magic
link and the iOS one with an admin-minted sign-in code (`sign-in.mjs --code`),
and neither sends email. A build released before code sign-in still signs in
by password; give the account one once, on the dev project only, with the
Supabase admin API (`auth.admin.updateUserById`) or the dev dashboard.

The iOS steps need Xcode with an iPhone simulator, and `idb` plus
`idb_companion` on PATH (`pip install fb-idb`, `brew install
facebook/fb/idb-companion`) to tap and type.

## Web

1. Start the dev server from the branch's checkout, in the background, its log
   in a file (the iOS steps read it). A worktree needs its own `bun install
   --frozen-lockfile`; a symlinked `node_modules` makes Turbopack panic.

   ```bash
   bun run dev > <scratchpad>/dev-server.log 2>&1    # http://localhost:3000
   ```

2. Capture every route the change reaches:

   ```bash
   node --env-file=.env.local scripts/dev/evidence/capture-web.mjs \
     --out <scratchpad>/evidence /en/logging /en/dashboard
   ```

   Each route is captured at phone (390 px, 2×) and desktop (1280 px) width.
   The run fails, and `report.md` in the output folder says why, when a page:
   - returns an error status, or a signed-in page lands on sign-in;
   - logs a console error or an uncaught exception;
   - has a request that fails or returns 5xx;
   - scrolls sideways (wider than the screen);
   - shows an image that did not load.

   Options: `--signed-out` for public pages, `--width phone` for one width,
   `--full-page` for the whole scroll height, `--base-url` for another server,
   `--theme dark` (or `aurora`, `light`) to set Settings → Appearance first —
   a change to colours or surfaces runs once per theme.

3. A failure that also happens on main is not this PR's: confirm it on main,
   pass it with `--allow '<text from the issue>'`, and name it under Evidence as
   pre-existing.

4. A state the route alone does not reach (an open sheet, a filled form, an
   error toast) needs clicking. Sign Playwright MCP in with
   `node --env-file=.env.local scripts/dev/evidence/sign-in.mjs /en/logging`,
   which prints a one-time path to open on the dev server, then drive the page
   and screenshot that state.

## iOS

1. With the dev server from Web step 1 running (the app's API calls land in its
   log), mark where this run starts in the log:

   ```bash
   node scripts/dev/evidence/capture-ios.mjs --out <scratchpad>/evidence \
     --server-log <scratchpad>/dev-server.log --mark
   ```

2. Run the dev app on the simulator, its `flutter run` log kept too:

   ```bash
   cd apps/mobile-flutter
   SIM_UDID=<udid> WORK=/tmp/kallo-flutter-<task> NHAM_ENV_FILE=<repo>/.env.local \
     ./tool/run_dev.sh > <scratchpad>/flutter-run.log 2>&1   # in the background
   ```

   `run_dev.sh` mirrors the app to `$WORK` (out of iCloud) and points it at
   `http://localhost:3000`. The first build takes a few minutes. Run one heavy
   toolchain job at a time (AGENTS.md §8).

3. Drive the app by what is on screen, never by coordinates:
   `drive-ios.mjs labels` lists what can be tapped, `tap '<label>'` taps it,
   `scroll down|up` scrolls, and `type '<field>' --env VAR` types a value from
   `.env.local` and reads the field back (Flutter drops the last keys of text
   typed just before the next tap). A full-screen page such as Log hides the tab
   bar, so a remembered coordinate would tap something else. Sign in once per
   simulator; the session survives relaunches:

   ```bash
   D() { node --env-file=.env.local scripts/dev/evidence/drive-ios.mjs "$@"; }
   D tap 'I already have an account'; D tap 'Continue with email'
   D type 'you@example.com' --env EVIDENCE_ACCOUNT_EMAIL
   D tap 'Send code'
   # A fresh code minted by the admin API replaces the one just sent:
   EVIDENCE_CODE=$(node --env-file=.env.local scripts/dev/evidence/sign-in.mjs --code) \
     D type '000000' --env EVIDENCE_CODE
   ```

   A full code signs in by itself.

   Already signed in as someone else, or seeing "This didn't load" with 401s
   in the server log (a reset password ends the old session): Settings →
   `scroll down` → Sign out → Sign out, then the steps above.

4. Open each screen the change reaches and capture it:

   ```bash
   node scripts/dev/evidence/capture-ios.mjs --out <scratchpad>/evidence \
     --log <scratchpad>/flutter-run.log \
     --server-log <scratchpad>/dev-server.log <screen-name>
   ```

   It saves `<screen-name>-ios.png` (downscaled to 1200 px) and fails when:
   - the run log shows a Flutter exception, layout overflow or unhandled async
     error (the overflow stripe can sit off-screen);
   - an `/api/v1` call since the mark got an error status. A failed request
     often shows as an empty or "didn't load" state and logs nothing in Flutter.

## Look, then publish

Look at every screenshot yourself before publishing; downscale first
(`sips -Z 1000`, AGENTS.md §8). A clean report means nothing crashed, not that
the screen is right: check the change is visible and nothing around it moved.

```bash
node scripts/dev/evidence/publish.mjs <scratchpad>/evidence
```

`publish.mjs` uploads the images to the `pr-evidence` branch (never the PR's own
branch, so its diff stays clean) under `<branch>/<commit>/`, and prints the
Markdown for the PR's Evidence section. Each link is pinned to its upload, so
later uploads never change what an earlier PR shows.

When a run is not possible (no simulator, the dev database is behind the
branch's migrations), Evidence says so: "Not run on iOS: <reason>".
