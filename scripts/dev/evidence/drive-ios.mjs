// Drives the simulator by what is on screen, not by coordinates: a tap found by
// label still lands after a layout change, and a missing label fails loudly
// instead of tapping whatever now sits there. Needs `idb` (fb-idb) on PATH.
//
//   node scripts/dev/evidence/drive-ios.mjs labels
//   node scripts/dev/evidence/drive-ios.mjs tap '<label>'
//   node scripts/dev/evidence/drive-ios.mjs scroll down|up
//   node scripts/dev/evidence/drive-ios.mjs type '<field label or placeholder>' --env VAR
//   node scripts/dev/evidence/drive-ios.mjs type '<field label or placeholder>' '<text>'
//
// `--env VAR` types the value of VAR from the environment, so a password never
// appears in the command you write or its transcript (run with
// --env-file=.env.local).

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { findElement, isTextField } from './screen.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    udid: { type: 'string' },
    env: { type: 'string' },
  },
});
const [command, label, literal] = positionals;
// Flutter drops the end of typed text when the next tap lands too soon.
const SETTLE_MS = 1500;
const BACKSPACE = '42';
const udid = values.udid ?? bootedUdid();

/** The one booted simulator; idb, unlike simctl, takes no "booted" alias. */
function bootedUdid() {
  const { devices } = JSON.parse(
    execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], {
      encoding: 'utf8',
    })
  );
  const booted = Object.values(devices)
    .flat()
    .filter((d) => d.state === 'Booted');
  if (booted.length !== 1) {
    fail(
      booted.length === 0
        ? 'No simulator is booted.'
        : `${booted.length} simulators are booted; pass --udid.`
    );
  }
  return booted[0].udid;
}

function idb(...args) {
  try {
    return execFileSync('idb', [...args, '--udid', udid], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // idb prints a Python traceback; its last line says what went wrong.
    const reason = `${error.stderr ?? error.message}`.trim().split('\n').at(-1);
    fail(
      `idb ${args[0]} ${args[1] ?? ''} failed: ${reason}\nNeeds idb and idb_companion on PATH (docs/REAL_RUN_EVIDENCE.md).`
    );
  }
}
const screen = () => JSON.parse(idb('ui', 'describe-all'));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (command === 'labels') {
  const lines = screen()
    .map((e) => ({ e, text: e.AXLabel ?? e.AXValue ?? '' }))
    .filter(({ e, text }) => text || isTextField(e))
    .map(({ e, text }) => `${e.type}\t${JSON.stringify(text)}\n`);
  process.stdout.write(lines.join(''));
} else if (command === 'tap' && label) {
  const { x, y } = found(label).center;
  idb('ui', 'tap', String(x), String(y));
} else if (command === 'scroll' && (label === 'down' || label === 'up')) {
  const app = screen().find((e) => e.type === 'Application')?.frame;
  if (!app) fail('No app on screen.');
  const x = String(Math.round(app.width / 2));
  const [from, to] = [0.75, 0.3].map((f) => String(Math.round(app.height * f)));
  const [start, end] = label === 'down' ? [from, to] : [to, from];
  idb('ui', 'swipe', x, start, x, end, '--duration', '0.4');
} else if (command === 'type' && label) {
  const text = values.env ? process.env[values.env] : literal;
  if (!text)
    fail(
      values.env ? `${values.env} is empty.` : 'Pass the text or --env VAR.'
    );
  await typeInto(label, text);
} else {
  fail(
    'Usage: drive-ios.mjs labels | tap <label> | scroll down|up | type <field> (--env VAR | <text>)'
  );
}

/** Types into a field, then reads it back: Flutter can drop the last keys. */
async function typeInto(fieldLabel, text) {
  const { x, y } = found(fieldLabel).center;
  const typedLength = () =>
    (findElement(screen(), { at: { x, y } })?.element.AXValue ?? '').length;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const before = typedLength();
    idb('ui', 'tap', String(x), String(y));
    await pause(500);
    for (let i = 0; i < before + 5; i++) idb('ui', 'key', BACKSPACE);
    idb('ui', 'text', text);
    await pause(SETTLE_MS);
    // Secure fields read back as the same number of characters, never the text.
    if (typedLength() === text.length) return;
  }
  fail(`The field "${fieldLabel}" did not keep the typed text.`);
}

function found(text) {
  const match = findElement(screen(), { label: text });
  if (!match)
    fail(
      `Nothing on screen is labelled "${text}". Run "labels" to see what is.`
    );
  return match;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
