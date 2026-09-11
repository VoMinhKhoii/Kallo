// The Kallo Pro face: what the table says, which period the toggle starts on,
// what the buy button buys and promises, and where its two exits go.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/paywall/logic/plan_pricing.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_screen.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_header.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_cta.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_sheet_actions.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/features/paywall/widgets/states/paywall_status.dart';
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

/// Pumps a fixed number of frames — never `pumpAndSettle`, which the guide
/// bun's endless ticker would hang forever.
Future<void> _frames(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// Boots the paywall on a phone-shaped surface (the 800x600 test default
/// leaves the table and the band nowhere to sit), over a three-route router so
/// the exits have somewhere real to go. [onRouter] hands the router back for
/// location assertions.
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
            builder: (context, child) => MediaQuery(
              // The bun breathes on an endless ticker; reduced motion also
              // drops its typewriter, so the bubble's line is up on frame one.
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: MediaQuery.withClampedTextScaling(
                minScaleFactor: textScale,
                maxScaleFactor: textScale,
                child: child!,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await _frames(tester);
}

/// The one button that buys, whichever period is selected — [PlanCta.gold]
/// only says what it is painted on. Everything else on the band is an exit or
/// a link.
PlanCta _cta(WidgetTester tester) =>
    tester.widget<PlanCta>(find.byType(PlanCta));

Finder _stayFree() => find.byWidgetPredicate(
  (w) => w is KalloButton && w.variant == KalloButtonVariant.secondary,
);

Future<void> _tapBuy(WidgetTester tester) async {
  await tester.tap(find.byType(PlanCta));
  await _frames(tester);
}

/// Moves the toggle to the monthly plan — its left half.
Future<void> _pickMonthly(WidgetTester tester) async {
  final halves = find.descendant(
    of: find.byType(PlanToggle),
    matching: find.byType(GestureDetector),
  );
  expect(halves, findsNWidgets(2));
  await tester.ensureVisible(halves.first);
  await _frames(tester);
  await tester.tap(halves.first);
  await _frames(tester);
}

void main() {
  testWidgets('the screen compares the tiers and starts on the yearly plan', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      purchases: PaywallPurchasesService(
        packages: const [monthlyPackage, lifetimePackage, annualPackage],
      ),
    );

    // Eight rows of delta, not a subtitle claiming there is one.
    expect(find.byType(PlanComparison), findsOneWidget);
    expect(find.text(tr('paywall.compareAi')), findsOneWidget);
    expect(find.text(tr('paywall.compareCircleNote')), findsOneWidget);

    // Yearly is preselected, so the buy button wears the gold. Lifetime is
    // deliberately absent — the toggle is a two-choice decision.
    expect(tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly, isTrue);
    expect(_cta(tester).gold, isTrue);
    expect(find.text(tr('paywall.packageLifetime')), findsNothing);
  });

  testWidgets('the yearly button chips the saving and the monthly one cannot', (
    tester,
  ) async {
    await pumpPaywall(tester);

    // $9.99 x 12 = $119.88 against the $24.99 the yearly plan asks — a 80%
    // saving. (The arithmetic itself is covered in plan_pricing_test.dart.)
    expect(_cta(tester).chipLabel, isNotNull);

    await _pickMonthly(tester);
    expect(
      _cta(tester).gold,
      isFalse,
      reason: 'gold marks the deal, not the tap',
    );
    expect(_cta(tester).chipLabel, isNull);
  });

  testWidgets('the button buys the period the toggle is on', (tester) async {
    // Cancelled at the store sheet: the paywall stays put, so the test can
    // read back what was handed to it without waiting out the server poll.
    final purchases = PaywallPurchasesService(
      outcomes: const [PurchaseOutcome.userCancelled],
      packages: const [annualPackage, monthlyPackage],
    );
    await pumpPaywall(tester, purchases: purchases);

    await _pickMonthly(tester);
    await _tapBuy(tester);

    expect(purchases.lastPurchased, monthlyPackage);
    expect(purchases.purchaseCalls, 1);
  });

  testWidgets('the button offers the free trial the yearly plan carries', (
    tester,
  ) async {
    await pumpPaywall(tester, api: PaywallEntitlementsApi(trialActive: false));

    expect(
      _cta(tester).label,
      tr('paywall.startTrialDays', namedArgs: {'days': '7'}),
    );

    // Monthly carries no introductory offer, so the promise goes away with it
    // and the button names the price instead.
    await _pickMonthly(tester);
    expect(
      _cta(tester).label,
      tr('paywall.startMonthly', namedArgs: {'price': r'$9.99'}),
    );
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

    expect(_cta(tester).label, tr('paywall.purchase'));
    expect(find.textContaining('days free'), findsNothing);
    // The charge starts now, so the line names no date.
    expect(find.textContaining('from'), findsNothing);
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

    expect(_cta(tester).label, tr('paywall.purchase'));
  });

  testWidgets('the renewal line leads with the billed amount, then the date', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      api: PaywallEntitlementsApi(trialActive: false),
      purchases: PaywallPurchasesService(
        packages: const [annualPackage, monthlyPackage],
      ),
      now: DateTime(2026, 9, 6),
    );

    // The YEAR price first and the derived per-month figure in brackets after
    // it — the order Apple cited against Cal AI in April 2026.
    expect(
      find.text(
        r'Auto-renews at $24.99/year (≈$2.08/mo) from Sep 13 until cancelled.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('an offering with only a monthly plan sells it without a toggle', (
    tester,
  ) async {
    await pumpPaywall(
      tester,
      purchases: PaywallPurchasesService(packages: const [monthlyPackage]),
    );

    // A segmented control with one live half is a label wearing a control's
    // chrome, and the gold marks a deal there is nothing to compare against.
    expect(find.byType(PlanToggle), findsNothing);
    expect(_cta(tester).gold, isFalse);
    expect(_cta(tester).onPressed, isNotNull);
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

  testWidgets('at 320pt and 1.3x text the table scrolls instead of clipping', (
    tester,
  ) async {
    await pumpPaywall(tester, size: const Size(320, 640), textScale: 1.3);
    expect(tester.takeException(), isNull, reason: 'nothing overflows');

    // The decision stays pinned whatever the table does above it.
    expect(find.byType(PlanCta), findsOneWidget);
    expect(_stayFree(), findsOneWidget);

    await tester.scrollUntilVisible(find.text(tr('paywall.compareCircle')), 200);
    await _frames(tester);
    expect(tester.takeException(), isNull);
  });

  /// Both ways the store can be shut: no RevenueCat key in the build, and the
  /// server's own `purchasesEnabled: false`. Neither is anything the user can
  /// retry their way out of, so neither may take the paywall away from them.
  group('a store that is not open', () {
    void expectOrdinaryPaywallWithDeadCta(WidgetTester tester) {
      // The table and the quiet action row both stay.
      expect(find.byType(PlanComparison), findsOneWidget);
      expect(find.byType(PaywallSheetActions), findsOneWidget);

      // No error copy, no retry, no empty state.
      expect(find.byType(PaywallNote), findsNothing);
      expect(find.byType(PaywallRetryNote), findsNothing);
      expect(find.text(tr('paywall.unavailableBody')), findsNothing);

      // Only the buy button changes — one widget, so one assertion whichever
      // period the offering left selected.
      expect(_cta(tester).disabled, isTrue);
      expect(_cta(tester).onPressed, isNull);

      // …and both exits survive, so the screen is never a trap: the close
      // glyph in the header, and "Stay on Free" on the band.
      expect(
        find.descendant(
          of: find.byType(PaywallHeader),
          matching: find.byType(GestureDetector),
        ),
        findsOneWidget,
      );
      expect(_stayFree(), findsOneWidget);
    }

    testWidgets('with no store to talk to at all', (tester) async {
      await pumpPaywall(
        tester,
        purchases: PaywallPurchasesService(
          packages: const [annualPackage, monthlyPackage],
          available: false,
        ),
      );

      // The toggle STAYS: this face is the ordinary screen with a dead
      // button, and dropping a whole control out of it read on device as the
      // toggle having been lost.
      expect(find.byType(PlanToggle), findsOneWidget);
      expect(
        tester.widget<PlanToggle>(find.byType(PlanToggle)).onChanged,
        isNull,
        reason: 'inert — there is no second period to switch to',
      );
      // Nothing to price, so no renewal line either: the long legal paragraph
      // that used to stand in here restated the consent sentence below it.
      expect(find.text(tr('paywall.legal')), findsNothing);
      expectOrdinaryPaywallWithDeadCta(tester);
    });

    testWidgets('with the entitlement itself unreadable', (tester) async {
      // Used to replace the whole page with a retry note — which hid the
      // pitch, and offered a retry for something a retry cannot fix.
      await pumpPaywall(tester, api: PaywallEntitlementsApi(failGet: true));

      expectOrdinaryPaywallWithDeadCta(tester);
    });

    testWidgets('with commerce switched off server-side', (tester) async {
      await pumpPaywall(
        tester,
        api: PaywallEntitlementsApi()..purchasesEnabled = false,
      );

      expectOrdinaryPaywallWithDeadCta(tester);
    });
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

    // The header keeps the close glyph; "Stay on Free" is a button on the band
    // now, in reach of a thumb rather than a link in the far corner.
    expect(
      find.descendant(
        of: find.byType(PaywallHeader),
        matching: find.byType(GestureDetector),
      ),
      findsOneWidget,
    );

    await tester.tap(_stayFree());
    await _frames(tester);
    expect(router.state.matchedLocation, '/logging');
  });
}
