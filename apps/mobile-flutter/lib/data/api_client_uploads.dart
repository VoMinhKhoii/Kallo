part of 'api_client.dart';

/// Multipart file uploads — split from `api_client.dart` along the "binary
/// upload" seam to keep that file within the 400-line limit. A `part` (not a
/// separate library) so the shared private plumbing (`_authHeaders`,
/// `_baseUrl`, `_http`, `_toApiError`) stays private. Uploads go through the
/// backend because the mobile supabase client rides the auth-only proxy and
/// can't reach Storage directly.
extension ApiClientUploads on ApiClient {
  /// POST [path] as multipart form-data with a single `file` field and return
  /// the decoded JSON body.
  Future<Map<String, dynamic>> _postMultipart(
    String path, {
    required Uint8List bytes,
    required String filename,
    required String contentType,
  }) async {
    final headers = await _authHeaders();
    final uri = Uri.parse('$_baseUrl$path');
    final req = http.MultipartRequest('POST', uri)
      ..headers.addAll(headers)
      ..files.add(
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: filename,
          contentType: MediaType.parse(contentType),
        ),
      );
    final streamed = await _http.send(req);
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw _toApiError(res);
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Upload an optional feedback screenshot
  /// (`POST /api/v1/feedback/screenshot`). Returns the storage path to pass
  /// as `screenshotPath` on [ApiClient.submitFeedback].
  Future<String> uploadFeedbackScreenshot({
    required Uint8List bytes,
    required String filename,
    required String contentType,
  }) async {
    final body = await _postMultipart(
      '/api/v1/feedback/screenshot',
      bytes: bytes,
      filename: filename,
      contentType: contentType,
    );
    return body['path'] as String;
  }

  /// Upload the signed-in user's avatar photo
  /// (`POST /api/v1/groups/profile/avatar`). Returns the updated profile JSON
  /// (with the new `avatarUrl`).
  Future<Map<String, dynamic>> uploadAvatar({
    required Uint8List bytes,
    required String filename,
    required String contentType,
  }) async {
    final body = await _postMultipart(
      '/api/v1/groups/profile/avatar',
      bytes: bytes,
      filename: filename,
      contentType: contentType,
    );
    return body['profile'] as Map<String, dynamic>;
  }
}
