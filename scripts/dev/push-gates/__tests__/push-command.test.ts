import { describe, expect, it } from 'vitest';
import { maskData, pushDirectory } from '../push-command.mjs';

const CWD = '/repo';

describe('pushDirectory', () => {
  it.each([
    ['git push', CWD],
    ['git push -u origin feat/x', CWD],
    ['git add a.ts && git commit -m "x" && git push', CWD],
    ['cd /work/tree && git push -u origin chore/y', '/work/tree'],
    ['cd sub && cd deeper; git push', '/repo/sub/deeper'],
    ['cd "/path with space" && git push', '/path with space'],
    ['git -C /other/tree push origin HEAD', '/other/tree'],
    ['cd /other && git -C sub push', '/other/sub'],
    ['git -c core.quotepath=false push origin HEAD', CWD],
    ['git --no-pager push', CWD],
    ['GIT_TRACE=1 git push', CWD],
    ['git push 2>&1 | tail -5', CWD],
    ['git push --dry-run && git push', CWD],
    ['git push origin :old HEAD:new', CWD],
    ['(cd /other && make); git push', CWD],
    ['(cd /a) && (cd /b); git push', CWD],
    ['cd /outer && (cd inner && git push)', '/outer/inner'],
    ['cd /outer && (make) && git push', '/outer'],
    ['echo $(cd /tmp && pwd) && git push', CWD],
    [
      "git commit -q -F - <<'EOF'\nfix: x\n\ngit push origin main\nEOF\ngit push",
      CWD,
    ],
  ])('gates %j from %s', (command, dir) => {
    expect(pushDirectory(command, CWD)).toBe(dir);
  });

  it.each([
    ['git status'],
    ['git commit -m "fix: run the gates before git push"'],
    ['echo git push'],
    ['echo "x && git push origin main"'],
    ["printf '%s\\n' 'a; git push'"],
    ["git commit -F - <<'EOF'\nfix: x\n\ngit push origin main\nEOF"],
    ['git push --dry-run'],
    ['git push -n origin x'],
    ['git push --delete origin old'],
    ['git push -d origin old'],
    ['git push origin :old'],
    ['gh pr create --title "push it"'],
  ])('ignores %j', (command) => {
    expect(pushDirectory(command, CWD)).toBeNull();
  });
});

describe('maskData', () => {
  it('blanks quoted text and heredoc bodies without moving anything', () => {
    const command = 'echo "a && b" \'c\'\ncat <<EOF\ngit push\nEOF\ngit push';
    const masked = maskData(command);
    expect(masked).toHaveLength(command.length);
    expect(masked).toBe(
      'echo "      " \' \'\ncat <<EOF\n        \nEOF\ngit push'
    );
  });

  it('treats an escaped quote inside double quotes as data', () => {
    // `a \" && git push` is 16 characters, all data.
    expect(maskData('echo "a \\" && git push" x')).toBe(
      `echo "${' '.repeat(16)}" x`
    );
  });
});
