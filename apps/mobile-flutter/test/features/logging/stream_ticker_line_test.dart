import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/feed/stream_ticker.dart';
import 'package:nham_mobile/features/logging/widgets/streaming/stream_ticker_line.dart';
import 'package:nham_mobile/models/streaming.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

import '../../l10n_test_loader.dart';

Widget _wrap(StreamTickerFrame? frame, {bool reduceMotion = false}) =>
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: reduceMotion),
            child: Scaffold(
              body: StreamTickerLine(frame: frame, loaderIndex: 0),
            ),
          ),
        ),
      ),
    );

/// The rendered ticker line.
String _line(WidgetTester tester) {
  final text = tester.widget<Text>(find.byType(Text));
  return text.textSpan!.toPlainText();
}

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

  testWidgets('a stage opens on its first, most literal verb', (tester) async {
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating)));
    await tester.pump();
    expect(_line(tester), 'Weighing…');
    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a slow stage cycles its verbs so the line keeps moving', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating)));
    await tester.pump();
    expect(_line(tester), 'Weighing…');

    // One dwell plus the flip: the next verb of the SAME stage.
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Calculating…');

    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Crunching…');

    // And it wraps rather than running out.
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Weighing…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a new stage restarts at its own first verb', (tester) async {
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Calculating…');

    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.assembling)));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Plating…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a dish freezes the rotation — real news outranks a verb', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480)),
    );
    await tester.pump();
    expect(_line(tester), 'Phở bò · 480 kcal');

    // Well past two dwells: a dish must not be swapped out for a verb.
    await tester.pump(const Duration(milliseconds: 4000));
    expect(_line(tester), 'Phở bò · 480 kcal');
  });

  testWidgets('a detected dish shows with its trailing ellipsis', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const ItemFrame(name: 'Rau thơm', count: 2)),
    );
    await tester.pump();
    expect(_line(tester), 'Rau thơm…');
  });

  testWidgets('reduced motion pins the first verb and never cycles', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const PhaseFrame(StreamStatus.matching), reduceMotion: true),
    );
    await tester.pump();
    expect(_line(tester), 'Foraging…');

    // No timer, so pumpAndSettle must return rather than spin forever.
    await tester.pump(const Duration(milliseconds: 4000));
    expect(_line(tester), 'Foraging…');
    await tester.pumpAndSettle();
  });

  testWidgets('the verb carries the brand brown', (tester) async {
    await tester.pumpWidget(
      _wrap(const PhaseFrame(StreamStatus.connecting), reduceMotion: true),
    );
    await tester.pump();
    final span = tester.widget<Text>(find.byType(Text)).textSpan! as TextSpan;
    expect(span.style?.color, NhamColors.btn);
  });
}
