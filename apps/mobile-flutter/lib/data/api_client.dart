/// Typed HTTP client for the Nham REST + SSE surface.
///
/// Port of `apps/mobile/src/lib/api-client.ts`. Preserves:
///   - base URL resolution (`Env.apiBaseUrl`),
///   - the auth header derived from the Supabase session access token,
///   - the server error envelope `{ error: { code, status, retryable, message } }`,
///   - `Retry-After` parsing (numeric seconds OR HTTP-date),
///   - 204 No Content handling,
///   - the cold-start warmup ping to `/api/healthz`,
///   - the SSE endpoint `POST /api/analyze-meal` (named-event stream parsing).
library;

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:supabase_flutter/supabase_flutter.dart' show Session;

import '../models/streaming.dart';
import '../services/supabase_service.dart';
import 'env.dart';

part 'api_client_uploads.dart';

const _authRefreshSkew = Duration(minutes: 5);

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

/// Parse a `Retry-After` header: numeric seconds first, else HTTP-date delta.
/// Returns `null` when absent/unparseable. Mirrors `parseRetryAfter` in RN.
double? _parseRetryAfter(String? header) {
  if (header == null) return null;
  final seconds = double.tryParse(header);
  if (seconds != null && seconds.isFinite) return seconds;
  final parsed = DateTime.tryParse(header);
  if (parsed == null) return null;
  final deltaSeconds =
      parsed.difference(DateTime.now()).inMilliseconds / 1000.0;
  return deltaSeconds.isFinite && deltaSeconds > 0 ? deltaSeconds : null;
}

ApiError _toApiError(http.Response res) {
  final retryAfterSeconds = _parseRetryAfter(res.headers['retry-after']);
  try {
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final err = body['error'] as Map<String, dynamic>?;
    return ApiError(
      err?['code'] is String ? err!['code'] as String : 'UNKNOWN',
      err?['status'] is int ? err!['status'] as int : res.statusCode,
      err?['retryable'] is bool ? err!['retryable'] as bool : false,
      err?['message'] is String
          ? err!['message'] as String
          : 'HTTP ${res.statusCode}',
      retryAfterSeconds,
    );
  } catch (_) {
    return ApiError(
      'UNKNOWN',
      res.statusCode,
      false,
      'HTTP ${res.statusCode}',
      retryAfterSeconds,
    );
  }
}

/// Input for the meal-analysis SSE stream (`POST /api/analyze-meal`).
class StreamAnalyzeInput {
  final String message;
  final String loggedDate;
  final int timezoneOffset;
  final String? locale; // 'en' | 'vi'

  /// 'cheat' runs the slider estimator instead of the decomposition pipeline;
  /// omitted/null means 'precise' (the default pipeline).
  final String? mode;

  /// Indulgence magnitude for cheat mode — 'light' | 'medium' | 'heavy';
  /// scales the slider anchor grams server-side.
  final String? cheatIntensity;
  final String? cheatType;

  /// Reply to a prior vague-input cheat clarifying question.
  final String? clarifyAnswer;

  /// Stable per-attempt id. Reused across re-analyses of one logging attempt
  /// (retry, cheat-clarify resubmit) so the server upserts the same
  /// `pending_analyses` staging row instead of orphaning its predecessor. Sent
  /// only when set — a null attemptId always inserts a fresh row server-side.
  final String? attemptId;

  const StreamAnalyzeInput({
    required this.message,
    required this.loggedDate,
    required this.timezoneOffset,
    this.locale,
    this.mode,
    this.cheatIntensity,
    this.cheatType,
    this.clarifyAnswer,
    this.attemptId,
  });

  Map<String, dynamic> toJson() => {
    'message': message,
    'loggedDate': loggedDate,
    'timezoneOffset': timezoneOffset,
    if (locale != null) 'locale': locale,
    if (mode != null) 'mode': mode,
    if (cheatIntensity != null) 'cheatIntensity': cheatIntensity,
    if (cheatType != null) 'cheatType': cheatType,
    if (clarifyAnswer != null) 'clarifyAnswer': clarifyAnswer,
    if (attemptId != null) 'attemptId': attemptId,
  };
}

