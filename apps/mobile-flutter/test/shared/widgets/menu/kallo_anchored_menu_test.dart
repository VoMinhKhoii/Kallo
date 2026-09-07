import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_anchored_menu.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n_test_loader.dart';

/// The app's one popup menu, tested at the geometry it promises: it hangs off
/// a rect the CALLER measured, in the root overlay's coordinates, and it never
/// runs off the bottom of the screen.
const _actions = [
  KalloMenuAction(
    label: 'Copy',
    icon: LucideIcons.copy300,
    value: 'copy',
  ),
  KalloMenuAction(
    label: 'Edit',
    icon: LucideIcons.pencil300,
    value: 'edit',
  ),
];

/// A page with one button that opens the menu at [anchor] and records what it
/// resolved with. [picked] is only meaningful once the route has popped.
Widget _app({
  required Rect anchor,
  required List<String?> picked,
  String? header,
  Alignment align = Alignment.topRight,
}) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Scaffold(
        body: Builder(
          builder: (inner) => Center(
            child: TextButton(
              onPressed: () async => picked.add(
                await showKalloAnchoredMenu<String>(
                  inner,
                  anchor: anchor,
                  actions: _actions,
                  header: header,
                  align: align,
                ),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  ),
);

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
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

  testWidgets('hangs under the anchor, right edges flush', (tester) async {
    const anchor = Rect.fromLTWH(400, 100, 60, 40);
    await tester.pumpWidget(_app(anchor: anchor, picked: <String?>[]));
    await tester.pumpAndSettle();

    await _open(tester);

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(card.top, closeTo(anchor.bottom + KalloSpacing.sp2, 0.5));
    expect(card.right, closeTo(anchor.right, 0.5));
    expect(card.width, closeTo(kKalloMenuWidth, 0.5));
    // Two 44pt rows and the hairline between them — the height the menu
    // computed BEFORE layout in order to decide it had room below.
    expect(
      card.height,
      closeTo(kalloMenuCardHeight(rows: 2, header: false), 0.5),
    );
  });

  testWidgets('flips above the anchor when it would run off the bottom', (
    tester,
  ) async {
    // 600 tall by default: a card hung under this one would end at ~677.
    const anchor = Rect.fromLTWH(400, 540, 60, 40);
    await tester.pumpWidget(_app(anchor: anchor, picked: <String?>[]));
    await tester.pumpAndSettle();

    await _open(tester);

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(card.bottom, closeTo(anchor.top - KalloSpacing.sp2, 0.5));
    // Same edge, same gap — only the direction changed.
    expect(card.right, closeTo(anchor.right, 0.5));
  });

  testWidgets('the leading alignment shares the anchor left edge', (
    tester,
  ) async {
    const anchor = Rect.fromLTWH(100, 100, 60, 40);
    await tester.pumpWidget(
      _app(anchor: anchor, picked: <String?>[], align: Alignment.topLeft),
    );
    await tester.pumpAndSettle();

    await _open(tester);

    expect(
      tester.getRect(find.byType(KalloMenuCard)).left,
      closeTo(anchor.left, 0.5),
    );
  });

  testWidgets('a tap on the barrier resolves null', (tester) async {
    final picked = <String?>[];
    await tester.pumpWidget(
      _app(anchor: const Rect.fromLTWH(400, 100, 60, 40), picked: picked),
    );
    await tester.pumpAndSettle();

    await _open(tester);
    expect(find.byType(KalloMenuCard), findsOneWidget);

    // The blur layer is decorative and ignores pointers, so this lands on the
    // route's own barrier.
    await tester.tapAt(const Offset(8, 8));
    await tester.pumpAndSettle();

    expect(find.byType(KalloMenuCard), findsNothing);
    expect(picked, [null]);
  });

  testWidgets('choosing a row resolves with its value', (tester) async {
    final picked = <String?>[];
    await tester.pumpWidget(
      _app(anchor: const Rect.fromLTWH(400, 100, 60, 40), picked: picked),
    );
    await tester.pumpAndSettle();

    await _open(tester);
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();

    expect(picked, ['edit']);
    expect(find.byType(KalloMenuCard), findsNothing);
  });

  testWidgets('a header prints above the rows when one is given', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        anchor: const Rect.fromLTWH(400, 100, 60, 40),
        picked: <String?>[],
        header: '1:04 AM',
      ),
    );
    await tester.pumpAndSettle();

    await _open(tester);

    final card = tester.getRect(find.byType(KalloMenuCard));
    expect(find.text('1:04 AM'), findsOneWidget);
    expect(
      tester.getRect(find.text('1:04 AM')).top,
      lessThan(tester.getRect(find.text('Copy')).top),
    );
    // The header band and its hairline are part of the height the menu
    // computes in advance.
    expect(
      card.height,
      closeTo(kalloMenuCardHeight(rows: 2, header: true), 0.5),
    );
  });
}
