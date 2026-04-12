import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_LINES = 400;
const EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.git']);
const EXCLUDE_PATTERNS = [/schema\.ts$/, /\.generated\./];

interface Violation {
  filePath: string;
  lineCount: number;
}

export function shouldExclude(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const parts = normalizedPath.split('/');
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  return EXCLUDE_PATTERNS.some((re) => re.test(normalizedPath));
}

export function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split('\n').length;
}

export function scanDirectory(dir: string, root: string): Violation[] {
  const violations: Violation[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry)) {
        violations.push(...scanDirectory(fullPath, root));
      }
      continue;
    }

    const ext = entry.slice(entry.lastIndexOf('.'));
    if (!EXTENSIONS.has(ext)) continue;

    const relPath = relative(root, fullPath);
    if (shouldExclude(relPath)) continue;

    const content = readFileSync(fullPath, 'utf-8');
    const lineCount = countLines(content);

    if (lineCount > MAX_LINES) {
      violations.push({ filePath: relPath, lineCount });
    }
  }

  return violations;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const violations = scanDirectory(root, root);

  if (violations.length === 0) {
    console.log(`✓ No files exceed ${MAX_LINES} lines.`);
    process.exit(0);
  }

  console.log(`✗ ${violations.length} file(s) exceed ${MAX_LINES} lines:\n`);
  for (const v of violations.sort((a, b) => b.lineCount - a.lineCount)) {
    console.log(`  ${v.filePath}: ${v.lineCount} lines`);
  }
  process.exit(1);
}
