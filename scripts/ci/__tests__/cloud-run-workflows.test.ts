import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run prod workflow', () => {
  it('deploys only via manual dispatch, scoped to main', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // Prod deploys are a deliberate human action: merging to main must never
    // auto-ship. The dispatch takes an optional sha (a green-CI commit whose
    // image exists) and the job refuses non-main refs.
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('workflow_run:');
    expect(workflow).toContain(`if: github.ref == 'refs/heads/main'`);
    expect(workflow).toContain(
      `DEPLOY_SHA: \${{ inputs.sha != '' && inputs.sha || github.sha }}`
    );
    expect(workflow).not.toContain('github.event.workflow_run');
  });

  it('applies pending migrations on the deploy, then verifies them', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // Migrations are applied on the prod deploy itself, then re-asserted so a
    // partial push fails the deploy.
    expect(workflow).toContain(
      'run: yes | supabase db push --db-url "$PROD_DATABASE_URL_ENCODED"'
    );
    expect(workflow).toContain(
      'node ./scripts/cloud-run/shared-db.mjs assert-migrations-applied --db-url "$PROD_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
  });

  it('delegates embedding completion verification to the backfill script', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const backfill = readFileSync(
      resolve('scripts/db/backfill_embeddings.ts'),
      'utf8'
    );

    expect(workflow).not.toContain('Verify curated broth embeddings');
    expect(workflow).not.toContain('usda_6008_raw');
    expect(workflow).toContain('bun scripts/db/backfill_embeddings.ts');
    expect(backfill).toContain('countMissingEmbeddings');
    expect(backfill).toContain('Embedding backfill incomplete');
  });

  it('runs the embedding backfill on Vertex, not a free-tier API key', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const backfill = readFileSync(
      resolve('scripts/db/backfill_embeddings.ts'),
      'utf8'
    );

    // The deploy must embed with the same provider the service it ships runs
    // on. Exporting a GEMINI_API_KEY here would silently bill an abandoned
    // AI Studio free-tier key and reinstate the 35s-per-batch pacing.
    expect(workflow).not.toContain('export GEMINI_API_KEY=');
    expect(workflow).toContain('AI_PROVIDER: vertex');
    expect(workflow).toContain(
      `GOOGLE_CLOUD_PROJECT: \${{ vars.GCP_PROJECT_ID }}`
    );
    expect(workflow).toContain('GOOGLE_CLOUD_LOCATION: global');
    // Query embeddings go to the regional endpoint next to the service (same
    // model and vectors as global, a fraction of the latency).
    expect(workflow).toContain(
      'GOOGLE_CLOUD_EMBEDDING_LOCATION=asia-southeast1'
    );
    expect(backfill).toContain('vertexai: true');
    expect(backfill).toContain(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
    // The AI Studio path stays intact for local `dbr:reset` against .env.local.
    expect(backfill).toContain('apiKey: process.env.GEMINI_API_KEY');
    // Card retrieval stays on the legacy matcher until the card strings are
    // embedded, so the deploy must backfill them after the seed migration.
    expect(workflow).toContain('id: card_embed_check');
    // Postgres resolves tables at parse time, so the existence check must be
    // its own statement for an older DEPLOY_SHA with no card tables.
    expect(workflow).toContain(
      `SELECT to_regclass('public.food_card_texts') IS NOT NULL`
    );
    expect(workflow).not.toContain(
      'ELSE (SELECT count(*) FROM food_card_texts'
    );
    expect(workflow).toContain('bun scripts/db/backfill_card_embeddings.ts');
  });

  it('builds the card search artifact after the card backfill, skipping older commits', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const step = workflow.indexOf('- name: Build card search artifact');
    const backfill = workflow.indexOf('- name: Backfill food-card embeddings');
    const digest = workflow.indexOf('- name: Resolve image digest');

    expect(step).toBeGreaterThan(backfill);
    expect(step).toBeLessThan(digest);
    const body = workflow.slice(step, digest);
    // A redeploy checks out an older DEPLOY_SHA that may not have the builder.
    expect(body).toContain('if [ ! -f "$builder" ]; then');
    expect(body).toContain('bun "$builder" --bucket "$CARD_INDEX_BUCKET"');
    expect(body).toContain(`DATABASE_URL: \${{ env.PROD_DATABASE_URL }}`);
    expect(workflow).toContain('CARD_INDEX_BUCKET: kallo-prod-card-search');
    // bun must be set up on every deploy now, not only when a backfill runs.
    expect(workflow).toMatch(
      /- uses: \.\/\.github\/actions\/setup-bun\n\s+- name: Backfill food embeddings/
    );
    expect(
      existsSync(
        'scripts/data/food-cards/search-artifact/build-search-artifact.ts'
      )
    ).toBe(true);
    // The deploy record names the artifact each revision was deployed with.
    expect(workflow).toContain(
      `\\"card_index_uri\\":\\"\${CARD_INDEX_URI:-}\\"`
    );
  });

  it('pins each revision to its card search artifact and holds smoke until it loads', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    // Always passed, empty when the builder was skipped, so an older commit
    // never inherits a newer revision's build through --update-env-vars.
    expect(workflow).toContain(`|CARD_INDEX_URI=\${{ env.CARD_INDEX_URI }}`);
    const smoke = workflow.slice(
      workflow.indexOf('- id: smoke'),
      workflow.indexOf('- name: Promote candidate after smoke pass')
    );
    expect(smoke).toContain(
      `if [ -f lib/ai/matching/cards/search-index/search-index.ts ] && [ -n "\${CARD_INDEX_URI:-}" ]; then`
    );
    expect(smoke).toContain('select(.name == "CARD_INDEX_ENABLED")');
    expect(smoke).toContain('false|0|off|no|disabled|disable)');
    expect(smoke).toContain('smoke_args+=(--expect-card-index)');
    expect(smoke).toContain(
      `./scripts/cloud-run/smoke-check.sh "$SMOKE_URL" "\${smoke_args[@]}"`
    );
  });

  describe('the startup probe', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const start = workflow.indexOf('- name: Choose the startup probe');
    const script = workflow
      .slice(workflow.indexOf('run: |', start) + 'run: |'.length)
      .split('\n')
      .slice(1)
      .filter(
        (_, i, all) =>
          i < all.findIndex((l) => l.trim() && !l.startsWith(' '.repeat(10)))
      )
      .map((l) => l.slice(10))
      .join('\n');

    /** The flag the step chooses in a checkout with or without the route. */
    function chosenFlag(withRoute: boolean): string {
      const dir = mkdtempSync(join(tmpdir(), 'probe-step-'));
      try {
        if (withRoute) {
          mkdirSync(join(dir, 'app/api/startupz'), { recursive: true });
          writeFileSync(join(dir, 'app/api/startupz/route.ts'), '');
        }
        const output = join(dir, 'output');
        writeFileSync(output, '');
        const run = spawnSync(
          'bash',
          ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script],
          { cwd: dir, env: { ...process.env, GITHUB_OUTPUT: output } }
        );
        expect(run.status).toBe(0);
        return readFileSync(output, 'utf8').trim();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it('holds a container on /api/startupz when the commit has the route', () => {
      expect(chosenFlag(true)).toBe(
        'flag=--startup-probe=httpGet.path=/api/startupz,periodSeconds=1,timeoutSeconds=1,failureThreshold=40'
      );
    });

    it("gives an older commit Cloud Run's default probe, never the inherited one", () => {
      expect(chosenFlag(false)).toBe(
        'flag=--startup-probe=tcpSocket.port=8080,periodSeconds=240,timeoutSeconds=240,failureThreshold=1'
      );
    });

    it('passes the chosen probe to the deploy, which follows the choice', () => {
      const deploy = workflow.slice(workflow.indexOf('- id: deploy'));
      expect(workflow.indexOf('- id: deploy')).toBeGreaterThan(start);
      expect(deploy).toContain(`\${{ steps.probe.outputs.flag }}`);
    });

    // The route answers 200 by STARTUP_HOLD_MS whatever the build does; the
    // probe must outlast that, or a broken build would kill containers.
    it('gives the probe longer than the hold', async () => {
      const { STARTUP_HOLD_MS } = await import(
        '@/lib/ai/matching/cards/search-index/search-index'
      );
      const budgetSeconds = 40 * 1; // failureThreshold × periodSeconds
      expect(budgetSeconds * 1000).toBeGreaterThan(STARTUP_HOLD_MS + 10_000);
    });
  });

  it('loads the card search worker inside the built image before pushing it', () => {
    const ci = readWorkflow('ci.yml');
    const build = ci.indexOf('- name: Build container image');
    const check = ci.indexOf('- name: Card search worker runs in the image');
    const push = ci.indexOf('- name: Push container image');
    expect(build).toBeLessThan(check);
    expect(check).toBeLessThan(push);
    expect(ci.slice(check, push)).toContain('node /check/check-runtime.mjs');
    expect(existsSync('scripts/ci/card-index/check-runtime.mjs')).toBe(true);
    const dockerfile = readFileSync('Dockerfile', 'utf8');
    for (const path of [
      '/app/lib/ai/matching/cards/search-index/worker.mjs',
      '/app/lib/ai/matching/cards/search-index/search-core.mjs',
      '/app/lib/ai/matching/cards/search-index/artifact-fetch.mjs',
      '/app/node_modules/usearch/prebuilds/linux-x64',
      '/app/node_modules/node-gyp-build',
      '/app/node_modules/bindings',
      '/app/node_modules/file-uri-to-path',
    ]) {
      expect(dockerfile).toContain(path);
    }
  });

  it('refreshes the card index after a USDA translation, once its lease is released', () => {
    const workflow = readWorkflow('translate-usda.yml');
    expect(workflow).toContain('actions: write');
    const release = workflow.indexOf('- name: Release prod DB lease');
    const dispatch = workflow.indexOf('- name: Refresh the card search index');
    expect(dispatch).toBeGreaterThan(release);
    expect(workflow.slice(dispatch)).toContain('if: success()');
    expect(workflow.slice(dispatch)).toContain(
      'gh workflow run card-index-refresh.yml --repo "$GITHUB_REPOSITORY" --ref main'
    );
    // Never a deploy of main's tip, which could ship unreleased code.
    expect(workflow).not.toContain('gh workflow run cloud-run-prod.yml');
  });

  it('wires billing secrets and dark-launch controls into prod', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    for (const secret of [
      'kallo-prod-supabase-service-role-key',
      'kallo-prod-revenuecat-customer-delete-api-key',
      'kallo-prod-revenuecat-rest-api-key',
      'kallo-prod-revenuecat-webhook-secret',
    ]) {
      expect(workflow).toContain(secret);
    }
    expect(workflow).toContain('BILLING_ENVIRONMENT=production');
    expect(workflow).toContain(
      `BILLING_ENFORCEMENT_ENABLED: \${{ vars.BILLING_ENFORCEMENT_ENABLED || 'false' }}`
    );
    // The app-level trial is gone (welcome premium is a DB grant instead).
    expect(workflow).not.toContain('TRIAL_DAYS');
    expect(workflow).not.toContain('SUBSCRIPTION_LAUNCH_DATE');
  });

  it('wires the R2 object-storage credentials and buckets into prod', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    for (const secret of [
      'R2_ACCESS_KEY_ID=kallo-prod-r2-access-key-id:latest',
      'R2_SECRET_ACCESS_KEY=kallo-prod-r2-secret-access-key:latest',
      'gcloud secrets describe kallo-prod-r2-access-key-id',
      'gcloud secrets describe kallo-prod-r2-secret-access-key',
      // The free-tier cap reads usage with it; without it the cap is off.
      'CLOUDFLARE_ANALYTICS_TOKEN=kallo-prod-cloudflare-analytics-token:latest',
      'gcloud secrets describe kallo-prod-cloudflare-analytics-token',
      `R2_ACCOUNT_ID=\${{ vars.R2_ACCOUNT_ID }}`,
      'R2_BUCKET_PREFIX=kallo-prod',
    ]) {
      expect(workflow).toContain(secret);
    }
    // The CSP's img-src is compiled at build from these two.
    const ci = readWorkflow('ci.yml');
    expect(ci).toContain(
      `--build-arg NEXT_PUBLIC_AVATAR_BASE_URL=\${{ vars.NEXT_PUBLIC_AVATAR_BASE_URL }}`
    );
    expect(ci).toContain(
      `--build-arg R2_ACCOUNT_ID=\${{ vars.R2_ACCOUNT_ID }}`
    );
    // …and a published image may not be built without them.
    expect(ci).toContain('Require the storage build args on published images');
    expect(ci).toContain(
      `[ -n "\${{ vars.NEXT_PUBLIC_AVATAR_BASE_URL }}" ] ||`
    );
  });

  it('mounts the Sign in with Apple secrets only once they exist', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // Optional: an absent secret named in --set-secrets fails the deploy, so
    // the pair is appended from a detection step, never listed literally.
    expect(workflow).toContain(
      `APNS_KEY_P8=kallo-prod-apns-key-p8:latest\${{ steps.apple.outputs.secrets }}`
    );
    expect(workflow).toContain(
      'secrets=,APPLE_SIGNIN_KEY_P8=kallo-prod-apple-signin-key-p8:latest,APPLE_TOKEN_ENCRYPTION_KEY=kallo-prod-apple-token-encryption-key:latest'
    );
    expect(workflow).toContain('APPLE_SIGNIN_CLIENT_ID=com.khoivo.nham');
    expect(workflow).toContain(
      `APPLE_SIGNIN_KEY_ID=\${{ vars.APPLE_SIGNIN_KEY_ID }}`
    );

    const retry = readWorkflow('account-deletion-retry.yml');
    expect(retry).toContain('APPLE_SIGNIN_KEY_P8="$apple_key_p8"');
    expect(retry).toContain('APPLE_TOKEN_ENCRYPTION_KEY="$apple_token_key"');
  });

  it('does not resurrect retired non-production deploy workflows', () => {
    for (const name of [
      'cloud-run-internal.yml',
      'cloud-run-preview.yml',
      'cloud-run-staging.yml',
    ]) {
      expect(existsSync(resolve('.github/workflows', name))).toBe(false);
    }
  });
});

