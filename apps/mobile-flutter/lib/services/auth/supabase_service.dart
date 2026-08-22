import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase singleton wrapper.
///
/// Call [SupabaseService.initialize] once in `main()` before `runApp`.
/// Access the client via [SupabaseService.client].
abstract final class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  /// Initialize Supabase with env-provided URL and anon key.
  ///
  /// Uses `flutter_secure_storage` under the hood (Supabase Flutter's default
  /// on mobile) for keychain-backed session persistence.
  ///
  /// Token auto-refresh is left to supabase_flutter: its `SupabaseAuth` is a
  /// `WidgetsBindingObserver` that registers itself on init and starts/stops
  /// the refresh ticker on resume/pause, gated on `autoRefreshToken` (default
  /// `true`). Registering a second observer here only doubles the refresh
  /// attempt on every resume — the very call that can push an auth error onto
  /// `onAuthStateChange`.
  static Future<void> initialize({
    required String url,
    required String anonKey,
  }) {
    return Supabase.initialize(
      url: url,
      anonKey: anonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
  }
}
