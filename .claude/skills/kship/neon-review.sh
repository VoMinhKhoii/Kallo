#!/usr/bin/env bash
# Neon review in the shape of Anthropic's code-review plugin, every agent on Gemini 4 Neon:
# four reviewers in parallel (two CLAUDE.md/AGENTS.md, two bug hunters), then one validator
# per finding. The /kship author merges the reviewers' findings and writes one file per
# finding between the two steps.
#
#   neon-review.sh find   <checkout> <sha> <out-dir> <brief> [pass-file]
#       -> <out-dir>/find-{rules-1,rules-2,bugs-diff,bugs-code}.md
#   neon-review.sh verify <checkout> <sha> <out-dir> <brief> <finding-file>...
#       -> <finding-file minus .md>.verdict.md, first line VALID or INVALID
#       (F*.prompt.md and F*.verdict.md arguments are skipped, so a retry can reuse F*.md)
#
# Every run is read-only: a throwaway worktree of <sha>, agy plan mode with an allow list of
# read commands, and a macOS sandbox that refuses writes to the repo's worktrees and .git.
# Prints one status line per run (ok, FAILED, or QUOTA when Neon is out of quota);
# exits 0 only when every run produced a review.
set -u
[ $# -ge 5 ] || { sed -n '2,15p' "$0"; exit 2; }
MODE=$1 CK=$2 SHA=$3 OUT=$4 BRIEF=$5; shift 5
[ -f "$BRIEF" ] || { echo "missing brief: $BRIEF" >&2; exit 2; }
if [ "$MODE" = find ]; then [ -z "${1:-}" ] || [ -f "$1" ] || { echo "missing pass file: $1" >&2; exit 2; }; fi
if [ "$MODE" = verify ]; then
  [ $# -gt 0 ] || { echo "verify needs at least one finding file" >&2; exit 2; }
  for f in "$@"; do case $f in *.prompt.md|*.verdict.md) continue ;; esac
    [ -f "$f" ] || { echo "missing finding file: $f" >&2; exit 2; }; done
fi
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)

REVIEW_DIR=$(mktemp -d "$OUT/wt.XXXXXX") && rmdir "$REVIEW_DIR"
git -C "$CK" worktree add -q --detach "$REVIEW_DIR" "$SHA" || exit 1
trap 'git -C "$CK" worktree remove --force "$REVIEW_DIR" 2>/dev/null' EXIT
trap 'exit 130' INT; trap 'exit 143' TERM   # a kill still runs the EXIT trap

# Refuse writes to every other worktree of this repo and to the shared .git, except the
# throwaway worktree's own git metadata.
DENY=$(git -C "$CK" worktree list --porcelain | sed -n 's/^worktree //p' \
  | grep -vxF "$REVIEW_DIR" | sed 's/.*/(subpath "&")/' | tr '\n' ' ')
COMMON=$(git -C "$CK" rev-parse --path-format=absolute --git-common-dir)
ADMIN=$(git -C "$REVIEW_DIR" rev-parse --path-format=absolute --git-dir)
PROFILE="(version 1)(allow default)(deny file-write* $DENY(subpath \"$COMMON\"))(allow file-write* (subpath \"$ADMIN\"))"
# Plan mode refuses unlisted commands and chains; one refused command or read ends a print-mode
# run with "jetski: no output produced". ~/.pub-cache holds Dart package sources a Flutter
# review reads; ~/.gemini/memory is agy's own memory. Never add a folder with credentials.
NEON_READ_ONLY='{"permissions":{"allow":["command(git diff)","command(git log)","command(git show)","command(git status)","command(git rev-parse)","command(git ls-files)","command(git blame)","command(git grep)","command(grep)","command(ls)","command(cat)","command(head)","command(wc)","read_file('"$REVIEW_DIR"')","read_file('"$HOME"'/.pub-cache)","read_file('"$HOME"'/.gemini/memory)"],"deny":["write_file(*)"]}}'

run() { # <out-file> <prompt-file> -- one Neon agent
  local out=$1 prompt=$2 rc
  (cd "$REVIEW_DIR" && sandbox-exec -p "$PROFILE" agy --model gemini-4-neon-high \
    --mode plan --settings "$NEON_READ_ONLY" --print-timeout 20m \
    -p="$(cat "$prompt")") > "$out" 2>&1
  rc=$?
  [ -s "$out" ] || rc=1
  grep -q '^jetski: no output produced' "$out" && rc=1
  grep -q 'RESOURCE_EXHAUSTED' "$out" && rc=quota
  echo "$rc" > "$out.rc"
}

names=()
case "$MODE" in
  find)
    PASS=${1:-}
    for role in rules-1 rules-2 bugs-diff bugs-code; do
      p="$OUT/prompt-$role.md"
      { cat "$HERE/neon/common.md" "$HERE/neon/${role%-[12]}.md"
        printf '\n--- Author'"'"'s brief ---\n'; cat "$BRIEF"
        [ -n "$PASS" ] && { printf '\n'; cat "$PASS"; }; } > "$p"
      run "$OUT/find-$role.md" "$p" &
      names+=("$OUT/find-$role.md")
    done ;;
  verify)
    for f in "$@"; do
      # A retry's F*.md glob also matches the last run's outputs; they are not findings.
      case $f in *.prompt.md|*.verdict.md) continue ;; esac
      f=$(cd "$(dirname "$f")" && pwd)/$(basename "$f")
      p="${f%.md}.prompt.md"
      { cat "$HERE/neon/verify.md"
        printf '\n--- Author'"'"'s brief ---\n'; cat "$BRIEF"
        printf '\n--- Finding to validate ---\n'; cat "$f"; } > "$p"
      run "${f%.md}.verdict.md" "$p" &
      names+=("${f%.md}.verdict.md")
    done ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac
[ ${#names[@]} -gt 0 ] || { echo "nothing to run: no findings left after skipping outputs"; exit 0; }
wait

fail=0
for o in "${names[@]}"; do
  rc=$(cat "$o.rc" 2>/dev/null || echo 1)
  case $rc in
    0) echo "ok      $o" ;;
    quota) echo "QUOTA   $o (Neon is out of quota: switch reviewer, don't retry)"; fail=1 ;;
    *) echo "FAILED  $o"; fail=1 ;;
  esac
done
exit $fail
