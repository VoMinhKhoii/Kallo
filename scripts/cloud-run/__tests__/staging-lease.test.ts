import { spawnSync } from 'node:child_process';
import {
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

/**
 * staging-lease.sh against a fake `gcloud storage` holding one lease object
 * (state: `<dir>/state/gen` and `lease.json`), with a GNU-style `date` shim
 * so the script's `date -d` runs on macOS too.
 */
const GCLOUD = `#!/usr/bin/env bash
state="$FAKE_STATE"
args="$*"
match=""
for a in "$@"; do case "$a" in --if-generation-match=*) match="\${a#*=}" ;; esac; done
if [ "$1 $2" = "storage cp" ]; then
  if [[ "$3" == gs://* ]]; then # download
    [ -f "$state/gen" ] || { echo "ERROR: No URLs matched" >&2; exit 1; }
    cp "$state/lease.json" "$4"; exit 0
  fi
  current="$(cat "$state/gen" 2>/dev/null || echo 0)"
  if [ -n "$match" ] && [ "$match" != "$current" ]; then
    echo "ERROR: HTTPError 412: At least one of the pre-conditions you specified did not hold." >&2
    exit 1
  fi
  cp "$3" "$state/lease.json"; echo $((current + 100)) > "$state/gen"; exit 0
fi
if [ "$1 $2 $3" = "storage objects describe" ]; then
  [ -f "$state/gen" ] || { echo "ERROR: No URLs matched" >&2; exit 1; }
  cat "$state/gen"; exit 0
fi
if [ "$1 $2" = "storage rm" ]; then
  [ "$match" = "$(cat "$state/gen" 2>/dev/null)" ] || { echo "ERROR: 412" >&2; exit 1; }
  rm -f "$state/gen" "$state/lease.json"; exit 0
fi
echo "unexpected gcloud $args" >&2; exit 2
`;

const DATE = `#!/usr/bin/env node
// The GNU date forms staging-lease.sh uses: -u [-d <when>] +<format>.
const args = process.argv.slice(2).filter((a) => a !== '-u');
let when = new Date();
const d = args.indexOf('-d');
if (d !== -1) {
  const spec = args[d + 1];
  const rel = /^\\+(\\d+) hours$/.exec(spec);
  when = rel ? new Date(Date.now() + rel[1] * 3600e3) : new Date(spec);
  if (Number.isNaN(when.getTime())) process.exit(1);
}
const format = args.find((a) => a.startsWith('+')) ?? '+%s';
process.stdout.write(
  (format === '+%s'
    ? String(Math.floor(when.getTime() / 1000))
    : when.toISOString().replace(/\\.\\d{3}Z$/, 'Z')) + '\\n'
);
`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(holder?: { expiresAt: string }) {
  const dir = mkdtempSync(join(tmpdir(), 'lease-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const state = join(dir, 'state');
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(join(bin, 'gcloud'), GCLOUD, { mode: 0o755 });
  writeFileSync(join(bin, 'date'), DATE, { mode: 0o755 });
  if (holder) {
    writeFileSync(join(state, 'gen'), '111\n');
    writeFileSync(
      join(state, 'lease.json'),
      JSON.stringify({ owner: 'someone', expires_at: holder.expiresAt })
    );
  }
  return { dir, bin, state };
}

function acquire({ dir, bin, state }: ReturnType<typeof setup>) {
  const githubEnv = join(dir, 'github-env');
  writeFileSync(githubEnv, '');
  const run = spawnSync(
    'bash',
    [resolve('scripts/cloud-run/staging-lease.sh'), 'acquire'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_STATE: state,
        LEASE_BUCKET: 'kallo-prod-leases',
        LEASE_OBJECT: 'prod/lease.json',
        STAGING_REF: 'main',
        STAGING_REASON: 'test',
        STAGING_FORCE_TAKEOVER: 'false',
        STAGING_TARGET_SHA: 'a'.repeat(40),
        GITHUB_ENV: githubEnv,
        GITHUB_STEP_SUMMARY: '',
      },
    }
  );
  return { ...run, env: readFileSync(githubEnv, 'utf8') };
}

const inAnHour = () => new Date(Date.now() + 3600e3).toISOString();

describe('staging-lease.sh acquire', () => {
  it('takes a free lease and records its generation', () => {
    const fx = setup();
    const run = acquire(fx);
    expect(run.status).toBe(0);
    expect(run.env).toContain('LEASE_GENERATION=100');
  });

  // Before the fix the 412 fell through inside `if acquire_fresh_lease`, the
  // holder's generation (111) was recorded, and two deploys ran at once.
  it('refuses a lease someone else holds, and records nothing', () => {
    const fx = setup({ expiresAt: inAnHour() });
    const run = acquire(fx);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('currently leased');
    expect(run.env).not.toContain('LEASE_GENERATION');
    expect(readFileSync(join(fx.state, 'gen'), 'utf8').trim()).toBe('111');
  });

  it('takes over an expired lease', () => {
    const fx = setup({ expiresAt: '2020-01-01T00:00:00Z' });
    const run = acquire(fx);
    expect(run.status).toBe(0);
    expect(run.env).toContain('LEASE_GENERATION=211');
    expect(existsSync(join(fx.state, 'lease.json'))).toBe(true);
  });
});
