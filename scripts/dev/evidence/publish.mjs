// Uploads screenshots to the repo's `pr-evidence` branch and prints the
// Markdown that embeds them in a PR body. The branch only ever holds evidence
// files, so the PR's own diff stays clean, and each link pins the upload's
// commit so a later upload never changes an image a PR already shows.
//
//   node scripts/dev/evidence/publish.mjs <file-or-dir>...
//
// The repo is public: upload only screens of the dev evidence account.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EVIDENCE_BRANCH = 'pr-evidence';
const IMAGE = /\.(?:png|jpe?g|gif|webp)$/i;

/** Where a file lands on the evidence branch: grouped by branch, then commit. */
export function evidencePath(branch, sha, file) {
  return `${branch}/${sha.slice(0, 7)}/${basename(file)}`;
}

/** An image link pinned to the upload's commit, so it never changes later. */
export function imageMarkdown(repo, commit, path) {
  return `![${basename(path)}](https://github.com/${repo}/blob/${commit}/${path}?raw=true)`;
}

/**
 * The images among the arguments, expanding directories one level deep.
 * @param {string[]} args
 * @param {(dir: string) => string[]} [list]
 * @param {(path: string) => boolean} [isDir]
 */
export function imagesIn(
  args,
  list = readdirSync,
  isDir = (p) => statSync(p).isDirectory()
) {
  return args
    .flatMap((arg) =>
      isDir(arg) ? list(arg).map((name) => join(arg, name)) : [arg]
    )
    .filter((file) => IMAGE.test(file));
}

function gh(args, body) {
  return JSON.parse(
    execFileSync('gh', ['api', ...args, ...(body ? ['--input', '-'] : [])], {
      input: body ? JSON.stringify(body) : undefined,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  );
}

/** The evidence branch's head commit, or null before the first upload. */
function evidenceHead(repo) {
  try {
    return gh([`repos/${repo}/git/ref/heads/${EVIDENCE_BRANCH}`]).object.sha;
  } catch {
    return null;
  }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = imagesIn(process.argv.slice(2));
  if (files.length === 0) {
    process.stderr.write('Pass screenshot files or a folder of them.\n');
    process.exit(2);
  }
  const repo = execFileSync(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    {
      encoding: 'utf8',
    }
  ).trim();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const sha = git('rev-parse', 'HEAD');

  const parent = evidenceHead(repo);
  const tree = files.map((file) => ({
    path: evidencePath(branch, sha, file),
    mode: '100644',
    type: 'blob',
    sha: gh(['-X', 'POST', `repos/${repo}/git/blobs`], {
      content: readFileSync(file).toString('base64'),
      encoding: 'base64',
    }).sha,
  }));
  const baseTree = parent
    ? gh([`repos/${repo}/git/commits/${parent}`]).tree.sha
    : undefined;
  const newTree = gh(['-X', 'POST', `repos/${repo}/git/trees`], {
    base_tree: baseTree,
    tree,
  });
  const commit = gh(['-X', 'POST', `repos/${repo}/git/commits`], {
    message: `evidence: ${branch} @ ${sha.slice(0, 7)}`,
    tree: newTree.sha,
    parents: parent ? [parent] : [],
  }).sha;
  if (parent) {
    gh(['-X', 'PATCH', `repos/${repo}/git/refs/heads/${EVIDENCE_BRANCH}`], {
      sha: commit,
    });
  } else {
    gh(['-X', 'POST', `repos/${repo}/git/refs`], {
      ref: `refs/heads/${EVIDENCE_BRANCH}`,
      sha: commit,
    });
  }
  process.stdout.write(
    `${tree.map((t) => imageMarkdown(repo, commit, t.path)).join('\n')}\n`
  );
}
