// Reads a Bash command the way the shell will run it: which `git push`es it
// runs, and from which directories. Quoted strings and heredoc bodies are data,
// not commands, so a commit message that mentions "git push" is never a push;
// the script of `bash -c '…'` is read as commands.
//
// It covers the forms agents write: `cd`, subshells, `VAR=…` assignments,
// `-C`, wrappers such as `env` or `nohup`, and nested shells. It is fast
// feedback, not a security boundary: CI gates every branch, so rarer shell
// grammar (a push inside a quoted `"$(…)"`, `eval`, aliases) is not modelled.
import path from 'node:path';

// A path argument: double-quoted, single-quoted, or bare.
const ARG = String.raw`("[^"]*"|'[^']*'|[^\s;&|()]+)`;
// Where a statement starts: the string start, `&&`, `||`, `;`, `|`, `(` or a
// newline.
const BOUNDARY = String.raw`(?:^|&&|\|\||[;|(\n])\s*`;
// Where a command starts: a statement start, then any `VAR=value` prefixes and
// wrappers that run the command after them.
const START = String.raw`${BOUNDARY}(?:(?:[A-Za-z_]\w*=\S*|env|command|exec|nohup|time)\s+)*`;
// `git` (bare or by path), its global options (`-C dir`, `-c key=value`,
// `--flag[=value]`), `push`.
const PUSH = new RegExp(
  String.raw`${START}(?:\S*\/)?git((?:\s+-[Cc]\s+${ARG}|\s+--[\w-]+(?:=\S+)?)*)\s+push(?=\s|$|[;&|)])([^;&|\n]*)`,
  'gd'
);
const CD = new RegExp(String.raw`${START}cd\s+${ARG}\s*(?=&&|;|\n|$)`, 'gd');
const GIT_C = new RegExp(String.raw`-C\s+${ARG}`, 'gd');
// A shell variable set as its own statement: `TREE=/x; cd "$TREE"`.
const ASSIGN = new RegExp(
  String.raw`${BOUNDARY}(?:export\s+)?([A-Za-z_]\w*)=${ARG}\s*(?=&&|;|\n|$)`,
  'gd'
);
// `bash -c 'script'`, `/bin/sh -lc "script"`, `zsh --noprofile -c script`.
const SHELL_C = new RegExp(
  String.raw`${START}(?:\S*\/)?(?:bash|sh|zsh)\s+(?:(?:--[\w-]+|-[A-Za-z]+)\s+)*?-[A-Za-z]*c[A-Za-z]*\s+${ARG}`,
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
// What the shell makes of a word: `~` and `$VAR` / `${VAR}` expand, from the
// command's own assignments first, unless single-quoted. An unknown variable
// stays literal, so the path will not exist and the hook falls back to the
// starting directory.
const expand = (arg, vars) =>
  arg.startsWith("'")
    ? unquote(arg)
    : unquote(arg)
        .replace(/^~(?=\/|$)/, process.env.HOME ?? '~')
        .replace(
          /\$(?:\{(\w+)\}|(\w+))/g,
          (m, a, b) => vars[a ?? b] ?? process.env[a ?? b] ?? m
        );
const resolve = (from, arg, vars) => path.resolve(from, expand(arg, vars));
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

// The shell's directory and variables where `masked` ends. A `cd` or an
// assignment inside `( … )` or `$( … )` lasts only until its subshell closes.
function shellStateAt(command, masked, start) {
  const events = [
    ...[...masked.matchAll(/[()]/g)].map((m) => ({ at: m.index, paren: m[0] })),
    ...[...masked.matchAll(CD)].map((cd) => ({
      at: cd.indices[1][0],
      cd: group(command, cd, 1),
    })),
    ...[...masked.matchAll(ASSIGN)].map((set) => ({
      at: set.indices[1][0],
      name: group(command, set, 1),
      value: group(command, set, 2),
    })),
  ].sort((a, b) => a.at - b.at);
  const outer = [];
  let state = start;
  for (const event of events) {
    if (event.paren === '(') outer.push(state);
    else if (event.paren === ')') state = outer.pop() ?? state;
    else if (event.cd !== undefined)
      state = { ...state, dir: resolve(state.dir, event.cd, state.vars) };
    else
      state = {
        ...state,
        vars: { ...state.vars, [event.name]: expand(event.value, state.vars) },
      };
  }
  return state;
}

function pushesIn(command, start) {
  const masked = maskData(command);
  const dirs = [];
  for (const push of masked.matchAll(PUSH)) {
    if (publishesNothing(group(command, push, 3) ?? '')) continue;
    const at = shellStateAt(command, masked.slice(0, push.index), start);
    let dir = at.dir;
    for (const gitC of (group(command, push, 1) ?? '').matchAll(GIT_C)) {
      dir = resolve(dir, gitC[1], at.vars);
    }
    dirs.push(dir);
  }
  for (const shell of masked.matchAll(SHELL_C)) {
    const at = shellStateAt(command, masked.slice(0, shell.index), start);
    dirs.push(...pushesIn(unquote(group(command, shell, 1) ?? ''), at));
  }
  return dirs;
}

/**
 * The directories every code-publishing `git push` in `command` runs in,
 * including pushes inside `bash -c` scripts; empty when it publishes nothing.
 */
export function pushDirectories(command, cwd) {
  return [...new Set(pushesIn(command, { dir: cwd, vars: {} }))];
}
