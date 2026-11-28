#!/usr/bin/env bash
# One read-only Claude pass on a pinned commit, from Claude Code or from agy.
#
#   claude-pass.sh <model> <checkout> <sha> <out-file> <prompt-file>...
#
# <model> is claude-opus-5-5 for the bug review (claude/review.md, which runs the
# code-review plugin's agents itself) or claude-fable-5-2 for the structure review and the
# regression check. The prompt files are joined in order. Claude reviews a throwaway
# worktree of <sha> in plan mode with read tools only, and a macOS sandbox refuses writes to
# the repo's worktrees and .git. Exits non-zero when the run failed or wrote nothing.
set -u
[ $# -ge 5 ] || { sed -n '2,11p' "$0"; exit 2; }
MODEL=$1 CK=$2 SHA=$3 OUT=$4; shift 4
for f in "$@"; do [ -f "$f" ] || { echo "missing prompt file: $f" >&2; exit 2; }; done
mkdir -p "$(dirname "$OUT")"
OUTDIR=$(cd "$(dirname "$OUT")" && pwd)
REVIEW_DIR=$(mktemp -d "$OUTDIR/wt.XXXXXX") && rmdir "$REVIEW_DIR"
git -C "$CK" worktree add -q --detach "$REVIEW_DIR" "$SHA" || exit 1
trap 'git -C "$CK" worktree remove --force "$REVIEW_DIR" 2>/dev/null' EXIT
trap 'exit 130' INT; trap 'exit 143' TERM

DENY=$(git -C "$CK" worktree list --porcelain | sed -n 's/^worktree //p' \
  | grep -vxF "$REVIEW_DIR" | sed 's/.*/(subpath "&")/' | tr '\n' ' ')
COMMON=$(git -C "$CK" rev-parse --path-format=absolute --git-common-dir)
ADMIN=$(git -C "$REVIEW_DIR" rev-parse --path-format=absolute --git-dir)
PROFILE="(version 1)(allow default)(deny file-write* $DENY(subpath \"$COMMON\"))(allow file-write* (subpath \"$ADMIN\"))"

cat "$@" | (cd "$REVIEW_DIR" && env -u CLAUDECODE sandbox-exec -p "$PROFILE" claude -p \
  --model "$MODEL" --effort high \
  --permission-mode plan --permission-prompts none --no-session-persistence \
  --tools "Read,Grep,Glob,Bash,Agent,Task,Skill,TodoWrite" \
  --allowedTools "Read,Grep,Glob,Agent,Task,Skill,TodoWrite,Bash(git diff*),Bash(git log*),Bash(git show*),Bash(git status*),Bash(git rev-parse*),Bash(git ls-files*),Bash(git blame*),Bash(git grep*),Bash(grep*),Bash(ls*),Bash(cat*),Bash(head*),Bash(wc*)" \
  --disallowedTools "Edit,Write,NotebookEdit,WebFetch,WebSearch") > "$OUT" 2>&1
rc=$?
[ -s "$OUT" ] || rc=1
grep -qiE "usage limit|rate limit|out of (credits|usage)" "$OUT" && [ "$(wc -l < "$OUT")" -lt 5 ] && rc=quota
echo "claude-pass $MODEL exit $rc"; [ "$rc" = 0 ]
