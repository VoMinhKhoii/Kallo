# nham_mobile

Flutter client for **Kallo** — the AI-powered Vietnamese meal tracker. A 1:1 port of the web app's
mobile view, sharing the same `/api/v1` backend and Supabase project.

## Run it

```bash
./tool/run_dev.sh        # iOS Simulator, dev config (localhost API + dev Supabase)
```

## Ship it

```bash
cd ios && fastlane ios beta   # build + sign + upload to TestFlight
```

## Docs

See [`apps/docs/mobile`](../docs/mobile/README.md):

- [development.md](../docs/mobile/development.md) — local dev loop, env config, gotchas
- [releasing.md](../docs/mobile/releasing.md) — TestFlight pipeline, signing, export compliance
- [architecture.md](../docs/mobile/architecture.md) — structure, stack, web parity

Web↔Flutter fidelity tracking lives in [`FIDELITY_AUDIT.md`](./FIDELITY_AUDIT.md).
