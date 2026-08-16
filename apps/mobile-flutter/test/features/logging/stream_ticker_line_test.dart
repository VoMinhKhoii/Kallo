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
  Locale locale = const Locale('en'),
}) =>
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      // tr() resolves through EasyLocalization's own controller — setting
      // MaterialApp.locale alone leaves it on English.
      startLocale: locale,
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: locale,
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

/// The rendered ticker line, prefix included.
String _line(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((t) => t.textSpan!.toPlainText())
    .join();

/// Just the part that flips — the last Text, after any static prefix.
String _flipped(WidgetTester tester) =>
    tester.widgetList<Text>(find.byType(Text)).last.textSpan!.toPlainText();

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

  group('Vietnamese', () {
    const vi = Locale('vi');

    testWidgets('opens each stage on its own first verb', (tester) async {
      for (final (status, expected) in const [
        (StreamStatus.connecting, 'Đang kết nối…'),
        (StreamStatus.decomposing, 'Đang sơ chế…'),
        (StreamStatus.matching, 'Đang tra cứu…'),
        (StreamStatus.estimating, 'Đang tính toán…'),
        (StreamStatus.assembling, 'Đang bày biện…'),
      ]) {
        await tester.pumpWidget(
          _wrap(
            PhaseFrame(status),
            status: status,
            locale: vi,
            reduceMotion: true,
          ),
        );
        await tester.pump();
        expect(_line(tester), expected, reason: status.name);
      }
    });

    testWidgets('holds "Đang" still and flips only the rest', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const PhaseFrame(StreamStatus.estimating),
          status: StreamStatus.estimating,
          locale: vi,
        ),
      );
      await tester.pump();
      expect(_line(tester), 'Đang tính toán…');
      // The opener is its own Text OUTSIDE the transition; only the remainder
      // is inside it, so "Đang" does not re-animate on every verb.
      expect(_flipped(tester), 'tính toán…');

      await tester.pump(_dwell);
      await tester.pump(const Duration(milliseconds: 400));
      expect(_line(tester), 'Đang cân đo…');
      expect(_flipped(tester), 'cân đo…');

      await tester.pumpWidget(_wrap(null, reduceMotion: true));
    });

    testWidgets('a stage with two verbs wraps after the second', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const PhaseFrame(StreamStatus.matching),
          status: StreamStatus.matching,
          locale: vi,
        ),
      );
      await tester.pump();
      expect(_line(tester), 'Đang tra cứu…');

      await tester.pump(_dwell);
      await tester.pump(const Duration(milliseconds: 400));
      expect(_line(tester), 'Đang lựa nguyên liệu…');

      // Two verbs, so it comes back round rather than probing a third.
      await tester.pump(_dwell);
      await tester.pump(const Duration(milliseconds: 400));
      expect(_line(tester), 'Đang tra cứu…');

      await tester.pumpWidget(_wrap(null, reduceMotion: true));
    });

    testWidgets('a dish carries no opener', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const MacrosFrame(id: 'a', name: 'Phở bò', calories: 480),
          status: StreamStatus.estimating,
          locale: vi,
          reduceMotion: true,
        ),
      );
      await tester.pump();
      // "Đang Phở bò" would be nonsense.
      expect(_line(tester), 'Phở bò · 480 kcal');
      await tester.pumpAndSettle();
    });
  });
}
