const fs = require('fs');
const path = require('path');

// Auto-load .env.local and .env if present
function loadEnvFile(file) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

// Ensure valid provider setting when GEMINI_API_KEY is present
if (process.env.GEMINI_API_KEY && process.env.AI_PROVIDER !== 'vertex') {
  process.env.AI_PROVIDER = 'ai-studio';
}

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === 'server-only') {
    return {};
  }
  return originalRequire.apply(this, arguments);
};
