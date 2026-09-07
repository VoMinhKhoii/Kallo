// The Kallo Pro face: which plans it offers, which one it starts on, what the
// CTA buys, and where its two exits go.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/paywall/logic/plan_pricing.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_screen.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_header.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_sheet_actions.dart';
import 'package:kallo_mobile/features/paywall/widgets/plan_row.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/billing/activation_pending.dart';
import 'package:kallo_mobile/services/billing/purchases_service.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n_test_loader.dart';
import 'paywall_test_support.dart';

Session _session() => Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: const User(
    id: '11111111-1111-1111-1111-111111111111',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

/// Boots the paywall on a phone-shaped surface (the 800x600 test default leaves
/// the two tiers nowhere to sit), over a three-route router so the exits have
/// somewhere real to go. [onRouter] hands the router back for location
/// assertions.
Future<void> pumpPaywall(
  WidgetTester tester, {
  ApiClient? api,
  PurchasesService? purchases,
  bool onboarding = false,
  Size size = const Size(390, 844),
  double textScale = 1,
  DateTime? now,
  void Function(GoRouter)? onRouter,
}) async {
  final router = GoRouter(
    initialLocation: '/paywall',
    routes: [
      GoRoute(
        path: '/paywall',
        builder: (_, _) => PaywallScreen(onboarding: onboarding),
      ),
      GoRoute(path: '/dashboard', builder: (_, _) => const SizedBox.shrink()),
      GoRoute(path: '/logging', builder: (_, _) => const SizedBox.shrink()),
    ],
  );
  onRouter?.call(router);
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentSessionProvider.overrideWith((ref) => _session()),
        apiClientProvider.overrideWithValue(api ?? PaywallEntitlementsApi()),
        purchasesServiceProvider.overrideWithValue(
          purchases ??
              PaywallPurchasesService(
                packages: const [annualPackage, monthlyPackage],
              ),
        ),
        activationPendingStoreProvider.overrideWithValue(
          FakeActivationPendingStore(),
        ),
        if (now != null) paywallClockProvider.overrideWithValue(() => now),
      ],
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        startLocale: const Locale('en'),
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp.router(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            routerConfig: router,
            builder: (context, child) => MediaQuery.withClampedTextScaling(
              minScaleFactor: textScale,
              maxScaleFactor: textScale,
              child: child!,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

List<PlanRow> _rows(WidgetTester tester) =>
    tester.widgetList<PlanRow>(find.byType(PlanRow)).toList();

String _ctaTitle(WidgetTester tester) =>
    tester.widget<KalloButton>(find.byType(KalloButton)).title;

/// Picks the monthly row the way a user would — it can start below the fold.
Future<void> _tapLastRow(WidgetTester tester) async {
  await tester.ensureVisible(find.byType(PlanRow).last);
  await tester.pumpAndSettle();
  await tester.tap(find.byType(PlanRow).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the sheet offers yearly then monthly, and hides lifetime', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      purchases: PaywallPurchasesService(
        packages: const [monthlyPackage, lifetimePackage, annualPackage],
      ),
    );

    final rows = _rows(tester);
    expect(rows, hasLength(2));
    expect(rows.first.gold, isTrue);
    expect(rows.first.selected, isTrue, reason: 'yearly is preselected');
    expect(rows.last.gold, isFalse);
    expect(rows.last.selected, isFalse);
  });

  testWidgets('the yearly row strikes the monthly year and chips the saving', (
    tester,
  ) async {
    await pumpPaywall(tester);

    final yearly = _rows(tester).first;
    // $9.99 x 12 = $119.88, struck against the $24.99 the yearly plan asks.
    // (The saving arithmetic itself is covered in plan_pricing_test.dart.)
    expect(yearly.struckSubline, r'$119.88');
    expect(yearly.chipLabel, isNotNull);
    expect(_rows(tester).last.chipLabel, isNull, reason: 'monthly is unchipped');
    expect(_rows(tester).last.struckSubline, isNull);
  });

  testWidgets('the CTA buys the plan the user picked', (tester) async {
    // Cancelled at the store sheet: the paywall stays put, so the test can
    // read back what was handed to it without waiting out the server poll.
    final purchases = PaywallPurchasesService(
      outcomes: const [PurchaseOutcome.userCancelled],
      packages: const [annualPackage, monthlyPackage],
    );
    await pumpPaywall(tester, purchases: purchases);

    await _tapLastRow(tester);
    expect(_rows(tester).last.selected, isTrue);

    // The band and the sheet together outrun a 390x844 screen, so the CTA can
    // start below the fold — scroll to it the way a user would.
    await tester.ensureVisible(find.byType(KalloButton));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(KalloButton));
    await tester.pumpAndSettle();

    expect(purchases.lastPurchased, monthlyPackage);
    expect(purchases.purchaseCalls, 1);
  });

  testWidgets('the CTA offers the free trial the yearly plan carries', (
    tester,
  ) async {
    await pumpPaywall(tester, api: PaywallEntitlementsApi(trialActive: false));

    expect(_ctaTitle(tester), tr('paywall.startFreeTrial'));

    // Monthly carries no introductory offer, so the promise goes away with it.
    await _tapLastRow(tester);
    expect(_ctaTitle(tester), tr('paywall.purchase'));
  });

  testWidgets('a customer the store would refuse is not promised a trial', (
    tester,
  ) async {
    // The product still DECLARES its seven free days — every customer's copy
    // of it does. Only `checkTrialOrIntroductoryPriceEligibility` knows this
    // one has already used theirs, and Apple would charge them on day one.
    await pumpPaywall(
      tester,
      api: PaywallEntitlementsApi(trialActive: false),
      purchases: PaywallPurchasesService(
        packages: const [annualPackage, monthlyPackage],
        trialEligibleIds: const {},
      ),
    );

    expect(_ctaTitle(tester), tr('paywall.purchase'));
    expect(find.text(tr('paywall.legal')), findsOneWidget);
    expect(find.textContaining('days free'), findsNothing);
  });

  testWidgets('a yearly plan with no introductory offer sells at full price', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      api: PaywallEntitlementsApi(trialActive: false),
      purchases: PaywallPurchasesService(
        packages: const [annualNoTrialPackage, monthlyPackage],
      ),
    );

    expect(_ctaTitle(tester), tr('paywall.purchase'));
    expect(find.text(tr('paywall.legal')), findsOneWidget);
  });

  testWidgets('the legal line names the price and the day the charge starts', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      api: PaywallEntitlementsApi(trialActive: false),
      purchases: PaywallPurchasesService(packages: const [annualPackage]),
      now: DateTime(2026, 9, 6),
    );

    expect(
      find.text(
        r'7 days free, then $24.99 / year starting Sep 13. '
        'Cancel anytime in Settings.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('an offering with only a monthly plan preselects it', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      purchases: PaywallPurchasesService(packages: const [monthlyPackage]),
    );

    final rows = _rows(tester);
    expect(rows, hasLength(1));
    expect(rows.single.gold, isFalse);
    expect(rows.single.selected, isTrue);
    // Nothing to strike and nothing to boast without a yearly plan beside it.
    expect(rows.single.struckSubline, isNull);
    expect(rows.single.chipLabel, isNull);
  });

  testWidgets('Restore, Terms and Privacy all clear the 44pt hit target', (
    tester,
  ) async {
    await pumpPaywall(tester);

    final actions = find.descendant(
      of: find.byType(PaywallSheetActions),
      matching: find.byType(GestureDetector),
    );
    expect(actions, findsNWidgets(3));
    for (final element in actions.evaluate()) {
      expect(
        tester.getSize(find.byWidget(element.widget)).height,
        greaterThanOrEqualTo(KalloIcons.hit),
      );
    }
  });

  testWidgets('at 320pt and 1.3x text the page scrolls instead of clipping', (
    tester,
  ) async {
    await pumpPaywall(tester, size: const Size(320, 640), textScale: 1.3);
    expect(tester.takeException(), isNull, reason: 'nothing overflows');

    // The band alone outgrows this screen, so the sheet has to be reachable by
    // scrolling — a Column would have pushed it off the bottom edge instead.
    await tester.scrollUntilVisible(find.byType(KalloButton), 200);
    await tester.pumpAndSettle();

    expect(find.byType(PlanRow), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('the onboarding variant sends both exits into logging', (
    tester,
  ) async {
    late GoRouter router;
    await pumpPaywall(
      tester,
      purchases: PaywallPurchasesService(packages: const [annualPackage]),
      onboarding: true,
      onRouter: (value) => router = value,
    );

    // The header's two gesture targets, in Stack order: close, then the
    // "Stay on Free" label.
    final exits = find.descendant(
      of: find.byType(PaywallHeader),
      matching: find.byType(GestureDetector),
    );
    expect(exits, findsNWidgets(2));

    await tester.tap(exits.at(1));
    await tester.pumpAndSettle();
    expect(router.state.matchedLocation, '/logging');
  });
}
