export function extractPullRequestNumberFromRef(ref) {
  const normalizedRef = ref.trim();

  if (!normalizedRef) {
    return null;
  }

  if (/^\d+$/.test(normalizedRef)) {
    return Number.parseInt(normalizedRef, 10);
  }

  const directMatch = normalizedRef.match(/^pr-(\d+)$/);

  if (directMatch) {
    return Number.parseInt(directMatch[1], 10);
  }

  const suffixedMatch = normalizedRef.match(/^(?:.+)?#(\d+)$/);

  if (suffixedMatch) {
    return Number.parseInt(suffixedMatch[1], 10);
  }

  return null;
}

/**
 * @param {{
 *   prNumber?: number | null;
 *   reason: string;
 *   timestamp?: string;
 *   url: string;
 * }} options
 */
export function buildStagingPreviewCommentBody({
  prNumber = null,
  reason,
  timestamp = new Date().toISOString(),
  url,
}) {
  return [
    '<!-- nham-staging-preview -->',
    prNumber
      ? `**Staging Preview for PR #${prNumber}**`
      : '**Staging Preview**',
    '',
    `URL: ${url}`,
    `Deployed at: ${timestamp}`,
    `Reason: ${reason}`,
  ].join('\n');
}
