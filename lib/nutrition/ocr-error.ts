import type { OcrErrorCode } from '@/lib/nutrition/ocr-schema';

/**
 * Classify anything thrown by the label-scan path into an {@link OcrErrorCode}.
 *
 * Shared by the web Server Action (which returns the code to the client) and
 * the mobile route handler (which maps it onto an HTTP error envelope), so
 * both surfaces agree on what counts as a bad image versus a provider fault.
 */
export function scanErrorCode(error: unknown): OcrErrorCode {
  const providerError = error as {
    code?: unknown;
    status?: unknown;
  } | null;
  const code = providerError?.code;
  if (providerError?.status === 429) return 'rate_limited';
  if (
    code === 'invalid_image' ||
    code === 'no_label_detected' ||
    code === 'rate_limited'
  ) {
    return code;
  }
  return 'server_error';
}
