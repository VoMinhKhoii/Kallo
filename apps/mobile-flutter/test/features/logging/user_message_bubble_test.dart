import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';
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
Widget _wrapLocalized(String text, {ProviderContainer? container}) {
  final app = _localized(text);
  return container == null
      ? ProviderScope(child: app)
      : UncontrolledProviderScope(container: container, child: app);
}

Widget _localized(String text) => EasyLocalization(
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
      expect(find.byType(CupertinoContextMenuAction), findsNWidgets(2));
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

      // The menu re-renders the bubble in the root overlay and its own route,
      // both of which sit ABOVE every Material in the app. `MaterialApp`
      // installs Flutter's fallback DefaultTextStyle up there — the one whose
      // debugLabel reads "consider putting your text in a Material" — and it
      // carries a yellow double underline. `dashBody` merges onto it
      // (TextStyle.inherit defaults to true) and overrides colour, size and
      // family but never `decoration`, so the underline survives and paints
      // under the lifted message. `TopToastPill` documents the same trap.
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
              of: find.byType(CupertinoContextMenuAction),
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
      expect(glyphs.map((g) => g?.fontPackage), everyElement('lucide_icons_flutter'));
      expect(glyphs, [LucideIcons.copy300, LucideIcons.pencil300]);
    });

    /// Every copy of the bubble on screen: the one in the page, the decoy the
    /// lift floats in the overlay, and the preview inside the menu's route.
    /// They live in three different subtrees, so they are found by the one
    /// thing they share — the beige wash nothing else in the app wears.
    Finder bubbleBoxes() => find.byWidgetPredicate(
      (w) =>
          w is Container &&
          (w.decoration as BoxDecoration?)?.color ==
              KalloColors.btnPrimarySoft,
    );

    testWidgets('the lifted bubble keeps the corner that makes it sent', (
      tester,
    ) async {
      await tester.pumpWidget(_wrapLocalized(sent));
      await tester.pumpAndSettle();

      await holdBubble(tester);

      // `CupertinoContextMenu`'s default preview wraps the child in a
      // ClipRSuperellipse at a flat 12. That is squarer than our three round
      // corners, so it takes nothing from them — but it is ROUNDER than the
      // tightened 4, so it softens away the one corner that makes the bubble
      // read as a sent message, for as long as the menu is open.
      expect(bubbleBoxes(), findsWidgets);
      expect(
        find.ancestor(
          of: bubbleBoxes(),
          matching: find.byType(ClipRSuperellipse),
        ),
        findsNothing,
      );
      for (final box in tester.widgetList<Container>(bubbleBoxes())) {
        final radius = (box.decoration! as BoxDecoration).borderRadius!
            as BorderRadius;
        expect(radius.bottomRight.x, 4);
      }
    });

    testWidgets('a wrapped message lifts as itself, not as one long line', (
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

      // The menu lays its copies out somewhere else entirely: the lift in a
      // tight box, the opened preview in a loose one as wide as the SCREEN.
      // A bubble takes its width from the row it sits in, so left to those
      // constraints this three-line meal re-flowed into a single 760pt line
      // and was then squeezed back down to fit — the lifted copy was a
      // different SHAPE from the one the user was looking at.
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

      // The dimming barrier, not the page underneath it.
      await tester.tapAt(const Offset(8, 8));
      await tester.pumpAndSettle();

      expect(find.text('Copy'), findsNothing);
      expect(written, isEmpty);
    });
  });
}