describe('Card index refresh workflow', () => {
  const workflow = readWorkflow('card-index-refresh.yml');
  const step = (name: string) => {
    const start = workflow.indexOf(`- name: ${name}`);
    expect(start).toBeGreaterThan(-1);
    const next = workflow.indexOf('\n      - ', start + 1);
    return workflow.slice(start, next === -1 ? undefined : next);
  };

  it('runs nightly and on demand, from main only, without an environment', () => {
    expect(workflow).toMatch(/schedule:\n\s+- cron: '0 19 \* \* \*'/);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('actions: write');
    // An environment with required reviewers would hold the check itself
    // for approval every night; only the deploy it dispatches waits.
    expect(workflow).not.toMatch(/^\s+environment:/m);
  });

  it('stays out of the way of an open prod deploy', () => {
    expect(step('Skip while a prod deploy is open')).toContain(
      'select(.status != "completed")'
    );
    expect(workflow).toContain("if: steps.busy.outputs.open == '0'");
  });

  it('compares with the build the serving revision is pinned to, using that commit', () => {
    const serving = step('Read the serving revision');
    expect(serving).toContain(
      'node scripts/cloud-run/card-index-refresh.mjs revision'
    );
    expect(serving).toContain(
      'node scripts/cloud-run/card-index-refresh.mjs pin'
    );
    expect(workflow).toContain(`ref: \${{ steps.serving.outputs.sha }}`);
    expect(workflow).toContain('path: serving');
    const compare = step('Compare the card data with the serving build');
    expect(compare).toContain('cd serving');
    expect(compare).toContain(
      'bun scripts/data/food-cards/search-artifact/build-search-artifact.ts'
    );
    // The builder must not leak the new URI into this job's environment.
    expect(compare).toContain('GITHUB_ENV= DATABASE_URL=');
  });

  it("redeploys the serving commit, never main's tip", () => {
    const redeploy = step('Redeploy the serving commit');
    expect(redeploy).toContain("if: steps.compare.outputs.stale == 'true'");
    expect(redeploy).toContain(
      'gh workflow run cloud-run-prod.yml --repo "$GITHUB_REPOSITORY" --ref main -f sha="$SERVING_SHA"'
    );
    expect(redeploy).toContain(
      `SERVING_SHA: \${{ steps.serving.outputs.sha }}`
    );
  });

  describe('steps, run as Actions runs them', () => {
    const SHA = '5ccae9e6b6827e67bbff9739674694f7050d9b55';
    const URI = 'gs://kallo-prod-card-search/f1/df0f52192c79-20261015T032505Z';
    const dirs: string[] = [];
    afterEach(() => {
      for (const d of dirs.splice(0))
        rmSync(d, { recursive: true, force: true });
    });

    /** The `run: |` script of a named step, de-indented. */
    function stepScript(name: string): string {
      const lines = workflow.split('\n');
      const at = lines.findIndex((l) => l.trim() === `- name: ${name}`);
      const run = lines.findIndex((l, i) => i > at && l.trim() === 'run: |');
      expect(at).toBeGreaterThan(-1);
      const body: string[] = [];
      for (const line of lines.slice(run + 1)) {
        if (line.trim() && !line.startsWith(' '.repeat(10))) break;
        body.push(line.slice(10));
      }
      return body.join('\n');
    }

    /**
     * Runs a step in a scratch workspace (with the refresh module and an empty
     * serving/ checkout), the given commands faked on PATH; returns its exit
     * status, stdout and $GITHUB_OUTPUT entries.
     */
    function runStep(
      name: string,
      fakes: Record<string, string>,
      env: Record<string, string> = {}
    ) {
      const dir = mkdtempSync(join(tmpdir(), 'card-refresh-step-'));
      dirs.push(dir);
      const bin = join(dir, 'bin');
      mkdirSync(bin);
      for (const [command, body] of Object.entries(fakes)) {
        writeFileSync(join(bin, command), `#!/usr/bin/env bash\n${body}\n`, {
          mode: 0o755,
        });
      }
      mkdirSync(join(dir, 'serving'));
      mkdirSync(join(dir, 'scripts/cloud-run'), { recursive: true });
      copyFileSync(
        resolve('scripts/cloud-run/card-index-refresh.mjs'),
        join(dir, 'scripts/cloud-run/card-index-refresh.mjs')
      );
      const output = join(dir, 'output');
      writeFileSync(output, '');
      writeFileSync(join(dir, 'step.sh'), stepScript(name));
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-eo', 'pipefail', join(dir, 'step.sh')],
        {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            GITHUB_OUTPUT: output,
            RUNNER_TEMP: dir,
            // The job's env block, and what "Read prod database URL" exports.
            SERVICE_NAME: 'kallo-prod',
            PROD_REGION: 'asia-southeast1',
            CARD_INDEX_BUCKET: 'kallo-prod-card-search',
            PROD_DATABASE_URL: 'postgresql://fake',
            PROD_DATABASE_URL_ENCODED: 'postgresql://fake',
            ...env,
          },
        }
      );
      const outputs = Object.fromEntries(
        readFileSync(output, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
      );
      return { status: result.status, stdout: result.stdout, outputs, dir };
    }

    describe('Read the serving revision', () => {
      const gcloud = `case "$2" in services) cat "$FAKE_SERVICE" ;; revisions) cat "$FAKE_REVISION" ;; esac`;
      const serving = (
        traffic: unknown[],
        env: { name: string; value: string }[]
      ) => {
        const dir = mkdtempSync(join(tmpdir(), 'card-refresh-json-'));
        dirs.push(dir);
        writeFileSync(
          join(dir, 'service.json'),
          JSON.stringify({ status: { traffic } })
        );
        writeFileSync(
          join(dir, 'revision.json'),
          JSON.stringify({
            metadata: { name: 'rev-2', labels: { 'commit-sha': SHA } },
            spec: { containers: [{ env }] },
          })
        );
        return runStep(
          'Read the serving revision',
          { gcloud },
          {
            FAKE_SERVICE: join(dir, 'service.json'),
            FAKE_REVISION: join(dir, 'revision.json'),
          }
        );
      };
      const all = [{ percent: 100, revisionName: 'rev-2' }];

      it('checks the commit and build serving all traffic', () => {
        const run = serving(all, [{ name: 'CARD_INDEX_URI', value: URI }]);
        expect(run.status).toBe(0);
        expect(run.outputs).toMatchObject({
          sha: SHA,
          uri: URI,
          revision: 'rev-2',
          check: 'true',
        });
      });

      it('skips while traffic is split', () => {
        const run = serving(
          [
            { percent: 50, revisionName: 'rev-1' },
            { percent: 50, revisionName: 'rev-2' },
          ],
          [{ name: 'CARD_INDEX_URI', value: URI }]
        );
        expect(run.status).toBe(0);
        expect(run.outputs.check).toBe('false');
      });

      it('skips a revision with no build pinned, or with the kill switch on', () => {
        expect(serving(all, []).outputs.check).toBe('false');
        expect(
          serving(all, [
            { name: 'CARD_INDEX_URI', value: URI },
            { name: 'CARD_INDEX_ENABLED', value: 'false' },
          ]).outputs.check
        ).toBe('false');
      });
    });

    describe('Compare the card data with the serving build', () => {
      // The builder fake records that it ran, and refuses to run with
      // GITHUB_ENV set (the URI would leak into the job's environment).
      const bun = `[ -z "$GITHUB_ENV" ] || exit 9
touch "$RUNNER_TEMP/bun-ran"
echo "[card-artifact] key abc"
[ -z "$FAKE_BUILT" ] || echo "CARD_INDEX_URI=$FAKE_BUILT"`;
      const compare = (pending: string, built: string) =>
        runStep(
          'Compare the card data with the serving build',
          { psql: `printf '%s\\n' "$FAKE_PENDING"`, bun },
          {
            FAKE_PENDING: pending,
            FAKE_BUILT: built,
            SERVING_URI: URI,
            GITHUB_ENV: '/dev/null',
          }
        );

      it('leaves an up-to-date build alone', () => {
        const run = compare('0', URI);
        expect(run.status).toBe(0);
        expect(run.outputs).toEqual({ stale: 'false' });
      });

      it('redeploys when the data built into a different build', () => {
        const run = compare(
          '0',
          'gs://kallo-prod-card-search/f1/aaaa-20261016T190000Z'
        );
        expect(run.status).toBe(0);
        expect(run.outputs.stale).toBe('true');
        expect(run.outputs.reason).toContain('the card data changed since');
      });

      it('redeploys without building while strings await embeddings', () => {
        const run = compare('3', URI);
        expect(run.status).toBe(0);
        expect(run.outputs).toEqual({
          stale: 'true',
          reason: '3 card strings need embeddings',
        });
        expect(existsSync(join(run.dir, 'bun-ran'))).toBe(false);
      });

      it('fails, never redeploys, when the count is not a number', () => {
        for (const pending of ['', 'BEGIN', 'COMMIT']) {
          const run = compare(pending, URI);
          expect(run.status).not.toBe(0);
          expect(run.outputs.stale).toBeUndefined();
        }
      });

      it('fails when the builder prints no URI', () => {
        const run = compare('0', '');
        expect(run.status).not.toBe(0);
        expect(run.outputs.stale).toBeUndefined();
      });
    });
  });
});

