#!/bin/bash
# SessionStart hook: provision the Flutter SDK (pinned to the flutter-ci.yml
# version) so `flutter analyze` / `flutter test` work on the mobile app during
# Claude Code on the web sessions. Runs async so it doesn't block session start,
# and only in the remote environment (local machines already have Flutter).
set -euo pipefail

# Announce async mode BEFORE any slow work. The SDK clone + pub get can take a
# few minutes; the session starts while this runs in the background.
echo '{"async": true, "asyncTimeout": 600000}'

# Local machines already have their own toolchain — only provision on the web.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

FLUTTER_VERSION="3.44.1"
FLUTTER_DIR="$HOME/flutter"

# Idempotent: only clone if the SDK isn't already present (container state is
# cached after the hook completes, so subsequent sessions reuse it).
if [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
  git clone --depth 1 --branch "$FLUTTER_VERSION" \
    https://github.com/flutter/flutter.git "$FLUTTER_DIR"
fi

# Persist the SDK on PATH for the rest of the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$FLUTTER_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
export PATH="$FLUTTER_DIR/bin:$PATH"

flutter --version

# Warm the mobile app's dependencies with the same lockfile enforcement CI uses,
# so analyze/test are ready to run immediately.
if [ -d "$CLAUDE_PROJECT_DIR/apps/mobile-flutter" ]; then
  (cd "$CLAUDE_PROJECT_DIR/apps/mobile-flutter" && flutter pub get --enforce-lockfile)
fi
