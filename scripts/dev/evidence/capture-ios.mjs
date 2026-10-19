// Screenshots the simulator for PR evidence and, given the `flutter run` log,
// fails when the app logged a Flutter error. Drive the app to the screen
// first (docs/REAL_RUN_EVIDENCE.md), then:
//
//   node scripts/dev/evidence/capture-ios.mjs --out <dir> \
//     [--udid booted] [--log <flutter run log>] <name>

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { flutterIssues } from './flutter-log.mjs';

// A Pro Max screenshot is 1320×2868; this keeps text readable in a PR at a
// fraction of the size.
const MAX_SIDE_PX = 1200;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: join(tmpdir(), 'kallo-evidence', 'ios') },
    udid: { type: 'string', default: 'booted' },
    log: { type: 'string' },
  },
});

const name = positionals[0];
if (!name || !/^[\w.-]+$/.test(name)) {
  process.stderr.write(
    'Pass a screenshot name of letters, digits, dots and dashes.\n'
  );
  process.exit(2);
}

mkdirSync(values.out, { recursive: true });
const file = join(values.out, `${name}-ios.png`);
execFileSync(
  'xcrun',
  ['simctl', 'io', values.udid, 'screenshot', '--type=png', file],
  {
    stdio: ['ignore', 'ignore', 'inherit'],
  }
);
execFileSync('sips', ['-Z', String(MAX_SIDE_PX), file, '--out', file], {
  stdio: 'ignore',
});
process.stdout.write(`${file}\n`);

if (values.log) {
  const issues = flutterIssues(readFileSync(values.log, 'utf8'));
  for (const issue of issues) process.stdout.write(`- flutter: ${issue}\n`);
  process.exitCode = issues.length > 0 ? 1 : 0;
}
