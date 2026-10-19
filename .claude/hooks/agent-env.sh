#!/bin/bash
# SessionStart hook: make an agent session's environment work.
#
# 1. Turn on the repo's git hooks (.githooks/), so an agent's push runs CI's
#    fast gates first. The pre-push hook only acts when CLAUDECODE=1, so a
#    person pushing from a terminal is unaffected. The setting lives in the
#    shared .git/config and so covers every worktree. A hooks setup someone
#    already has (another core.hooksPath, or active hooks in .git/hooks) is
#    left alone, with a note, rather than silently replaced.
# 2. A session launched from a desktop app can start with a bare PATH
#    (/usr/bin:/bin:/usr/sbin:/sbin), so node, gh, codex, bun and flutter are
#    missing from every Bash call. Append the usual install dirs that exist and
#    are missing; a configured PATH keeps its precedence.
repo="${CLAUDE_PROJECT_DIR:-.}"
# Whether git would run .githooks/pre-push right now, however core.hooksPath is
# spelled (".githooks", "./.githooks", an absolute path): ask git, compare files.
gate_on() {
  (cd "$repo" && [ "$(git rev-parse --git-path hooks/pre-push)" -ef .githooks/pre-push ])
}
if [ -d "$repo/.githooks" ] && ! gate_on; then
  current="$(git -C "$repo" config --get core.hooksPath)"
  hooks_dir="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/hooks"
  # Regular files and symlinks alike: hook managers often install symlinks.
  active="$(find "$hooks_dir" -maxdepth 1 \( -type f -o -type l \) ! -name '*.sample' 2>/dev/null | head -1)"
  if [ -z "$current" ] && [ -z "$active" ]; then
    git -C "$repo" config core.hooksPath .githooks
  else
    echo "Note: the agent pre-push gate (.githooks/) is off because this repo already has git hooks set up. Chain .githooks/pre-push from them to turn it on." >&2
  fi
fi

[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0

add=""
for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.local/bin" "$HOME/.bun/bin"; do
  [ -d "$dir" ] || continue
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) add="$add:$dir" ;;
  esac
done

if [ -n "$add" ]; then
  echo "export PATH=\"\$PATH$add\"" >> "$CLAUDE_ENV_FILE"
fi
exit 0
