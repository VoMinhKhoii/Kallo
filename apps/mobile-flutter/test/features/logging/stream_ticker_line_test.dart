import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/feed/stream_ticker.dart';
import 'package:nham_mobile/features/logging/widgets/streaming/stream_ticker_line.dart';
import 'package:nham_mobile/models/streaming.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

import '../../l10n_test_loader.dart';

Widget _wrap(
  StreamTickerFrame? frame, {
  StreamStatus status = StreamStatus.estimating,
  bool reduceMotion = false,
}) =>
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
              body: StreamTickerLine(
                frame: frame,
                status: status,
                loaderIndex: 0,
              ),
            ),
          ),
        ),
      ),
    );

/// One full verb dwell — kept in step with `_verbDwell` in the widget.
const _dwell = Duration(milliseconds: 2400);

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
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating), status: StreamStatus.estimating));
    await tester.pump();
    expect(_line(tester), 'Weighing…');
    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a slow stage cycles its verbs so the line keeps moving', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating), status: StreamStatus.estimating));
    await tester.pump();
    expect(_line(tester), 'Weighing…');

    // Still holding just before the dwell is up — this is what pins the pace,
    // so shortening _verbDwell without meaning to fails here.
    await tester.pump(_dwell - const Duration(milliseconds: 100));
    expect(_line(tester), 'Weighing…');

    // One dwell plus the flip: the next verb of the SAME stage.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Calculating…');

    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Crunching…');

    // And it wraps rather than running out.
    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Weighing…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a new stage restarts at its own first verb', (tester) async {
    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.estimating), status: StreamStatus.estimating));
    await tester.pump();
    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Calculating…');

    await tester.pumpWidget(_wrap(const PhaseFrame(StreamStatus.assembling), status: StreamStatus.assembling));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Plating…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a dish takes the line the moment it lands', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const PhaseFrame(StreamStatus.estimating),
        status: StreamStatus.estimating,
      ),
    );
    await tester.pump();
    expect(_line(tester), 'Weighing…');

    await tester.pumpWidget(
      _wrap(
        const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480),
        status: StreamStatus.estimating,
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Phở bò · 480 kcal');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a dish hands the line back to the stage verbs after its dwell', (
    tester,
  ) async {
    // The regression this pins: item_name streams during DECOMPOSING, so the
    // first dish detected used to hold the line for the rest of the run and the
    // matching / estimating verbs were unreachable in practice.
    await tester.pumpWidget(
      _wrap(
        const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480),
        status: StreamStatus.matching,
      ),
    );
    await tester.pump();
    expect(_line(tester), 'Phở bò · 480 kcal');

    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Foraging…');

    // And it keeps cycling that stage rather than stalling on one verb.
    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Sourcing…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('each new dish interrupts the verbs again', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480),
        status: StreamStatus.estimating,
      ),
    );
    await tester.pump();
    await tester.pump(_dwell);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Weighing…');

    await tester.pumpWidget(
      _wrap(
        const MacrosFrame(id: 'b', name: 'Chè', calories: 210),
        status: StreamStatus.estimating,
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));
    expect(_line(tester), 'Chè · 210 kcal');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('a detected dish shows with its trailing ellipsis', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        const ItemFrame(name: 'Rau thơm', count: 2),
        status: StreamStatus.decomposing,
      ),
    );
    await tester.pump();
    expect(_line(tester), 'Rau thơm…');

    await tester.pumpWidget(_wrap(null, reduceMotion: true));
  });

  testWidgets('reduced motion pins the first verb and never cycles', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const PhaseFrame(StreamStatus.matching), status: StreamStatus.matching, reduceMotion: true),
    );
    await tester.pump();
    expect(_line(tester), 'Foraging…');

    // No timer, so pumpAndSettle must return rather than spin forever.
    await tester.pump(const Duration(milliseconds: 4000));
    expect(_line(tester), 'Foraging…');
    await tester.pumpAndSettle();
  });

  testWidgets('reduced motion settles on the dish when there is one', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480),
        status: StreamStatus.estimating,
        reduceMotion: true,
      ),
    );
    await tester.pump();
    // Nothing rotates, so the line settles on the informative half.
    expect(_line(tester), 'Phở bò · 480 kcal');
    await tester.pumpAndSettle();
  });

  testWidgets('the verb carries the brand brown', (tester) async {
    await tester.pumpWidget(
      _wrap(const PhaseFrame(StreamStatus.connecting), status: StreamStatus.connecting, reduceMotion: true),
    );
    await tester.pump();
    final span = tester.widget<Text>(find.byType(Text)).textSpan! as TextSpan;
    expect(span.style?.color, NhamColors.btn);
  });
}
