# Object storage (Cloudflare R2)

Uploaded files live in Cloudflare R2, reached over its S3 API from the server
only. Code: `lib/infra/storage/` (public entry `object-storage.ts`). Supabase
still runs Auth and Postgres; its Storage buckets are no longer read or written.

## Buckets

One R2 bucket per logical bucket, named `{R2_BUCKET_PREFIX}-{bucket}`. They are
separate because R2 sets public access per bucket.

| Logical bucket | Access | Keys | Written by | Read by |
|---|---|---|---|---|
| `avatars` | **public**, custom domain `media.kallo.fit` (prod) | `{userId}/{uuid}.webp` | `uploadMyAvatar` (sharp re-encode, after type/size/magic-byte checks) | anyone with the URL (`avatarUrlFor`) |
| `feedback-screenshots` | private | `{userId}/{uuid}.{ext}` | `uploadFeedbackScreenshotAction` | admins, through a 5-minute presigned URL |
| `nutrition-labels` | private | `{userId}/{scanId}.{ext}` | the label scanner (metadata stripped) | the owner, through a 10-minute presigned URL (`GET /api/v1/nutrition-label/images/{id}`) |

Rows store the **key**, never a URL, so moving storage needs no data migration.

## Security model

- **No client holds a storage credential.** Browser and mobile upload to our
  routes; the server validates the bytes, builds the key from the session's
  user id plus a random UUID, and writes with the app's R2 token. With Supabase
  Storage the owner-prefix rule was backed up by `storage.objects` RLS; here
  the server-built key is the rule, and `submitFeedbackAction` /
  `isOwnAvatarPath` re-check the `{userId}/` prefix on any key read back from a
  row.
- **Writes never overwrite** (`If-None-Match: *`).
- **Private objects** are only reachable through presigned GETs (path-style, on
  `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`) with short lifetimes.
- **Account deletion** purges `{userId}/` in `avatars` and `nutrition-labels`
  before the Auth user is deleted and fails closed if a purge cannot be
  confirmed. `removePrefix` refuses an empty or unterminated prefix, so a bad id
  can never widen a purge.
- **Credentials**: one R2 API token per environment, *Object Read & Write*,
  scoped to that environment's three buckets only.
- **CSP**: `img-src` allows the avatar origin (`NEXT_PUBLIC_AVATAR_BASE_URL`)
  and the account's S3 origin (`R2_ACCOUNT_ID`), both read at `next build`.

## Configuration

| Variable | Where | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | runtime env + Docker build arg | Cloudflare account id (public) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | runtime secret | prod: Secret Manager `kallo-prod-r2-access-key-id` / `kallo-prod-r2-secret-access-key` |
| `R2_BUCKET_PREFIX` | runtime env | `kallo-prod` in prod, `kallo-dev` locally |
| `NEXT_PUBLIC_AVATAR_BASE_URL` | Docker build arg (GitHub variable) | `https://media.kallo.fit` in prod |

A missing credential makes every storage call throw a clear error.
`removeMyAvatar` and `deleteAccountAction` check the credentials before their
first write, so they fail without half-finishing.

## Provisioning a new environment

```bash
bunx wrangler r2 bucket create <prefix>-avatars
bunx wrangler r2 bucket create <prefix>-feedback-screenshots
bunx wrangler r2 bucket create <prefix>-nutrition-labels
# Public avatars on a custom domain in a zone on this account:
bunx wrangler r2 bucket domain add <prefix>-avatars --domain <host> --zone-id <zone>
```

Then create an R2 API token (Dashboard → R2 → Manage API tokens → *Object Read
& Write*, limited to the three buckets) and store its Access Key ID and Secret
Access Key as the two secrets above.

## Moving existing objects

`scripts/ops/copy-supabase-storage-to-r2.ts` copies every Supabase Storage
object to R2 under the same key, skips keys that are already there, and checks
afterwards that R2 has every key. Run it once before the deploy and again after,
to pick up files uploaded in between:

```bash
bun --conditions=react-server --env-file=<env> \
  scripts/ops/copy-supabase-storage-to-r2.ts [--dry-run]
```

The Supabase buckets and their `storage.objects` policies stay in place as a
rollback path; a follow-up migration drops them once R2 has been stable.

## Tests

- `lib/infra/storage/__tests__/object-storage.test.ts`: the S3 commands, with
  the client mocked (`aws-sdk-client-mock`).
- `lib/infra/storage/__tests__/object-storage.r2.test.ts`: the same module
  against real R2 (conditional put, presigned and public reads, prefix purge).
  Skipped unless `R2_INTEGRATION_TEST=1`, and never runs on a `*prod*` prefix:
  `R2_INTEGRATION_TEST=1 bun --env-file=.env.local run test -- lib/infra/storage/`
- Callers' tests mock `@/lib/infra/storage/object-storage` itself.
