import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/screens/steps/region_page.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// Holds the first post on the wire until [release]; records every body.
class _SlowApi extends ApiClient {
  final List<Map<dynamic, dynamic>> posts = [];
  final Completer<void> _first = Completer<void>();

  void release() => _first.complete();

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final isFirst = posts.isEmpty;
    posts.add(body! as Map);
    if (isFirst) await _first.future;
    return <String, dynamic>{} as T;
  }
}

/// The language saves the moment it is picked, and the account holds the
/// language the app follows: a second pick made while the first is still
/// saving must be stored too, or the app is switched back to the first.
void main() {
  setUpAll(() => initOnboardingTest(fonts: false));

  testWidgets('a second language picked while the first saves is stored', (
    tester,
  ) async {
    final api = _SlowApi();
    await pumpSettingsPage(
      tester,
      const RegionPage(),
      overrides: [
        profileProvider.overrideWith(
          (ref) async => const ProfileRow(kFullProfile),
        ),
        apiClientProvider.overrideWithValue(api),
      ],
    );

    // Fixed frames while a save is out: its spinner never settles.
    Future<void> frames() async {
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    await tester.tap(find.text(tr('onboarding.language.english')));
    await frames();
    await tester.tap(find.text(tr('onboarding.language.vietnamese')));
    await frames();
    expect(api.posts, hasLength(1), reason: 'the first save is still out');

    api.release();
    await tester.pumpAndSettle();

    final languages = [
      for (final post in api.posts) (post['data'] as Map)['preferredLocale'],
    ];
    expect(languages, ['en', 'vi']);
  });
}
