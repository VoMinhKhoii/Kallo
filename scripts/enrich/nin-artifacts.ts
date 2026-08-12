import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function writeCsv(
  outDir: string,
  file: string,
  headers: string[],
  rows: unknown[][]
): void {
  mkdirSync(outDir, { recursive: true });
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  writeFileSync(join(outDir, file), `${lines.join('\n')}\n`);
}

export function writeJson(outDir: string, file: string, value: unknown): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, file), `${JSON.stringify(value, null, 2)}\n`);
}
