import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/widgets/states/circle_error.dart';
import 'package:kallo_mobile/features/dashboard/widgets/today/today_meal_list.dart';
import 'package:kallo_mobile/features/settings/widgets/profile/profile_status_views.dart';
import 'package:kallo_mobile/shared/data/surface_cast.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/shell/route_error_screen.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The smallest phone Kallo supports, at the largest text scale iOS offers
/// without the accessibility sizes: 320 logical px, 1.3×. Vietnamese copy is
/// the long copy, so every case here uses it — if a surface state holds here it
/// holds everywhere.
const _viewport = Size(320, 640);
const _scale = TextScaler.linear(1.3);
final _bounds = Rect.fromLTWH(0, 0, _viewport.width, _viewport.height);

/// The long Vietnamese error copy, doubled: two full sentences is the worst
/// subtitle any surface can be handed.
const _title = 'Trang này chưa tải được.';
const _subtitle = 'Có lỗi từ phía chúng tôi, bạn thử lại nhé. '
    'Có lỗi từ phía chúng tôi, bạn thử lại nhé.';

Widget _sized(Widget child) => MediaQuery(
  data: const MediaQueryData(size: _viewport, textScaler: _scale),
  child: SizedBox(width: _viewport.width, child: child),
);

/// Plain-strings harness: no l10n, for the anatomy itself.
Widget _app(Widget child) =>
    MaterialApp(home: Scaffold(body: _sized(child)));

/// Same, with the app's real Vietnamese copy loaded from disk.
Widget _l10nApp(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('vi'), Locale('en')],
  path: 'assets/l10n',
  startLocale: const Locale('vi'),
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Scaffold(body: _sized(child)),
    ),
  ),
);

/// The illustrations decode off the main isolate, so the picture only takes its
/// real size once actual async work has run.
Future<void> _pump(WidgetTester tester, Widget app) async {
  // The real viewport, not just a MediaQuery claim: a widget that measures the
  // window (or overflows it) has to meet an actual 320-wide phone.
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = _viewport;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(app);
  await tester.runAsync(() async {
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pumpAndSettle();
}

/// The whole assertion: nothing overflowed, and every action the surface offers
/// is inside the phone rather than half off the right edge.
void _expectFits(WidgetTester tester, {int buttons = 1}) {
  expect(tester.takeException(), isNull);
  final found = find.byType(KalloButton);
  expect(found, findsNWidgets(buttons));
  for (final element in found.evaluate()) {
    final rect = tester.getRect(find.byWidget(element.widget));
    expect(rect.left, greaterThanOrEqualTo(_bounds.left));
    expect(rect.right, lessThanOrEqualTo(_bounds.right));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await loadAppFonts();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('full-size error state holds at 320 × 1.3', (tester) async {
    await _pump(
      tester,
      _app(
        KalloSurfaceState(
          area: SurfaceArea.system,
          kind: SurfaceKind.error,
          title: _title,
          subtitle: _subtitle,
          action: KalloButton(
            variant: KalloButtonVariant.cta,
            title: 'Thử lại',
            onPressed: () {},
          ),
        ),
      ),
    );

    expect(find.text(_title), findsOneWidget);
    expect(find.text(_subtitle), findsOneWidget);
    _expectFits(tester);
  });

  /// The compact block itself: 64 art + 16 + a title line + 8 + two subtitle
  /// lines + 16 + the action. At 320 × 1.3 that is over 200pt — so a card that
  /// FIXES its height to 200 clips it. This is the contract, recorded as a
  /// test: hosts give the state a minimum, never a fixed height. No shipping
  /// caller fixes one (`EmptyMeals` passes `minHeight: 96`, `KalloCard` sizes
  /// to its child), and the fix is never to shrink the state into the box.
  Widget compact() => KalloSurfaceState(
    area: SurfaceArea.system,
    kind: SurfaceKind.error,
    compact: true,
    title: _title,
    subtitle: _subtitle,
    action: KalloButton(
      variant: KalloButtonVariant.cta,
      title: 'Thử lại',
      onPressed: () {},
    ),
  );

  testWidgets('compact error state overflows a host that fixes 200pt',
      (tester) async {
    await _pump(tester, _app(SizedBox(height: 200, child: compact())));

    expect(find.text(_title), findsOneWidget);
    expect(
      tester.takeException(),
      isA<FlutterError>().having(
        (e) => e.message,
        'message',
        contains('overflowed'),
      ),
    );
  });

  testWidgets('compact error state holds when the host sets only a minimum',
      (tester) async {
    await _pump(
      tester,
      _app(
        Align(
          alignment: Alignment.topLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 200),
            child: compact(),
          ),
        ),
      ),
    );

    expect(find.text(_title), findsOneWidget);
    // The subtitle is clamped to two lines in compact, so an error message of
    // any length costs the card the same height.
    expect(tester.getSize(find.text(_subtitle)).height, lessThan(80));
    _expectFits(tester);
  });

  testWidgets('EmptyMeals holds inside the Today card', (tester) async {
    await _pump(
      tester,
      _l10nApp(const KalloCard(child: EmptyMeals())),
    );

    expect(tester.takeException(), isNull);
    expect(find.text(tr('dashboard.noMealsToday')), findsOneWidget);
    expect(find.text(tr('dashboard.mealReceiptsHint')), findsOneWidget);
  });

  testWidgets('CircleErrorCard holds compact at a sheet width', (tester) async {
    await _pump(
      tester,
      _l10nApp(CircleErrorCard(compact: true, onRetry: () {})),
    );

    expect(find.text(tr('groups.error.title')), findsOneWidget);
    expect(find.text(tr('groups.error.body')), findsOneWidget);
    _expectFits(tester);
  });

  testWidgets('RouteErrorScreen holds a full 320 × 640 screen', (tester) async {
    await _pump(
      tester,
      EasyLocalization(
        supportedLocales: const [Locale('vi'), Locale('en')],
        path: 'assets/l10n',
        startLocale: const Locale('vi'),
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp.router(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            builder: (_, child) => _sized(child ?? const SizedBox.shrink()),
            routerConfig: GoRouter(
              initialLocation: '/',
              routes: [
                GoRoute(
                  path: '/',
                  builder: (_, __) => const RouteErrorScreen(notFound: true),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text(tr('common.notFound')), findsOneWidget);
    expect(find.text(tr('errors.route.notFoundBody')), findsOneWidget);
    _expectFits(tester);
  });

  testWidgets('ProfileEmpty holds at 320 × 1.3', (tester) async {
    await _pump(tester, _l10nApp(const ProfileEmpty()));

    expect(find.text(tr('settings.profilePage.emptyTitle')), findsOneWidget);
    expect(
      find.text(tr('settings.profilePage.emptyDescription')),
      findsOneWidget,
    );
    _expectFits(tester);
  });

  testWidgets('ProfileLoadError holds at 320 × 1.3', (tester) async {
    await _pump(tester, _l10nApp(ProfileLoadError(onRetry: () {})));

    expect(find.text(tr('common.error')), findsOneWidget);
    expect(find.text(tr('errors.route.body')), findsOneWidget);
    _expectFits(tester);
  });
}
