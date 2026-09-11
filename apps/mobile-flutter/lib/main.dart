import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'shared/widgets/icons/brush_check.dart';
import 'shared/widgets/icons/filled_heart.dart';
import 'services/env/env.dart';
import 'services/auth/supabase_service.dart';

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
      '(see apps/docs/mobile/development.md for the values).',
    );
  }

  await SupabaseService.initialize(
    url: _supabaseUrl,
    anonKey: _supabaseAnonKey,
  );

  // Initialize native Google sign-in once (v7 requires a single async init
  // before the first `authenticate()`). Guarded on the Web client ID so a dev
  // build without Google config still boots — the Google button then surfaces a
  // clear error instead of crashing at startup.
  if (Env.googleWebClientId.isNotEmpty) {
    // `clientId` is an iOS-only concern (Android derives it from
    // `serverClientId` + the registered SHA-1); passing the iOS client ID on
    // Android can be rejected, so scope it to iOS.
    final isIos = defaultTargetPlatform == TargetPlatform.iOS;
    final iosClientId = isIos && Env.googleIosClientId.isNotEmpty
        ? Env.googleIosClientId
        : null;
    await GoogleSignIn.instance.initialize(
      clientId: iosClientId,
      // `serverClientId` is what Google mints the ID token's `aud` claim for,
      // and asking for one is also what requests OFFLINE ACCESS — the
      // server-side grant behind Google's "you shared data with this app"
      // mail, which arrived on every single sign-in. On iOS we have our own
      // client to audience the token to, so we drop it: no server auth code
      // is requested, and Supabase verifies the token against the iOS client
      // ID in its Google provider's "Authorized Client IDs" (added
      // 2026-09-10, alongside the Web one the web app and Android still use).
      //
      // Not conditional on the platform but on HAVING that client ID: a build
      // without `GOOGLE_IOS_CLIENT_ID` has nothing else to audience against,
      // so it keeps the Web client exactly as before rather than initializing
      // with no audience at all.
      serverClientId: iosClientId == null ? Env.googleWebClientId : null,
    );
  }

  // Parse the one inline SVG the app swaps in on a tap — the Circle heart's
  // filled state — before any frame needs it. Process-global and idempotent,
  // so it belongs at boot rather than in the lifecycle of whichever feed
  // happens to mount first (`ThreadFeed` used to host it, which cost that
  // widget a State object for a side effect that was never per-instance).
  precacheFilledHeart();
  precacheBrushCheck();

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
