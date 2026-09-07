import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';
import 'package:kallo_mobile/theme/kallo_typography.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

Widget _wrap(String text, {double width = 390}) => ProviderScope(
  child: MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(width: width, child: UserMessageBubble(text: text)),
      ),
    ),
  ),
);

/// The bubble's menu needs real strings, a real Overlay, and a container the
/// test can read `composerRefillProvider` out of — Edit parks the message
/// there rather than calling anything back.
Widget _wrapLocalized(
  String text, {
  ProviderContainer? container,
  String? sentAt,
}) {
  final app = _localized(text, sentAt: sentAt);
  return container == null
      ? ProviderScope(child: app)
      : UncontrolledProviderScope(container: container, child: app);
}

Widget _localized(String text, {String? sentAt}) => EasyLocalization(
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
          child: SizedBox(
            width: 390,
            child: UserMessageBubble(text: text, sentAt: sentAt),
          ),
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

    /// Hold the bubble until the menu opens.
    ///
    /// A plain `tester.longPress`: the menu is the app's own
    /// ([showKalloAnchoredMenu]) and opens on Material's 500ms `onLongPress`.
    /// It used to be a hand-rolled gesture that outlasted
    /// `CupertinoContextMenu`'s 800ms preview timeout, which is the one thing
    /// that route made the user wait for.
    Future<void> holdBubble(WidgetTester tester) async {
      await tester.longPress(find.byType(UserMessageBubble));
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

    /// Every copy of the bubble on screen: the one in the page, and the still
    /// copy the open menu pins over its own blur. They live in different
    /// subtrees, so they are found by the one thing they share — the beige
    /// wash nothing else in the app wears.
    Finder bubbleBoxes() => find.byWidgetPredicate(
      (w) =>
          w is Container &&
          (w.decoration as BoxDecoration?)?.color ==
              KalloColors.btnPrimarySoft,
    );

    testWidgets('a plain tap does nothing', (tester) async {
      final written = interceptClipboard(tester);
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(_wrapLocalized(sent, container: container));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(UserMessageBubble));
      await tester.pumpAndSettle();

      expect(find.text('Copy'), findsNothing);
      expect(written, isEmpty);
      expect(container.read(composerRefillProvider), isNull);
    });

    testWidgets('holding it offers Copy and Edit', (tester) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      expect(find.text('Copy'), findsOneWidget);
      // Copy was the workaround for having no way back to your own words;
      // Edit is the thing it was standing in for.
      expect(find.text('Edit'), findsOneWidget);
    });

    testWidgets('choosing Edit parks the message for the composer', (
      tester,
    ) async {
      final written = interceptClipboard(tester);
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(_wrapLocalized(sent, container: container));
      await tester.pumpAndSettle();

      await holdBubble(tester);
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();

      // The bubble cannot see the composer's controller from inside a meal
      // card, so it parks the words and the dock picks them up.
      expect(container.read(composerRefillProvider), sent);
      expect(find.text('Edit'), findsNothing);
      // Edit is NOT copy-and-paste, and it is not a re-run either.
      expect(written, isEmpty);
    });

    testWidgets('the menu arrives over a blurred page, not as a flat card', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();
      expect(find.byType(BackdropFilter), findsNothing);

      await holdBubble(tester);

      // The blurred, dimmed page behind the card is what separates this from
      // the `showMenu` panel the bubble started with — a flat card dropped on
      // top of the message with no backdrop at all. It survived the move off
      // `CupertinoContextMenu` (2026-09-08); the framework's own blur went
      // with it, so the menu paints its own.
      expect(find.byType(BackdropFilter), findsWidgets);
      expect(find.byType(KalloMenuActionRow), findsNWidgets(2));
    });

    testWidgets('the bubble stays exactly where it was', (tester) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();
      final resting = tester.getRect(bubbleBoxes());

      await holdBubble(tester);

      // The entire reason the app owns this menu. `CupertinoContextMenu`
      // relocated the bubble into a preview slot of its own and scaled it
      // 1.15x, so the message the user was pressing slid out from under their
      // finger. Here the page's own bubble never moves and the menu pins a
      // still copy at exactly its rect.
      final copies = tester.widgetList<Container>(bubbleBoxes()).length;
      expect(copies, 2, reason: 'the page bubble and the menu pinned copy');
      for (var i = 0; i < copies; i++) {
        final rect = tester.getRect(bubbleBoxes().at(i));
        expect(rect.left, closeTo(resting.left, 0.5));
        expect(rect.top, closeTo(resting.top, 0.5));
        expect(rect.right, closeTo(resting.right, 0.5));
        expect(rect.bottom, closeTo(resting.bottom, 0.5));
      }
    });

    testWidgets("the menu hangs off the bubble's trailing edge", (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();
      final bubble = tester.getRect(bubbleBoxes());

      await holdBubble(tester);

      // Right edges flush: the card reads as an extension of the message it
      // hangs off, the way ChatGPT's does, rather than as a panel centred on
      // nothing in particular.
      final card = tester.getRect(find.byType(KalloMenuCard));
      expect(card.right, closeTo(bubble.right, 0.5));
      expect(card.top, greaterThan(bubble.bottom));
    });

    testWidgets('a time header names when it was sent', (tester) async {
      await tester.pumpWidget(_wrapLocalized(sent, sentAt: '1:04 AM'));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      // The divider above the bubble already prints this; the menu repeats it
      // so the open card says WHICH message it is acting on.
      expect(
        find.descendant(
          of: find.byType(KalloMenuCard),
          matching: find.text('1:04 AM'),
        ),
        findsOneWidget,
      );
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

    testWidgets('the lifted bubble keeps its own type, not the fallback', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      // The menu re-renders the bubble in the root overlay's route, which sits
      // ABOVE every Material in the app. `MaterialApp` installs Flutter's
      // fallback DefaultTextStyle up there — the one whose debugLabel reads
      // "consider putting your text in a Material" — and it carries a yellow
      // double underline. `dashBody` merges onto it (TextStyle.inherit
      // defaults to true) and overrides colour, size and family but never
      // `decoration`, so the underline survives and paints under the pinned
      // message. `TopToastPill` documents the same trap.
      final lifted = tester
          .widgetList<RichText>(find.byType(RichText))
          .where((r) => r.text.toPlainText() == sent);
      expect(lifted, isNotEmpty);
      for (final preview in lifted) {
        final style = preview.text.style!;
        expect(style.decoration ?? TextDecoration.none, TextDecoration.none);
        expect(style.fontFamily, KalloTextStyles.sansFamily);
      }
    });

    testWidgets('the copy action wears a glyph the app actually ships', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      final glyphs = tester
          .widgetList<Icon>(
            find.descendant(
              of: find.byType(KalloMenuActionRow),
              matching: find.byType(Icon),
            ),
          )
          .map((i) => i.icon)
          .toList();
      // `cupertino_icons` is not a dependency of this app, so a CupertinoIcons
      // glyph has no font behind it and paints as a tofu box on device.
      // Lucide is the one icon font the app bundles, and the only set
      // AGENTS.md allows — at the 300 (1.5) stroke every other glyph uses.
      expect(glyphs, hasLength(2));
      expect(
        glyphs.map((g) => g?.fontPackage),
        everyElement('lucide_icons_flutter'),
      );
      expect(glyphs, [LucideIcons.copy300, LucideIcons.pencil300]);
    });

    testWidgets('the pinned bubble keeps the corner that makes it sent', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      // `CupertinoContextMenu`'s default preview wrapped the child in a
      // ClipRSuperellipse at a flat 12 — rounder than the tightened 4, so it
      // softened away the one corner that makes the bubble read as a sent
      // message for as long as the menu was open. The pinned copy is the
      // bubble itself, uncropped and unscaled.
      expect(bubbleBoxes(), findsNWidgets(2));
      for (final box in tester.widgetList<Container>(bubbleBoxes())) {
        final radius = (box.decoration! as BoxDecoration).borderRadius!
            as BorderRadius;
        expect(radius.bottomRight.x, 4);
      }
    });

    testWidgets('a wrapped message keeps its shape while the menu is open', (
      tester,
    ) async {
      const long =
          'hai bát phở bò tái nạm gầu, một đĩa rau thơm, một cốc trà đá và '
          'một bát chè đậu xanh tráng miệng';
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(_wrapLocalized(long));
      await tester.pumpAndSettle();

      final resting = tester.getRect(bubbleBoxes());
      final restingShape = resting.width / resting.height;

      await holdBubble(tester);

      // `CupertinoContextMenu` laid its copies out somewhere else entirely —
      // the lift in a tight box, the opened preview in a loose one as wide as
      // the SCREEN — so this three-line meal re-flowed into a single 760pt
      // line and was squeezed back down to fit. The pinned copy is drawn at
      // the page bubble's own rect, so there is nothing left to re-flow.
      final copies = tester.widgetList<Container>(bubbleBoxes()).length;
      expect(copies, greaterThan(1));
      for (var i = 0; i < copies; i++) {
        final rect = tester.getRect(bubbleBoxes().at(i));
        expect(rect.width / rect.height, closeTo(restingShape, 0.01));
      }
    });

    testWidgets('dismissing the menu copies nothing', (tester) async {
      final written = interceptClipboard(tester);
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);
      expect(find.text('Copy'), findsOneWidget);

      // The dismiss barrier, not the page underneath it.
      await tester.tapAt(const Offset(8, 8));
      await tester.pumpAndSettle();

      expect(find.text('Copy'), findsNothing);
      expect(written, isEmpty);
    });
  });
}
