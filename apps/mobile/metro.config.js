// Metro config for the Nhẩm mobile app.
//
// NOT a Bun workspace yet (see docs/mobile-rn-plan.md). We point Metro at the
// repo root so it can bundle shared code under ../../lib.
//
// IMPORTANT: type-only imports from `@/lib/*` work everywhere (Babel erases
// them). Runtime VALUE imports from ../../lib do NOT yet resolve — the repo
// root is in watchFolders but Metro's crawl does not include it, so a shared
// value import fails with a "file is not watched" SHA-1 error. Until that is
// solved (likely by converting to a Bun workspace), keep shared usage to
// TYPES only; vendor any needed pure value helpers into the app. The aliases
// below are wired and ready for when that infra lands.
//
// Sentry: getSentryExpoConfig is a drop-in for expo's getDefaultConfig that
// adds Sentry's Metro serializer (source maps). All custom resolver /
// watchFolders config below is preserved verbatim.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const sharedAliases = {
  '@/lib': path.resolve(monorepoRoot, 'lib'),
  '@/messages': path.resolve(monorepoRoot, 'messages'),
  '@/i18n': path.resolve(monorepoRoot, 'i18n'),
};
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

function resolveSharedFile(base) {
  for (const ext of RESOLVE_EXTS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of RESOLVE_EXTS) {
    const indexFile = path.join(base, `index${ext}`);
    if (fs.existsSync(indexFile)) return indexFile;
  }
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const alias of Object.keys(sharedAliases)) {
    if (moduleName === alias || moduleName.startsWith(`${alias}/`)) {
      const base = sharedAliases[alias] + moduleName.slice(alias.length);
      const filePath = resolveSharedFile(base);
      if (filePath) return { type: 'sourceFile', filePath };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
