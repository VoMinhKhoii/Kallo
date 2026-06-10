import 'dart:async';

import 'package:flutter/widgets.dart';
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
  static Future<void> initialize({
    required String url,
    required String anonKey,
  }) async {
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );

    // Keep tokens fresh only while the app is foregrounded (Supabase guidance).
    WidgetsBinding.instance.addObserver(_AppLifecycleObserver());
  }
}

/// Starts/stops Supabase auto-refresh based on app lifecycle.
class _AppLifecycleObserver extends WidgetsBindingObserver {
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final auth = Supabase.instance.client.auth;
    if (state == AppLifecycleState.resumed) {
      auth.startAutoRefresh();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      auth.stopAutoRefresh();
    }
  }
}
