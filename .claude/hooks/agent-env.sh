#!/bin/bash
# SessionStart hook: make an agent session's environment work.
#
# 1. Turn on the repo's git hooks (.githooks/), so an agent's push runs CI's
#    fast gates first. The pre-push hook only acts when CLAUDECODE=1, so a
#    person pushing from a terminal is unaffected. The setting lives in the
#    shared .git/config and so covers every worktree.
# 2. A session launched from a desktop app can start with a bare PATH
#    (/usr/bin:/bin:/usr/sbin:/sbin), so node, gh, codex, bun and flutter are
#    missing from every Bash call. Append the usual install dirs that exist and
#    are missing; a configured PATH keeps its precedence.
if [ -d "${CLAUDE_PROJECT_DIR:-.}/.githooks" ] &&
  [ "$(git -C "${CLAUDE_PROJECT_DIR:-.}" config --get core.hooksPath)" != ".githooks" ]; then
  git -C "${CLAUDE_PROJECT_DIR:-.}" config core.hooksPath .githooks
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
