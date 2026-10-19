// Reads a Bash command the way the shell will run it: which `git push`es it
// runs, and from which directories. Quoted strings and heredoc bodies are data,
// not commands, so a commit message that mentions "git push" is never a push;
// the script of `bash -c '…'` is read as commands. A push inside a quoted
// `"$(…)"` is not seen.
import path from 'node:path';

// A path argument: double-quoted, single-quoted, or bare.
const ARG = String.raw`("[^"]*"|'[^']*'|[^\s;&|()]+)`;
// Where a command starts: the string start, `&&`, `||`, `;`, `|`, `(` or a
// newline, optionally behind `VAR=value` prefixes.
const START = String.raw`(?:^|&&|\|\||[;|(\n])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
// `git`, its global options (`-C dir`, `-c key=value`, `--flag[=value]`), `push`.
const PUSH = new RegExp(
  String.raw`${START}git((?:\s+-[Cc]\s+${ARG}|\s+--[\w-]+(?:=\S+)?)*)\s+push(?=\s|$|[;&|)])([^;&|\n]*)`,
  'gd'
);
const CD = new RegExp(String.raw`${START}cd\s+${ARG}\s*(?=&&|;|\n|$)`, 'gd');
const GIT_C = new RegExp(String.raw`-C\s+${ARG}`, 'gd');
// `bash -c 'script'`, `sh -lc "script"`, `zsh -c script`.
const SHELL_C = new RegExp(
  String.raw`${START}(?:bash|sh|zsh)\s+(?:-[A-Za-z]+\s+)*?-[A-Za-z]*c[A-Za-z]*\s+${ARG}`,
  'gd'
);
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n/g;

const blank = (chars, from, to) => {
  for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' ';
};

/** `command` with heredoc bodies and quoted text blanked, indices unchanged. */
export function maskData(command) {
  const chars = command.split('');
  const bodies = [];
  for (const heredoc of command.matchAll(HEREDOC)) {
    const start = heredoc.index + heredoc[0].length;
    const end = new RegExp(String.raw`^\s*${heredoc[2]}\s*$`, 'm').exec(
      command.slice(start)
    );
    bodies.push([start, end ? start + end.index : command.length]);
  }
  let quote = null;
  for (let i = 0; i < chars.length; i++) {
    const body = bodies.find(([from, to]) => i >= from && i < to);
    if (body) {
      blank(chars, body[0], body[1]);
      i = body[1] - 1;
      continue;
    }
    const c = command[i];
    if (quote === null) {
      if (c === '"' || c === "'") quote = c;
      else if (c === '\\') i++;
    } else if (c === quote) quote = null;
    else if (quote === '"' && c === '\\') {
      blank(chars, i, i + 2); // the backslash and the character it escapes
      i++;
    } else blank(chars, i, i + 1);
  }
  return chars.join('');
}

const unquote = (arg) => arg.replace(/^(["'])([\s\S]*)\1$/, '$2');
// What the shell makes of a path word: `~` and `$VAR` / `${VAR}` expand unless
// single-quoted. An unknown variable stays literal, so the path will not exist
// and the hook falls back to the starting directory.
const expand = (arg) =>
  arg.startsWith("'")
    ? unquote(arg)
    : unquote(arg)
        .replace(/^~(?=\/|$)/, process.env.HOME ?? '~')
        .replace(
          /\$(?:\{(\w+)\}|(\w+))/g,
          (m, a, b) => process.env[a ?? b] ?? m
        );
const resolve = (from, arg) => path.resolve(from, expand(arg));
// The original text of capture group `n`, located on the masked string.
const group = (command, match, n) =>
  match.indices[n] ? command.slice(...match.indices[n]) : undefined;

// A push that cannot publish code: a dry run, or deleting refs only.
function publishesNothing(args) {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.some((t) => ['--dry-run', '-n', '--delete', '-d'].includes(t)))
    return true;
  const refspecs = tokens.filter((t) => !t.startsWith('-')).slice(1);
  return refspecs.length > 0 && refspecs.every((r) => r.startsWith(':'));
}

// The shell's directory where `masked` ends. A `cd` inside `( … )` or `$( … )`
// lasts only until its subshell closes.
function directoryAt(command, masked, cwd) {
  const events = [
    ...[...masked.matchAll(/[()]/g)].map((m) => ({ at: m.index, paren: m[0] })),
    ...[...masked.matchAll(CD)].map((cd) => ({
      at: cd.indices[1][0],
      arg: group(command, cd, 1),
    })),
  ].sort((a, b) => a.at - b.at);
  const outer = [];
  let dir = cwd;
  for (const event of events) {
    if (event.paren === '(') outer.push(dir);
    else if (event.paren === ')') dir = outer.pop() ?? dir;
    else dir = resolve(dir, event.arg);
  }
  return dir;
}

/**
 * The directories every code-publishing `git push` in `command` runs in,
 * including pushes inside `bash -c` scripts; empty when it publishes nothing.
 */
export function pushDirectories(command, cwd) {
  const masked = maskData(command);
  const dirs = [];
  for (const push of masked.matchAll(PUSH)) {
    if (publishesNothing(group(command, push, 3) ?? '')) continue;
    let dir = directoryAt(command, masked.slice(0, push.index), cwd);
    const options = group(command, push, 1) ?? '';
    for (const gitC of options.matchAll(GIT_C)) {
      dir = resolve(dir, gitC[1]);
    }
    dirs.push(dir);
  }
  for (const shell of masked.matchAll(SHELL_C)) {
    const at = directoryAt(command, masked.slice(0, shell.index), cwd);
    dirs.push(...pushDirectories(unquote(group(command, shell, 1) ?? ''), at));
  }
  return [...new Set(dirs)];
}
