import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

Widget _wrap(String text, {double width = 390}) => MaterialApp(
  home: Scaffold(
    body: Center(child: SizedBox(width: width, child: UserMessageBubble(text: text))),
  ),
);

/// The bubble's copy path needs real strings and a real Overlay for the menu.
Widget _wrapLocalized(String text) => EasyLocalization(
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
        body: Center(
          child: SizedBox(width: 390, child: UserMessageBubble(text: text)),
        ),
      ),
    ),
  ),
);

BoxDecoration _decoration(WidgetTester tester) =>
    tester
            .widget<Container>(
              find.descendant(
                of: find.byType(UserMessageBubble),
                matching: find.byType(Container),
              ),
            )
            .decoration!
        as BoxDecoration;

void main() {
  testWidgets('shows the user its own words', (tester) async {
    await tester.pumpWidget(_wrap('phở bò tái nạm'));
    expect(find.text('phở bò tái nạm'), findsOneWidget);
  });

  testWidgets('is the beige in-app wash with ink copy', (tester) async {
    await tester.pumpWidget(_wrap('phở bò'));
    // The one warm wash the app uses for "mine" — the same one on the confirm
    // circle and the send button. Tan behind running text would break the
    // palette rule and fail contrast; ink on beige clears AA at 13:1.
    expect(_decoration(tester).color, KalloColors.btnPrimarySoft);
    expect(tester.widget<Text>(find.text('phở bò')).style?.color, kInk);
  });

  testWidgets('sits against the right edge, like a sent message', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap('phở bò'));
    final bubble = tester.getRect(
      find.descendant(
        of: find.byType(UserMessageBubble),
        matching: find.byType(Container),
      ),
    );
    final slot = tester.getRect(find.byType(UserMessageBubble));
    expect(bubble.right, closeTo(slot.right, 0.5));
    expect(bubble.left, greaterThan(slot.left));
  });

  testWidgets('the tightened corner is the bottom-right one', (tester) async {
    await tester.pumpWidget(_wrap('phở bò'));
    final radius = _decoration(tester).borderRadius! as BorderRadius;
    expect(radius.bottomRight.x, lessThan(radius.topLeft.x));
    expect(radius.bottomLeft.x, equals(radius.topLeft.x));
  });

  testWidgets('a long meal wraps and stays inside its share of the width', (
    tester,
  ) async {
    const long =
        'hai bát phở bò tái nạm gầu, một đĩa rau thơm, một cốc trà đá và '
        'một bát chè đậu xanh tráng miệng';
    await tester.pumpWidget(_wrap(long));
    expect(tester.takeException(), isNull);

    final bubble = tester.getRect(
      find.descendant(
        of: find.byType(UserMessageBubble),
        matching: find.byType(Container),
      ),
    );
    // Capped at 85% so a long meal never reads as a full-width block.
    expect(bubble.width, lessThanOrEqualTo(390 * 0.85 + 0.5));
    // And it grew downwards rather than being clipped to one line.
    expect(bubble.height, greaterThan(40));
  });

  group('press and hold to copy', () {
    const sent = '1 hủ tíu nam vang nhỏ, cafe sữa tươi';

    setUpAll(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/shared_preferences'),
            (call) async => call.method == 'getAll' ? <String, Object>{} : null,
          );
      await EasyLocalization.ensureInitialized();
    });

    /// Hold the bubble until the iOS context menu opens.
    ///
    /// `tester.longPress` is Material's 500ms, which is short of
    /// `CupertinoContextMenu`'s own 800ms preview timeout — the route only
    /// pushes once that lift animation completes, so the press has to outlast
    /// it before the menu exists to be found.
    Future<void> holdBubble(WidgetTester tester) async {
      final press = await tester.startGesture(
        tester.getCenter(find.byType(UserMessageBubble)),
      );
      // Settling under the finger is what drives the lift: the tap deadline,
      // then the 800ms preview animation whose completion pushes the route.
      await tester.pumpAndSettle();
      await press.up();
      await tester.pumpAndSettle();
    }

    /// Capture what the app hands the platform clipboard.
    List<String> interceptClipboard(WidgetTester tester) {
      final written = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            written.add((call.arguments as Map)['text'] as String);
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger
            .setMockMethodCallHandler(SystemChannels.platform, null),
      );
      return written;
    }

    testWidgets('a plain tap does nothing', (tester) async {
      final written = interceptClipboard(tester);
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(UserMessageBubble));
      await tester.pumpAndSettle();

      expect(find.text('Copy'), findsNothing);
      expect(written, isEmpty);
    });

    testWidgets('holding it offers Copy', (tester) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      expect(find.text('Copy'), findsOneWidget);
    });

    testWidgets('the menu arrives with the iOS backdrop, not a flat card', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();
      expect(find.byType(BackdropFilter), findsNothing);

      await holdBubble(tester);

      // The blurred, dimmed page behind the lifted bubble is the entire
      // difference from the `showMenu` card this replaced — a flat panel
      // dropped on top of the bubble with no backdrop at all.
      expect(find.byType(BackdropFilter), findsWidgets);
      expect(find.byType(CupertinoContextMenuAction), findsOneWidget);
    });

    testWidgets('choosing Copy puts the message on the clipboard', (
      tester,
    ) async {
      final written = interceptClipboard(tester);
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);
      await tester.tap(find.text('Copy'));
      await tester.pumpAndSettle();

      // The composer clears on send, so the bubble holds the only copy of what
      // the user typed — this is the path back to re-analysing a mis-parsed
      // meal without retyping it.
      expect(written, [sent]);
    });

    testWidgets('dismissing the menu copies nothing', (tester) async {
      final written = interceptClipboard(tester);
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);
      expect(find.text('Copy'), findsOneWidget);

      // The dimming barrier, not the page underneath it.
      await tester.tapAt(const Offset(8, 8));
      await tester.pumpAndSettle();

      expect(find.text('Copy'), findsNothing);
      expect(written, isEmpty);
    });
  });
}
