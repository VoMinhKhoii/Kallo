/// Compile-time environment configuration.
///
/// Mirrors the RN app's `EXPO_PUBLIC_*` env vars (see apps/mobile/.env.example).
/// In Flutter these are injected at build time via `--dart-define`, e.g.:
///
/// ```
/// flutter run \
///   --dart-define=SUPABASE_URL=https://xyz.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=sb_publishable_... \
///   --dart-define=API_BASE_URL=http://localhost:3000 \
///   --dart-define=POSTHOG_KEY=phc_... \
///   --dart-define=POSTHOG_HOST=https://us.i.posthog.com
/// ```
///
/// Keep the dart-define keys aligned (sans `EXPO_PUBLIC_` prefix) with the RN
/// names so the same Supabase project / API surface backs both clients.
/// `SUPABASE_ANON_KEY` matches the key `main.dart` already reads for init.
abstract final class Env {
  /// Supabase project URL. Required — `SupabaseService.initialize` consumes it.
  static const String supabaseUrl =
      String.fromEnvironment('SUPABASE_URL');

  /// Supabase publishable (anon) key. Required. Same dart-define `main.dart`
  /// passes to `SupabaseService.initialize`.
  static const String supabasePublishableKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Base URL for the REST + SSE surface (`/api/...`). Required.
  ///
  /// Local dev: `http://localhost:3000` for the iOS simulator. A physical
  /// device must use the host machine's LAN IP (e.g. `http://192.168.1.20:3000`).
  static const String apiBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');

  /// Public web origin used for links shown to or shared by the user (invite
  /// links). Distinct from [apiBaseUrl]: the API may live on a backend host
  /// (Cloud Run) while shared links must always point at the public site.
  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'https://kallo.fit',
  );

  /// Google **Web** OAuth client ID — passed to `google_sign_in` as
  /// `serverClientId` and registered in Supabase's Google provider "Authorized
  /// Client IDs". Empty unless configured; native Google sign-in is a guarded
  /// no-op without it (so dev without Google config still boots).
  static const String googleWebClientId =
      String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

  /// Google **iOS** OAuth client ID — passed to `google_sign_in` as `clientId`
  /// (iOS only). Its reversed form is the Info.plist URL scheme.
  static const String googleIosClientId =
      String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  /// PostHog project key. Empty => analytics is a complete no-op (RN parity).
  static const String posthogKey =
      String.fromEnvironment('POSTHOG_KEY');

  /// PostHog host. Defaults to the US cloud (RN parity).
  static const String posthogHost = String.fromEnvironment(
    'POSTHOG_HOST',
    defaultValue: 'https://us.i.posthog.com',
  );

  /// Throws if a required var is missing, mirroring the RN `throw new Error(...)`
  /// guards in `supabase.ts` / `api-client.ts`. Call once at startup.
  static void assertRequired() {
    if (supabaseUrl.isEmpty || supabasePublishableKey.isEmpty) {
      throw StateError(
        'Missing SUPABASE_URL / SUPABASE_ANON_KEY dart-defines — '
        'see lib/data/env.dart.',
      );
    }
    if (apiBaseUrl.isEmpty) {
      throw StateError(
        'Missing API_BASE_URL dart-define — see lib/data/env.dart.',
      );
    }
  }
}
