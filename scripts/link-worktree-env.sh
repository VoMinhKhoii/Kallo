#!/usr/bin/env bash
# When running inside a git worktree under `.claude/worktrees/`, symlink
# `.env.local` from the main repo so worktrees inherit secrets without manual
# copying. No-op when run from the main repo or when `.env.local` already
# exists in the current directory.
set -e

cwd=$(pwd)
case "$cwd" in
  */.claude/worktrees/*) ;;
  *) exit 0 ;;
esac

repo_root="${cwd%/.claude/worktrees/*}"
src="$repo_root/.env.local"
dst="$cwd/.env.local"

[ -e "$dst" ] && exit 0
[ -f "$src" ] || exit 0

ln -s "$src" "$dst"
echo "linked .env.local -> $src"
