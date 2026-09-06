import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/shell/header/profile_avatar_button.dart';
import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';
import 'package:kallo_mobile/features/dashboard/widgets/chrome/week_strip.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_grid_painter.dart';
import 'package:kallo_mobile/features/dashboard/widgets/states/card_skeletons.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart.dart';
import 'package:kallo_mobile/shared/logic/display_format.dart';
import 'package:kallo_mobile/shared/widgets/feedback/skeleton.dart';

import '../../l10n_test_loader.dart';

/// Today was the one primary scrollable with no pull-to-refresh — Circle,
/// Nutrition and the Log feed all had [KalloRefresh] already. Overscrolling it
/// did nothing at all, so a stale day could only be fixed by leaving the tab.
const _userId = '11111111-1111-1111-1111-111111111111';

final _session = Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: const User(
    id: _userId,
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Map<String, dynamic> _bundleJson() => {
      'profile': null,
      'day': {'persistedMeals': <dynamic>[]},
      'weightSummary': {
        'range': '30d',
        'weights': <dynamic>[],
        'weightDates': <dynamic>[],
        'currentWeight': 70.0,
        'todayWeight': null,
        'weightPlaceholder': 70.0,
        'daysLogged': 0,
        'periodStartWeight': 70.0,
        'expectedEndWeight': 68.0,
        'goalDirection': 'down',
        'periodElapsedDays': 0,
        'projectedEndWeight': 69.0,
        'canProject': false,
      },
      'heatmap': {'cells': <dynamic>[], 'monthHeaders': <dynamic>[]},
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  Widget app({required Future<DashboardBundle> Function() load}) => ProviderScope(
    overrides: [
      currentSessionProvider.overrideWithValue(_session),
      dashboardBundleProvider.overrideWith((ref, args) => load()),
      // The header avatar reads the circle profile. Left un-overridden it
      // would reach the real HTTP client; a future that never completes keeps
      // it in its loading state for the whole test. Written as an async body
      // so it compiles against the provider whether or not it is autoDispose.
      myCircleProfileProvider.overrideWith(
        (ref) async => await Completer<CircleProfile>().future,
      ),
    ],
    child: EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: const DashboardScreen(),
        ),
      ),
    ),
  );

  /// A pull past `CupertinoSliverRefreshControl.refreshTriggerPullDistance`
  /// (100), held rather than flung, which is what arms the control.
  Future<void> pullDown(WidgetTester tester) async {
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(WeekStrip)),
    );
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();
  }

  testWidgets('pulling Today down refetches the dashboard bundle', (
    tester,
  ) async {
    var loads = 0;
    await tester.pumpWidget(
      app(
        load: () async {
          loads++;
          return DashboardBundle.fromJson(_bundleJson());
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(loads, 1, reason: 'the first load should have run');

    // The masthead is the BRAND's vector wordmark — the same path
    // `lib/brand/kallo.ts` hands the web — not the app's name set in the
    // serif, which is a different mark from the one the logo actually is.
    expect(
      find.byType(KalloWordmark),
      findsOneWidget,
      reason: 'Today wears the real wordmark, hard left',
    );
    expect(
      find.text('Kallo'),
      findsNothing,
      reason: 'the Lora type fallback is retired',
    );
    final mark = tester.getRect(find.byType(KalloWordmark));
    final avatar = tester.getRect(find.byType(ProfileAvatarButton));
    expect(mark.left, lessThan(avatar.left), reason: 'wordmark left of avatar');
    expect(
      mark.height,
      closeTo(26, 0.5),
      reason: 'sized to the header line it replaced',
    );
    // skipOffstage: false — at rest the control has ZERO sliver extent and
    // sits above the viewport's leading edge, so it is legitimately not
    // "onstage". That is the point of it: it costs no layout until pulled.
    expect(
      find.byType(KalloRefresh, skipOffstage: false),
      findsOneWidget,
      reason: 'Today must carry the app\'s shared pull-to-refresh',
    );

    await pullDown(tester);
    await tester.pumpAndSettle();

    expect(loads, 2, reason: 'the pull must refetch the bundle');
  });

  testWidgets('a dashboard stuck on its skeleton can still be pulled', (
    tester,
  ) async {
    // The skeleton was a plain ListView: no refresh control and no bouncing
    // physics, so the one state where a refetch is most wanted — the first
    // load hanging — was the one state that could not be pulled, and the
    // bounce changed under the finger when the bundle finally resolved.
    final gate = Completer<DashboardBundle>();
    var loads = 0;
    await tester.pumpWidget(
      app(
        load: () {
          loads++;
          return loads == 1
              ? gate.future
              : Future.value(DashboardBundle.fromJson(_bundleJson()));
        },
      ),
    );
    await tester.pump();

    expect(
      find.byType(KalloRefresh, skipOffstage: false),
      findsOneWidget,
      reason: 'the skeleton must carry the same pull-to-refresh',
    );

    final gesture = await tester.startGesture(const Offset(200, 200));
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();

    expect(loads, 2, reason: 'pulling a stuck skeleton must refetch');
    gate.complete(DashboardBundle.fromJson(_bundleJson()));
    await tester.pumpAndSettle();
  });

  testWidgets('the list stays held down until the load actually finishes', (
    tester,
  ) async {
    // The defect this control replaces: Material's floating puck let the
    // content spring back the instant the finger lifted, so the page looked
    // settled while the refetch was still in flight (device report,
    // 2026-09-01). The iOS control keeps its inset open for the whole future.
    final gate = Completer<DashboardBundle>();
    var loads = 0;
    await tester.pumpWidget(
      app(
        load: () {
          loads++;
          // First load resolves at once; the pull's refetch waits on the gate.
          return loads == 1
              ? Future.value(DashboardBundle.fromJson(_bundleJson()))
              : gate.future;
        },
      ),
    );
    await tester.pumpAndSettle();

    final resting = tester.getTopLeft(find.byType(WeekStrip)).dy;

    await pullDown(tester);
    // Settle the release animation, but NOT the load — the gate is still shut.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(loads, 2, reason: 'the pull started the refetch');
    final held = tester.getTopLeft(find.byType(WeekStrip)).dy;
    expect(
      held,
      greaterThan(resting + 20),
      reason:
          'the content must still be held down by the refresh inset while the '
          'future is unresolved — it sat at $held against a resting $resting',
    );

    // The load lands: the inset collapses and the page returns to rest.
    gate.complete(DashboardBundle.fromJson(_bundleJson()));
    await tester.pumpAndSettle();

    expect(
      tester.getTopLeft(find.byType(WeekStrip)).dy,
      closeTo(resting, 0.5),
      reason: 'and springs back only once the load has completed',
    );
  });

  testWidgets('a bundle refetch does NOT put the loaded page back on skeletons',
      (tester) async {
    // Device report: logging a weight blanked the whole home page. `logWeight`
    // invalidates the bundle, every derived section provider goes isReloading,
    // and `AsyncValue.when` defaults `skipLoadingOnReload: false` in Riverpod
    // 2.6.1 — so each already-drawn section fell back to its loading branch for
    // the round trip. Only `skipLoadingOnRefresh` is true by default.
    // The refetch is gated open so the assertions land while the sections are
    // genuinely isReloading, not after the replacement value has arrived.
    final gate = Completer<DashboardBundle>();
    var loads = 0;
    await tester.pumpWidget(
      app(
        load: () {
          loads++;
          return loads == 1
              ? Future.value(DashboardBundle.fromJson(_bundleJson()))
              : gate.future;
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(WeightChart), findsOneWidget, reason: 'loaded first');

    // The same instance the screen watches: it keys the bundle on the signed-in
    // user and today's local date.
    ProviderScope.containerOf(
      tester.element(find.byType(DashboardScreen)),
    ).invalidate(
      dashboardBundleProvider((userId: _userId, date: todayDateString())),
    );
    // Two pumps, not `pumpAndSettle`: the first flushes the invalidation, the
    // second draws the frame where the refetch is in flight and nothing has
    // resolved. Settling would resolve the gate and hide the very frame the
    // sections used to blank on.
    await tester.pump();
    await tester.pump();

    expect(loads, 2, reason: 'the invalidate started a refetch that is stuck');
    expect(find.byType(WeightChart), findsOneWidget,
        reason: 'the drawn page survives the reload');
    expect(find.byType(TodayCardSkeleton), findsNothing,
        reason: 'Today keeps its rows while the bundle refetches');
    expect(find.byType(SkeletonPulse), findsNothing,
        reason: 'no card may shimmer over data it already has');
    expect(
      find.byWidgetPredicate(
        (w) =>
            w is CustomPaint &&
            w.painter is HeatmapGridPainter &&
            (w.painter as HeatmapGridPainter).data == null,
      ),
      findsNothing,
      reason: 'the heatmap keeps its cells instead of redrawing them empty',
    );

    gate.complete(DashboardBundle.fromJson(_bundleJson()));
    await tester.pumpAndSettle();
  });
}
