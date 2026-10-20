// The Flutter errors a `flutter run` log shows. A debug build prints every
// framework exception, layout overflow and unhandled async error there, and the
// screen alone can hide them: an overflow stripe off-screen, a build error
// behind a fallback, a failed request behind an empty state.

// The first error prints as a block under this header (a layout overflow
// included); Flutter prints each later one as "Another exception was thrown".
const HEADER = /══╡ EXCEPTION CAUGHT BY (.+?) ╞/;
const ONE_LINE = [
  /(Another exception was thrown: .+)/,
  /(Unhandled Exception: .+)/,
];
// `flutter: ` on iOS, `I/flutter (123): ` on Android.
const PREFIX = /^(?:flutter: |I\/flutter \(\s*\d+\): )/;

/** Each distinct error in the log, once, in the order it first appeared. */
export function flutterIssues(log) {
  const lines = log.split('\n').map((line) => line.replace(PREFIX, '').trim());
  const issues = new Set();
  lines.forEach((line, i) => {
    const header = line.match(HEADER);
    if (header) {
      // The block's message follows its "The following … was thrown" line.
      const message = lines
        .slice(i + 1, i + 5)
        .find((l) => l !== '' && !l.startsWith('The following'));
      issues.add(`${header[1].toLowerCase()}: ${message ?? 'see the log'}`);
      return;
    }
    for (const pattern of ONE_LINE) {
      const match = line.match(pattern);
      if (match) issues.add(match[1]);
    }
  });
  return [...issues];
}
