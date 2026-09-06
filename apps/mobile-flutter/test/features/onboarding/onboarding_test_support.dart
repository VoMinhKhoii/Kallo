// Shared scaffolding for the onboarding tests: the localized host, the answers
// builder, a session, and the wizard's fake sink.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// `setUpAll` for an onboarding widget test: the shared_preferences channel
/// `context.setLocale` persists through (its `setValue` reply is null-checked,
/// so it has to answer true), the l10n bundle, and — for the width-sensitive
/// screens — the real fonts, since the placeholder's ~1em advance invents
/// overflows that are not there.
Future<void> initOnboardingTest({bool fonts = true}) async {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/shared_preferences'),
    (call) async => call.method == 'getAll' ? <String, Object>{} : true,
  );
  await EasyLocalization.ensureInitialized();
  if (fonts) await loadAppFonts();
}

const testUserId = '11111111-1111-1111-1111-111111111111';

Session testSession() => Session(
      accessToken: 'token',
      tokenType: 'bearer',
      user: const User(
        id: testUserId,
        appMetadata: {},
        userMetadata: {},
        aud: 'authenticated',
        createdAt: '2026-07-28T00:00:00.000Z',
      ),
    );

/// The l10n host every onboarding test pumps under: `assets/l10n` off disk (a
/// >50KiB locale JSON makes easy_localization isolate-decode and stall forever
/// under fake-async).
Widget localized(WidgetBuilder build) => EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      startLocale: const Locale('en'),
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(builder: build),
    );

Widget localizedHome(Widget home) => localized(
      (context) => MaterialApp(
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        home: home,
      ),
    );

Widget localizedRouter(GoRouter router) => localized(
      (context) => MaterialApp.router(
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        routerConfig: router,
      ),
    );

/// The wizard's live answers, defaulted to a complete 30-year-old 70 kg male
/// body so the derived targets exist. Pass `body: false` for the blank-metrics
/// screens, where the wizard shows the unlock copy instead of a number.
OnboardingAnswers testAnswers({
  bool body = true,
  String locale = 'en',
  String? origin,
  String? residence,
  BiologicalSex? sex = BiologicalSex.male,
  double? weight = 70,
  int? height = 175,
  int? age = 30,
  ActivityLevel activity = ActivityLevel.light,
  Goal goal = Goal.maintaining,
  double? aggression = 0.5,
  CarbSplit carbSplit = CarbSplit.moderateCarb,
  double? deficitOverride,
}) =>
    OnboardingAnswers(
      preferredLocale: locale,
      countryOfOrigin: origin,
      countryOfResidence: residence,
      biologicalSex: body ? sex : null,
      weightKg: body ? weight : null,
      heightCm: body ? height : null,
      age: body ? age : null,
      activityLevel: activity,
      goal: goal,
      aggression: aggression,
      carbSplit: carbSplit,
      deficitOverride: deficitOverride,
      cooking: const CookingHabits(
        oilUsage: OilUsage.normal,
        defaultRicePortion: RicePortion.medium,
        sugarBraised: SugarBraised.medium,
        defaultProteinPortion: ProteinPortion.medium,
        brothConsumption: BrothConsumption.some,
      ),
    );

/// One recorded call on the wizard's sink.
typedef SinkSave = ({int step, Map<String, dynamic> data, int screenReached});

/// Stands in for whichever sink the auth state would have chosen, so a flow
/// test asserts the SCREEN → SERVER STEP mapping without a session or a socket.
class FakeOnboardingSink implements OnboardingSink {
  final List<SinkSave> saves = [];
  final List<int> reached = [];
  bool fail = false;

  @override
  Future<void> record({
    required int screen,
    OnboardingStepPayload? payload,
  }) async {
    if (fail) throw StateError('save failed');
    if (payload == null) {
      reached.add(screen);
      return;
    }
    saves.add((step: payload.step, data: payload.data, screenReached: screen));
  }
}
