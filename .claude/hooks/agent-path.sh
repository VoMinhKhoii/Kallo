#!/bin/bash
# SessionStart hook: a session launched from a desktop app can start with a bare
# PATH (/usr/bin:/bin:/usr/sbin:/sbin), so node, gh, codex, bun and flutter are
# missing from every Bash call and agents cannot run the gates or a browser.
# Append the usual install dirs that exist and are missing; a configured PATH
# keeps its precedence.
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
