// Screenshots the simulator for PR evidence, and fails when the run went wrong
// where the screen does not show it: a Flutter error in the `flutter run` log,
// or an API call the dev server answered with an error. Mark the server log
// before launching the app, drive the app to each screen
// (docs/REAL_RUN_EVIDENCE.md), then capture it:
//
//   node scripts/dev/evidence/capture-ios.mjs --out <dir> --server-log <dev log> --mark
//   node scripts/dev/evidence/capture-ios.mjs --out <dir> [--udid booted] \
//     [--log <flutter run log>] [--server-log <dev log>] <name>

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { flutterIssues } from './flutter-log.mjs';
import { apiFailures } from './server-log.mjs';

// A Pro Max screenshot is 1320×2868; this keeps text readable in a PR at a
// fraction of the size.
const MAX_SIDE_PX = 1200;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: join(tmpdir(), 'kallo-evidence', 'ios') },
    udid: { type: 'string', default: 'booted' },
    log: { type: 'string' },
    'server-log': { type: 'string' },
    mark: { type: 'boolean', default: false },
  },
});

mkdirSync(values.out, { recursive: true });
// Where this run's part of the dev server log starts: the log also holds every
// request from before the app launched.
const offsetFile = join(values.out, 'server-log.offset');

if (values.mark) {
  if (!values['server-log'])
    fail('--mark needs --server-log <dev server log>.');
  writeFileSync(offsetFile, String(statSync(values['server-log']).size));
  process.stdout.write(
    `Marked ${values['server-log']}; captures report API errors after this point.\n`
  );
  process.exit(0);
}

const name = positionals[0];
if (!name || !/^[\w.-]+$/.test(name)) {
  fail('Pass a screenshot name of letters, digits, dots and dashes.');
}

const file = join(values.out, `${name}-ios.png`);
// simctl reports success on stderr too; a failure still throws with its output.
execFileSync(
  'xcrun',
  ['simctl', 'io', values.udid, 'screenshot', '--type=png', file],
  { stdio: ['ignore', 'ignore', 'pipe'] }
);
execFileSync('sips', ['-Z', String(MAX_SIDE_PX), file, '--out', file], {
  stdio: 'ignore',
});
process.stdout.write(`${file}\n`);

const issues = [
  ...(values.log
    ? flutterIssues(readFileSync(values.log, 'utf8')).map(
        (i) => `flutter: ${i}`
      )
    : []),
  ...(values['server-log']
    ? apiFailures(sinceMark(values['server-log'])).map((i) => `api: ${i}`)
    : []),
];
for (const issue of issues) process.stdout.write(`- ${issue}\n`);
process.exitCode = issues.length > 0 ? 1 : 0;

/** The server log after the mark, or all of it when unmarked or restarted. */
function sinceMark(path) {
  const log = readFileSync(path);
  let offset = 0;
  try {
    offset = Number(readFileSync(offsetFile, 'utf8'));
  } catch {
    // No mark: the whole log.
  }
  return log.subarray(offset <= log.length ? offset : 0).toString('utf8');
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
