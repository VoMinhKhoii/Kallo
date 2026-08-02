import 'dart:io';
// `easy_localization` re-exports intl's own TextDirection, which shadows the
// painting one this file needs.
import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/data/logging_models.dart';
import 'package:nham_mobile/features/logging/logic/feed/view_state.dart';
import 'package:nham_mobile/features/logging/widgets/feed/macro_summary.dart';
import 'package:nham_mobile/theme/calm_tokens.dart';

import '../../../l10n_test_loader.dart';

Widget _wrap(Widget child, {double textScale = 1.0}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(body: SingleChildScrollView(child: child)),
          ),
        ),
  ),
);

/// A settled day with three-digit macro figures — the shape that wrapped the
/// `current/target g` readout onto a second line.
const _view = FeedViewState(
  persistedMeals: [],
  pendingConfirmations: [],
  isLoading: false,
  hasError: false,
  hasUnknownDailyMacros: false,
  isStreaming: false,
  isRevealing: false,
  isCheatRevealing: false,
  dailyCalories: 1850,
  dailyProtein: 120,
  dailyCarbs: 240,
  dailyFat: 60,
  hasFailedAttempt: false,
  isEmpty: false,
  hasFooterItems: false,
  showPartialDayNotice: false,
);

const _profile = LoggingProfile(
  userId: 'u1',
  calorieTarget: 2000,
  proteinTargetG: 135,
  carbsTargetG: 350,
  fatTargetG: 70,
);

/// Height of a single `dashMeta` line (12 / 1.25), plus slack for rounding. A
/// wrapped value is 30+, so this cleanly separates one line from two.
const _oneLineMax = 22.0;

double _renderedWidth(String text, {double textScale = 1.0}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: dashMeta(tabular: true)),
    textDirection: ui.TextDirection.ltr,
    textScaler: TextScaler.linear(textScale),
    maxLines: 1,
  )..layout();
  return painter.width;
}

/// The width the value's fixed column actually gives it.
double _columnWidth(WidgetTester tester, Finder text) =>
    tester
        .widget<SizedBox>(
          find.ancestor(of: text, matching: find.byType(SizedBox)).first,
        )
        .width!;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    // Measure against the real typeface, not the test font (whose glyphs are
    // all one em wide) — the column width is a claim about Be Vietnam Pro.
    final loader = FontLoader('BeVietnamPro')..addFont(
      File(
        'assets/google_fonts/BeVietnamPro-Regular.ttf',
      ).readAsBytes().then(ByteData.sublistView),
    );
    await loader.load();
  });

  testWidgets('keeps a three-digit macro value on one line', (tester) async {
    await tester.pumpWidget(
      _wrap(const MacroSummary(view: _view, profile: _profile)),
    );
    await tester.pumpAndSettle();

    final value = find.text('120/135g');
    expect(value, findsOneWidget);
    expect(
      tester.getSize(value).height,
      lessThan(_oneLineMax),
      reason: '120/135g wrapped onto a second line',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('still holds one line at a raised text scale', (tester) async {
    await tester.pumpWidget(
      _wrap(const MacroSummary(view: _view, profile: _profile), textScale: 1.3),
    );
    await tester.pumpAndSettle();

    expect(
      tester.getSize(find.text('120/135g')).height,
      lessThan(_oneLineMax * 1.3),
      reason: 'the readout wrapped once Dynamic Type was raised',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('the value column fits the widest realistic figure', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const MacroSummary(view: _view, profile: _profile)),
    );
    await tester.pumpAndSettle();

    // The guards above stop a narrow column from wrapping, so they'd also hide
    // a column too narrow to READ. Assert the width itself: carbs is the widest
    // realistic case (a four-digit intake against a three-digit target).
    final column = _columnWidth(tester, find.text('120/135g'));
    expect(
      _renderedWidth('1024/350g'),
      lessThanOrEqualTo(column),
      reason: 'the value column clips the widest realistic figure',
    );
  });

  testWidgets('scales the value down rather than truncating it', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const MacroSummary(view: _view, profile: _profile)),
    );
    await tester.pumpAndSettle();

    // At the 1.3 Dynamic Type cap the widest figure no longer fits the column.
    // Without the FittedBox it would CLIP, and "1024/350g" truncated to
    // "1024/35" reads as a real — but wrong — number.
    expect(
      _renderedWidth('1024/350g', textScale: 1.3),
      greaterThan(_columnWidth(tester, find.text('120/135g'))),
      reason: 'if this ever fits, the scale-down is no longer load-bearing',
    );
    expect(
      find.ancestor(
        of: find.text('120/135g'),
        matching: find.byWidgetPredicate(
          (w) => w is FittedBox && w.fit == BoxFit.scaleDown,
        ),
      ),
      findsOneWidget,
    );
  });
}
