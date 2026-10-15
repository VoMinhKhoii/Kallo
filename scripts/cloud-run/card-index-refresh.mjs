/**
 * Reads what the card index refresh (`.github/workflows/card-index-refresh.yml`)
 * compares against: the revision serving prod, and the commit and card search
 * build that revision is pinned to.
 *
 *   node scripts/cloud-run/card-index-refresh.mjs revision <service.json>
 *     the revision taking all traffic; prints nothing when traffic is split
 *   node scripts/cloud-run/card-index-refresh.mjs pin <revision.json>
 *     sha=, uri= and enabled= lines, for $GITHUB_OUTPUT
 *
 * The JSON files are `gcloud run services|revisions describe --format=json`.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The values the app reads as off (`readBooleanEnv`, CARD_INDEX_ENABLED). */
const OFF = new Set(['false', '0', 'off', 'no', 'disabled', 'disable']);
const SHA = /^[0-9a-f]{40}$/;

/** The revision taking 100% of traffic, or null while traffic is split. */
export function servingRevision(service) {
  const full = (service.status?.traffic ?? []).filter(
    (t) => t.percent === 100 && t.revisionName
  );
  return full.length === 1 ? full[0].revisionName : null;
}

/**
 * The commit a revision was deployed from (the `commit-sha` label the prod
 * deploy sets), its pinned build, and whether the kill switch leaves the
 * build in use. Throws on a revision without a commit label.
 */
export function revisionPin(revision) {
  const sha = revision.metadata?.labels?.['commit-sha'] ?? '';
  if (!SHA.test(sha)) {
    throw new Error(
      `revision ${revision.metadata?.name} has no commit-sha label (${sha || 'none'})`
    );
  }
  const env = revision.spec?.containers?.[0]?.env ?? [];
  const value = (name) => env.find((e) => e.name === name)?.value ?? '';
  return {
    sha,
    uri: value('CARD_INDEX_URI').trim(),
    enabled: !OFF.has(value('CARD_INDEX_ENABLED').trim().toLowerCase()),
  };
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// By real path: run through a symlink, argv[1] names the link while
// import.meta.url names its target, and a CLI that silently did nothing would
// read as "traffic is split" every night.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, file] = process.argv.slice(2);
  if (command === 'revision') {
    console.log(servingRevision(readJson(file)) ?? '');
  } else if (command === 'pin') {
    const pin = revisionPin(readJson(file));
    console.log(`sha=${pin.sha}\nuri=${pin.uri}\nenabled=${pin.enabled}`);
  } else {
    console.error('usage: card-index-refresh.mjs revision|pin <file.json>');
    process.exit(2);
  }
}
