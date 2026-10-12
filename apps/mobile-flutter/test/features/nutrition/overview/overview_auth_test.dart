import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/providers/nutrition_overview_provider.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/models/nutrition/nutrition_enums.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// Counts overview requests and fails every call: what is asserted is whether
/// a request goes out at all, not what it returns.
class _CountingApi extends ApiClient {
  var overviewCalls = 0;

  @override
  Future<T> get<T>(String path) async {
    if (path.startsWith('/api/v1/nutrition/overview')) overviewCalls += 1;
    throw ApiError('UNAVAILABLE', 503, false, path);
  }
}

const _arg = (range: NutritionRangeInput.d7, scope: NutritionDayScope.complete);

void main() {
  test(
    'signing out while the Nutrition tab listens makes no request',
    () async {
      final api = _CountingApi();
      final userId = StateProvider<String?>((ref) => 'user-a');
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          signedInUserIdProvider.overrideWith((ref) => ref.watch(userId)),
        ],
      );
      addTearDown(container.dispose);
      // The tab stays mounted until the router swaps the shell out.
      container.listen(nutritionOverviewProvider(_arg), (_, __) {});

      await expectLater(
        container.read(nutritionOverviewProvider(_arg).future),
        throwsA(isA<ApiError>()),
      );
      // The first load also refetches once when the plan tier resolves; let
      // that settle and count from there.
      for (var i = 0; i < 5; i++) {
        await container.pump();
      }
      final signedIn = api.overviewCalls;
      expect(signedIn, greaterThan(0));

      container.read(userId.notifier).state = null;
      await container.pump();
      await expectLater(
        container.read(nutritionOverviewProvider(_arg).future),
        throwsA(
          isA<ApiError>().having((e) => e.code, 'code', 'NOT_AUTHENTICATED'),
        ),
      );
      expect(
        api.overviewCalls,
        signedIn,
        reason: 'no request without a session',
      );

      container.read(userId.notifier).state = 'user-a';
      await container.pump();
      await expectLater(
        container.read(nutritionOverviewProvider(_arg).future),
        throwsA(isA<ApiError>()),
      );
      expect(
        api.overviewCalls,
        greaterThan(signedIn),
        reason: 'signing back in fetches again',
      );
    },
  );
}
