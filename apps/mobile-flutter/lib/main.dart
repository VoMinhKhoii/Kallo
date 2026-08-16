import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'data/env.dart';
import 'services/supabase_service.dart';

/// Supabase connection, supplied at build/run time via `--dart-define`
/// (mirrors RN's `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`):
///
///   flutter run \
///     --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=sb_publishable_...
const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  // `DateFormat.MMMd('vi')` and friends read locale symbols that easy_localization
  // does not load. Without this, a localized date can throw LocaleDataException
  // — the nutrition date spans and chart month anchors all go through it.
  await initializeDateFormatting();

  // Lora (serif) is bundled under assets/google_fonts/ and resolved by
  // google_fonts — never fetch over HTTP, so a cold offline start still renders
  // in the brand serif instead of the fallback. The UI sans (Be Vietnam Pro) is
  // a native pubspec font family, always available offline.
  GoogleFonts.config.allowRuntimeFetching = false;

  if (_supabaseUrl.isEmpty || _supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing SUPABASE_URL / SUPABASE_ANON_KEY — pass them via --dart-define '
      '(see RN apps/mobile/.env.example for the values).',
    );
  }

  await SupabaseService.initialize(
    url: _supabaseUrl,
    anonKey: _supabaseAnonKey,
  );

  // Initialize native Google sign-in once (v7 requires a single async init
  // before the first `authenticate()`). Guarded on the Web client ID so a dev
  // build without Google config still boots — the Google button then surfaces a
  // clear error instead of crashing at startup. `serverClientId` is the Web
  // OAuth client ID (the audience Supabase's "Authorized Client IDs" verifies);
  // `clientId` is the iOS client ID, needed on iOS only.
  if (Env.googleWebClientId.isNotEmpty) {
    // `clientId` is an iOS-only concern (Android derives it from serverClientId
    // + the registered SHA-1); passing the iOS client ID on Android can be
    // rejected, so scope it to iOS.
    final isIos = defaultTargetPlatform == TargetPlatform.iOS;
    await GoogleSignIn.instance.initialize(
      clientId: isIos && Env.googleIosClientId.isNotEmpty
          ? Env.googleIosClientId
          : null,
      serverClientId: Env.googleWebClientId,
    );
  }

  // Dark status-bar content on the cream surface — RN `<StatusBar style="dark" />`.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      child: const ProviderScope(child: KalloApp()),
    ),
  );
}
