#!/usr/bin/env node
/**
 * Formats a Claude Code security scan into a Markdown report.
 *
 * Reads the `--output-format json` envelope produced by the CLI, pulls the
 * assistant's reply out of `.result`, extracts the trailing fenced JSON block
 * defined by .github/security-review/audit-prompt.md, and writes a report plus
 * GitHub Actions outputs.
 *
 * Usage:
 *   node scripts/security-review-report.mjs [scan.json] [report.md]
 *
 * Env:
 *   SCAN_SCOPE     'recent' | 'full'  — shown in the report header
 *   SCAN_RANGE     human description of what was scanned
 *   GITHUB_OUTPUT  when set, receives has_findings / findings_count / summary
 *
 * Outputs:
 *   has_findings   'true' when the report needs a human
 *   findings_count number of parsed findings
 *   summary        one-line severity tally
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABEL = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '⚪ Low',
  unknown: '❔ Unspecified',
};

const scanPath = process.argv[2] || 'security-scan.json';
const reportPath = process.argv[3] || 'security-report.md';
const scope = process.env.SCAN_SCOPE || 'unknown';
const range = process.env.SCAN_RANGE || '';

/** Pulls the assistant's text out of the CLI's JSON envelope. */
function readScanResult(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { error: `Scan output not found at ${path}.` };
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    // Some CLI versions stream one JSON object per line; take the last one.
    const lines = raw.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        envelope = JSON.parse(lines[i]);
        break;
      } catch {
        // keep walking backwards
      }
    }
    if (!envelope) return { error: 'Scan output was not valid JSON.' };
  }

  if (envelope.is_error) {
    return { error: envelope.result || 'The scan reported an error.' };
  }
  const text = typeof envelope.result === 'string' ? envelope.result : '';
  if (!text.trim()) return { error: 'The scan returned an empty result.' };
  return { text };
}

/** Extracts the last fenced JSON block from the reply, if there is one. */
function extractFindings(text) {
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(blocks[i][1]);
      if (Array.isArray(parsed.findings)) return parsed.findings;
    } catch {
      // try the block before it
    }
  }
  return null;
}

/** Strips the machine-readable block so the prose can be shown on its own. */
function prose(text) {
  return text.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim();
}

function severityRank(finding) {
  const index = SEVERITY_ORDER.indexOf(String(finding.severity).toLowerCase());
  return index === -1 ? SEVERITY_ORDER.length : index;
}

function tally(findings) {
  const counts = new Map();
  for (const finding of findings) {
    const key = SEVERITY_ORDER.includes(String(finding.severity).toLowerCase())
      ? String(finding.severity).toLowerCase()
      : 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...SEVERITY_ORDER, 'unknown']
    .filter((key) => counts.has(key))
    .map((key) => `${counts.get(key)} ${key}`)
    .join(', ');
}

function renderFinding(finding, index) {
  const severity = String(finding.severity || 'unknown').toLowerCase();
  const label = SEVERITY_LABEL[severity] || SEVERITY_LABEL.unknown;
  const location = finding.file
    ? `\`${finding.file}${finding.line ? `:${finding.line}` : ''}\``
    : '_location not reported_';
  return [
    `### ${index + 1}. ${label} — ${finding.title || 'Untitled finding'}`,
    '',
    `**Location:** ${location}`,
    '',
    finding.description || '_No description provided._',
    ...(finding.recommendation
      ? ['', `**Recommendation:** ${finding.recommendation}`]
      : []),
  ].join('\n');
}

function header() {
  const runUrl =
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;
  return [
    `**Scope:** ${scope === 'full' ? 'whole repository' : 'recent changes'}`,
    ...(range ? [`**Scanned:** ${range}`] : []),
    ...(runUrl ? [`**Run:** ${runUrl}`] : []),
    '',
    '_Scanned by Claude Code (DeepSeek V4 Pro). Findings are advisory — verify before acting._',
  ].join('\n');
}

function emit(outputs) {
  for (const [key, value] of Object.entries(outputs)) {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  }
}

function main() {
  const { text, error } = readScanResult(scanPath);

  if (error) {
    writeFileSync(
      reportPath,
      `## Security scan failed\n\n${header()}\n\n${error}\n`
    );
    emit({ has_findings: 'true', findings_count: 0, summary: 'scan failed' });
    return;
  }

  const findings = extractFindings(text);

  // No machine-readable block: surface the raw reply so a human can judge it,
  // rather than silently reporting a clean scan.
  if (findings === null) {
    writeFileSync(
      reportPath,
      `## Security scan (unstructured output)\n\n${header()}\n\nThe scan did not emit the expected JSON block. Raw output below.\n\n---\n\n${prose(text)}\n`
    );
    emit({
      has_findings: 'true',
      findings_count: 0,
      summary: 'unstructured output',
    });
    return;
  }

  if (findings.length === 0) {
    writeFileSync(
      reportPath,
      `## Security scan: no findings\n\n${header()}\n\nNo exploitable issues were identified.\n`
    );
    emit({ has_findings: 'false', findings_count: 0, summary: 'no findings' });
    return;
  }

  const sorted = [...findings].sort(
    (a, b) => severityRank(a) - severityRank(b)
  );
  const summary = tally(sorted);
  const body = [
    `## Security scan: ${sorted.length} finding${sorted.length === 1 ? '' : 's'}`,
    '',
    header(),
    '',
    `**Severity:** ${summary}`,
    '',
    '---',
    '',
    sorted.map(renderFinding).join('\n\n'),
  ].join('\n');

  writeFileSync(reportPath, `${body}\n`);
  emit({
    has_findings: 'true',
    findings_count: sorted.length,
    summary,
  });
}

main();
