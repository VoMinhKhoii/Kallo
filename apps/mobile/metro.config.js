// Metro config for the Nhẩm mobile app.
//
// We are intentionally NOT a Bun workspace yet (see docs/mobile-rn-plan.md),
// so Expo's automatic monorepo detection does not fire. Point Metro at the
// repo root manually so it can bundle the shared code under ../../lib that the
// app imports via the `@/lib/*` alias (the /api/v1 contracts, pure schemas,
// and types). This is the SDK <52 manual approach, still valid in SDK 56 for
// non-workspace layouts.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the repo root so edits to ../../lib trigger fast refresh.
config.watchFolders = [monorepoRoot];

// 2. Resolve packages from the app first, then the repo root (shared deps such
//    as zod live at the root and are imported by ../../lib).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
