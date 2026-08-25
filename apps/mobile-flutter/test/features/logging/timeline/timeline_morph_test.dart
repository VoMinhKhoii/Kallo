import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_chip.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_picker.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_strip.dart';

import '../../../l10n_test_loader.dart';

const _today = '2026-08-25';
const _dates = ['2026-08-24', '2026-08-25'];

/// Drives DateMorph's `expanded` from outside, the way the logging screen does.
class _Host extends StatefulWidget {
  const _Host({super.key, required this.onSelect});

  final ValueChanged<String> onSelect;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  bool expanded = false;
  String selected = _today;

  /// The screen toggles this from outside; the test does the same rather than
  /// reaching into `setState`, which is protected for good reason.
  void setExpanded(bool value) => setState(() => expanded = value);

  @override
  Widget build(BuildContext context) => DateMorph(
    dates: _dates,
    today: _today,
    selectedDate: selected,
    expanded: expanded,
    onSelectDate: (d) {
      setState(() => selected = d);
      widget.onSelect(d);
    },
    onExpand: () => setState(() => expanded = true),
    onCollapse: () => setState(() => expanded = false),
  );
}

Widget _app(GlobalKey<_HostState> key, ValueChanged<String> onSelect) =>
    ProviderScope(
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(body: _Host(key: key, onSelect: onSelect)),
              ),
        ),
      ),
    );

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

  testWidgets('the week strip survives a full expand and collapse', (
    tester,
  ) async {
    final key = GlobalKey<_HostState>();
    await tester.pumpWidget(_app(key, (_) {}));
    await tester.pumpAndSettle();

    final before = tester.state(find.byType(TimelineStrip));

    key.currentState!.setExpanded(true);
    await tester.pumpAndSettle();
    // The old Stack added and removed its two layers as the animation ran, so
    // at t == 1 Flutter matched the surviving strip against the chip's slot,
    // mismatched three levels down, and destroyed the strip's State — its
    // PageController and the week the user had paged to went with it.
    expect(
      identical(tester.state(find.byType(TimelineStrip)), before),
      isTrue,
      reason: 'expanding must not re-inflate the strip',
    );

    key.currentState!.setExpanded(false);
    await tester.pumpAndSettle();
    expect(
      identical(tester.state(find.byType(TimelineStrip)), before),
      isTrue,
      reason: 'collapsing must not re-inflate it either',
    );
  });

  testWidgets('neither layer rebuilds while the morph is running', (
    tester,
  ) async {
    final key = GlobalKey<_HostState>();
    await tester.pumpWidget(_app(key, (_) {}));
    await tester.pumpAndSettle();

    final chip = tester.element(find.byType(TimelineChip));
    final strip = tester.element(find.byType(TimelineStrip));

    key.currentState!.setExpanded(true);
    // Step through the middle of the 340ms morph. Under the old
    // AnimatedBuilder both subtrees were re-created on every one of these
    // frames — two DateFormats for the chip, a Set over every logged date, and
    // seven day cells with a DateFormat each.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 45));
      expect(identical(tester.element(find.byType(TimelineChip)), chip), isTrue);
      expect(
        identical(tester.element(find.byType(TimelineStrip)), strip),
        isTrue,
      );
    }
    await tester.pumpAndSettle();
  });

  testWidgets('only the visible layer takes taps', (tester) async {
    final picked = <String>[];
    final key = GlobalKey<_HostState>();
    await tester.pumpWidget(_app(key, picked.add));
    await tester.pumpAndSettle();

    // Both layers are mounted now, so the collapsed one must be inert — a tap
    // meant for the chip must not land on a day cell hiding behind it.
    await tester.tap(find.byType(TimelineChip));
    await tester.pumpAndSettle();
    expect(picked, isEmpty);
    expect(key.currentState!.expanded, isTrue);

    // And once expanded, the chip beneath must not steal the day taps.
    await tester.tap(find.text('24').first);
    await tester.pumpAndSettle();
    expect(picked, ['2026-08-24']);
  });
}
