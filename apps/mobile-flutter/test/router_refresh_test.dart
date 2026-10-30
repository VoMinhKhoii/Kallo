// The router's redirect reads providers, and the router re-runs it when a
// provider it listens to changes. Run straight from that listener, the redirect
// read `onboardingResumeProvider` while Riverpod was still refreshing that
// provider's own dependencies, and sign-out crashed the app with
// "Concurrent modification during iteration" (Sentry, 1.0.1+70).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'features/onboarding/onboarding_test_support.dart';

/// A signed-in account with no profile row yet.
class _NoProfileApi extends ApiClient {
  @override
  Future<T> get<T>(String path) async => null as T;
}

void main() {
  test(
    'signing out does not re-run the redirect inside a provider refresh',
    () async {
      final events = StreamController<AuthState>.broadcast();
      addTearDown(events.close);
      Session? session = testSession();
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(_NoProfileApi()),
          authEventsProvider.overrideWithValue(events.stream),
          currentSessionReaderProvider.overrideWithValue(() => session),
        ],
      );
      addTearDown(container.dispose);
      // `ChangeNotifier` reports a listener's throw here rather than rethrowing,
      // which is how the crash reached Sentry (mechanism `FlutterError`).
      final reported = <Object>[];
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) => reported.add(details.exception);
      addTearDown(() => FlutterError.onError = previousOnError);

      // The router's wiring: the same listeners, and a redirect that reads the
      // onboarding decision the way `_redirect` does. The redirect joins once
      // the signed-in state has settled, as on a phone that restored its session.
      final refresh = GoRouterAuthRefresh(events.stream);
      addTearDown(refresh.dispose);
      final profile = container.listen(
        profileProvider,
        (_, __) => refresh.ping(),
      );
      addTearDown(profile.close);
      final resume = container.listen(
        onboardingResumeProvider,
        (_, __) => refresh.ping(),
      );
      addTearDown(resume.close);
      await container.read(profileProvider.future);
      await container.pump();
      var redirects = 0;
      refresh.addListener(() {
        container.read(onboardingResumeProvider);
        redirects++;
      });

      session = null;
      events.add(const AuthState(AuthChangeEvent.signedOut, null));
      await Future<void>.delayed(Duration.zero);
      await container.pump();
      await Future<void>.delayed(Duration.zero);

      expect(reported, isEmpty);
      expect(container.read(onboardingResumeProvider), isFalse);
      expect(redirects, greaterThan(0));
    },
  );
}
