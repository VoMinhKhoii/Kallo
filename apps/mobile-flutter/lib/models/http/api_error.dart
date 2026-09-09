/// The client-side error envelope every HTTP and SSE call throws.
///
/// A DTO, not client machinery: it crosses the whole app — feature providers
/// branch on [code] (`BARCODE_NOT_CACHED`), billing reads a 402 off [status],
/// and the feed reads [retryable] — so it lives with the other models rather
/// than inside the transport that mints it.
library;

/// Client-side mirror of the server `ApiError` envelope.
///
/// Re-implemented (not imported) exactly as the RN client does, because the
/// server's `lib/errors.ts` pulls in `next/server`.
class ApiError implements Exception {
  final String code;
  final int status;
  final bool retryable;
  final String message;
  final double? retryAfterSeconds;

  ApiError(
    this.code,
    this.status,
    this.retryable,
    this.message, [
    this.retryAfterSeconds,
  ]);

  @override
  String toString() =>
      'ApiError($code, $status, retryable=$retryable): $message';
}