describe('CI workflow', () => {
  it('runs on pushes and PRs targeting both main and staging', () => {
    const workflow = readWorkflow('ci.yml');

    expect(workflow).toContain('branches: [main, staging]');
  });

  it('pushes images only from main, while PRs still build them', () => {
    const workflow = readWorkflow('ci.yml');
    const job = workflow.slice(workflow.indexOf('  container-publish:'));

    // cloud-run-prod.yml deploys only main SHAs; every other pushed image is
    // pure Artifact Registry storage cost. PRs must keep building the image so
    // a broken Dockerfile fails before merge.
    expect(job).toContain(
      `PUBLISH: \${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}`
    );
    expect(job).toMatch(
      /- name: Push container image\n\s+if: env\.PUBLISH == 'true'\n/
    );
    expect(job).toMatch(/- name: Build container image\n\s+env:/);
  });
});

describe('Artifact Registry retention', () => {
  it('tags the deployed image prod-<sha> before migrating', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const tagAt = workflow.indexOf(
      `gcloud artifacts docker tags add "$IMAGE_TAG" "\${IMAGE_TAG%:*}:prod-\${DEPLOY_SHA}"`
    );

    // The cleanup policy deletes images older than 14 days unless they carry
    // a prod- tag, so the tag must land before anything that can fail.
    expect(tagAt).toBeGreaterThan(-1);
    expect(tagAt).toBeLessThan(
      workflow.indexOf('- name: Apply pending migrations to prod DB')
    );
  });

  it('keeps recent prod releases and pins, and never deletes young images', () => {
    const policy = JSON.parse(
      readFileSync(
        resolve('scripts/cloud-run/artifact-cleanup-policy.json'),
        'utf8'
      )
    ) as Array<{
      action: { type: string };
      condition?: {
        tagState?: string;
        tagPrefixes?: string[];
        olderThan?: string;
      };
    }>;
    const keepPrefixes = policy
      .filter((rule) => rule.action.type === 'Keep')
      .flatMap((rule) => rule.condition?.tagPrefixes ?? []);
    const deletes = policy.filter((rule) => rule.action.type === 'Delete');

    expect(keepPrefixes).toEqual(expect.arrayContaining(['prod-', 'keep-']));
    // Nearly every image is SHA-tagged: a delete rule scoped to untagged
    // images would silently delete nothing.
    expect(deletes).toEqual([
      expect.objectContaining({
        condition: { tagState: 'any', olderThan: '14d' },
      }),
    ]);
  });
});
