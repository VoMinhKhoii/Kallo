import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/nutrition/providers/nutrition_overview_provider.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/features/nutrition/widgets/nutrients/source_attribution.dart';
import 'package:kallo_mobile/features/nutrition/widgets/states/inline_error.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shared/widgets/brand/surface_illustration.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../l10n_test_loader.dart';

/// The nutrition page when the overview will not load: nothing on it but the
/// state card and the source line. The card sits in the middle of the page,
/// not pinned under the title with the rest of the page blank, and the source
/// line still holds the bottom edge.
class _FailingOverview extends NutritionOverviewNotifier {
  @override
  Future<NutritionOverview> build(NutritionOverviewArg arg) async {
    throw StateError('offline');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const viewport = Size(390, 700);

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('the failed page centres its card and keeps the source line '
      'on the bottom edge', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = viewport;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => ProviderScope(
                overrides: [
                  currentSessionProvider.overrideWithValue(
                    Session(
                      accessToken: 'token',
                      tokenType: 'bearer',
                      user: const User(
                        id: 'user-1',
                        appMetadata: {},
                        userMetadata: {},
                        aud: 'authenticated',
                        createdAt: '2026-07-28T00:00:00.000Z',
                      ),
                    ),
                  ),
                  nutritionOverviewProvider.overrideWith(_FailingOverview.new),
                ],
                child: MaterialApp(
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                  home: const NutritionScreen(),
                ),
              ),
        ),
      ),
    );
    // The illustration decodes off the main isolate.
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pumpAndSettle();

    final page = tester.getRect(find.byType(CustomScrollView));
    final source = tester.getRect(find.byType(SourceAttribution));
    expect(find.byType(InlineError), findsOneWidget);
    // The region the card is centred in: the page under the title, down to
    // the source line's own gap.
    final regionTop = page.top;
    final regionBottom = source.top - KalloSpacing.sp5;
    // The card is a CARD. Its white background hugs its content — it must not
    // paint as a region-tall slab — and it sits at the middle of the region.
    final card = tester.getRect(find.byType(InlineError));
    expect(
      card.height,
      lessThan(regionBottom - regionTop - KalloSpacing.sp4 * 2),
      reason: 'the white card must hug its content, not fill the page',
    );
    expect(
      card.center.dy,
      moreOrLessEquals((regionTop + regionBottom) / 2, epsilon: 1),
    );
    // And the content inside it sits at that same middle.
    final top = tester.getRect(find.byType(SurfaceIllustration)).top;
    final bottom = tester.getRect(find.byType(KalloButton)).bottom;

    // The same air above the content as below it: the card sits at the middle
    // of the space between the page title and the source line, rather than
    // pinned under the title with the rest of the page blank.
    final above = top - page.top;
    final below = source.top - KalloSpacing.sp5 - bottom;
    expect(above, moreOrLessEquals(below, epsilon: 2));
    expect(
      above,
      greaterThan(24),
      reason: 'the card must not hug the top of an otherwise empty page',
    );
    // The source line still holds the bottom edge of the page.
    expect(source.bottom, moreOrLessEquals(viewport.height, epsilon: 1));
  });
}