class ApiClient {
  ApiClient({http.Client? httpClient})
    : _http = httpClient ?? http.Client(),
      _baseUrl = Env.apiBaseUrl;

  final http.Client _http;
  final String _baseUrl;

  bool _expiresSoon(Session session) {
    final expiresAt = session.expiresAt;
    if (expiresAt == null) return false;
    final expiry = DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000);
    return DateTime.now().add(_authRefreshSkew).isAfter(expiry);
  }

  /// Bearer header from the current Supabase session token, or empty when
  /// signed out. Mirrors `authHeaders()` in the RN client.
  Future<Map<String, String>> _authHeaders() async {
    final auth = SupabaseService.client.auth;
    var session = auth.currentSession;
    if (session != null && _expiresSoon(session)) {
      try {
        session = (await auth.refreshSession()).session ?? auth.currentSession;
      } catch (_) {
        session = auth.currentSession;
      }
    }
    final token = session?.accessToken;
    return token != null ? {'Authorization': 'Bearer $token'} : {};
  }

  Future<T> _request<T>(String method, String path, [Object? body]) async {
    final headers = await _authHeaders();
    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }
    final uri = Uri.parse('$_baseUrl$path');
    final req = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) {
      req.body = jsonEncode(body);
    }
    final streamed = await _http.send(req);
    final res = await http.Response.fromStream(streamed);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw _toApiError(res);
    }
    if (res.statusCode == 204) {
      return null as T;
    }
    return jsonDecode(res.body) as T;
  }

  /// GET — decodes JSON into [T].
  Future<T> get<T>(String path) => _request<T>('GET', path);

  /// POST — defaults to an empty object body, matching `apiPost`.
  Future<T> post<T>(String path, [Object? body]) =>
      _request<T>('POST', path, body ?? const <String, dynamic>{});

  /// PATCH — defaults to an empty object body, matching POST and PUT.
  Future<T> patch<T>(String path, [Object? body]) =>
      _request<T>('PATCH', path, body ?? const <String, dynamic>{});

  /// PUT — defaults to an empty object body, matching `apiPut`.
  Future<T> put<T>(String path, [Object? body]) =>
      _request<T>('PUT', path, body ?? const <String, dynamic>{});

  /// DELETE — optionally with a JSON body (e.g. `friends/remove` takes
  /// `{ targetUserId }`).
  Future<T> delete<T>(String path, [Object? body]) =>
      _request<T>('DELETE', path, body);

  /// Permanently delete the signed-in user's account and all their data
  /// (`DELETE /api/v1/account`). The server removes the Supabase auth user,
  /// which cascades to every app row. There is no undo.
  Future<void> deleteAccount() => delete<dynamic>('/api/v1/account');

  /// Fetch a complete JSON snapshot of the user's data
  /// (`GET /api/v1/account`): profile, meals (with items), and weights.
  Future<Map<String, dynamic>> exportMyData() =>
      get<Map<String, dynamic>>('/api/v1/account');

  /// Submit in-app feedback (`POST /api/v1/feedback`). Returns the new row id.
  /// [screenshotPath] comes from [uploadFeedbackScreenshot] when the user
  /// attached an image.
  Future<String> submitFeedback({
    required String type,
    required String message,
    String? screenshotPath,
    String? appVersion,
    String? platform,
    String? locale,
    String? route,
  }) async {
    final res = await post<Map<String, dynamic>>('/api/v1/feedback', {
      'type': type,
      'message': message,
      if (screenshotPath != null) 'screenshotPath': screenshotPath,
      if (appVersion != null) 'appVersion': appVersion,
      if (platform != null) 'platform': platform,
      if (locale != null) 'locale': locale,
      if (route != null) 'route': route,
    });
    return res['id'] as String;
  }

  /// Fire-and-forget ping to wake a scale-to-zero backend on launch. Failures
  /// are swallowed (offline / unreachable is fine). Mirrors `warmupApi()`.
  Future<void> warmup() async {
    try {
      await _http.get(Uri.parse('$_baseUrl/api/healthz'));
    } catch (_) {
      // Best-effort warmup — ignore failures.
    }
  }

  /// Open the meal-analysis SSE stream (`POST /api/analyze-meal`).
  ///
  /// Yields parsed [StreamEvent]s as the server emits NAMED SSE frames
  /// (`stage`, `item_name`, `item_macros`, `result`, `cheat_estimate`,
  /// `analysis_complete`, `error`). The stream completes after a terminal frame
  /// (`analysis_complete`, `error`), when the transport closes, or on a
  /// transport error (surfaced as a [StreamErrorEvent]).
  ///
  /// Cancel by cancelling the returned subscription — the underlying request is
  /// aborted (no auto-reconnect, matching `pollingInterval: 0` in RN).
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) async* {
    final headers = await _authHeaders();
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'text/event-stream';

    final req =
        http.Request('POST', Uri.parse('$_baseUrl/api/analyze-meal'))
          ..headers.addAll(headers)
          ..body = jsonEncode(input.toJson());

    http.StreamedResponse streamed;
    try {
      streamed = await _http.send(req);
    } catch (_) {
      yield const StreamErrorEvent(
        code: 'CONNECTION_ERROR',
        message: 'Connection lost',
        retryable: true,
      );
      return;
    }

    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      // Drain + surface as a terminal error, mirroring the RN `error` branch.
      final res = await http.Response.fromStream(streamed);
      final apiErr = _toApiError(res);
      yield StreamErrorEvent(
        code: apiErr.code,
        message: apiErr.message,
        retryable: apiErr.retryable,
      );
      return;
    }

    // SSE frame parser: events are separated by a blank line; within a frame we
    // track `event:` (named type) and accumulate `data:` lines.
    final lines = streamed.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    String? eventName;
    final dataBuffer = StringBuffer();

    StreamEvent? flush() {
      if (dataBuffer.isEmpty) {
        eventName = null;
        return null;
      }
      final raw = dataBuffer.toString();
      dataBuffer.clear();
      final name = eventName;
      eventName = null;
      try {
        final json = jsonDecode(raw) as Map<String, dynamic>;
        // The server payload carries its own `type`; fall back to the SSE
        // event name when absent so we still route correctly.
        if (json['type'] == null && name != null) {
          json['type'] = name;
        }
        return StreamEvent.fromJson(json);
      } catch (_) {
        // A malformed frame or an event type this client doesn't know about is
        // skipped deliberately — never crash the stream. Known terminals
        // (analysis_complete / error) all parse above, so this only drops
        // frames the reducer has no use for (e.g. the server's precise-mode
        // `clarify` ask-back, which this client does not implement). The server
        // closes the socket right after such a frame, so the controller's
        // onDone settles the run as a retryable failure.
        return null;
      }
    }

    await for (final line in lines) {
      if (line.isEmpty) {
        final event = flush();
        if (event != null) {
          yield event;
          // Terminal frames end the stream — the rule lives on the event itself
          // (`StreamEvent.isTerminal`) so this generator and the stream
          // controller can never enumerate it differently.
          if (event.isTerminal) {
            return;
          }
        }
        continue;
      }
      if (line.startsWith(':')) continue; // comment / heartbeat
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        final chunk = line.substring(5);
        // SSE spec strips one leading space after the colon.
        dataBuffer.write(chunk.startsWith(' ') ? chunk.substring(1) : chunk);
      }
    }

    // Stream ended without a blank-line terminator — flush any trailing frame.
    final tail = flush();
    if (tail != null) yield tail;
  }

  void close() => _http.close();
}

/// Singleton [ApiClient]. Other surfaces read `ref.read(apiClientProvider)`.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  ref.onDispose(client.close);
  return client;
});
