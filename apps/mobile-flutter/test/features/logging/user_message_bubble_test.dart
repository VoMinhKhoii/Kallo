import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/widgets/streaming/user_message_bubble.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

Widget _wrap(String text, {double width = 390}) => MaterialApp(
  home: Scaffold(
    body: Center(child: SizedBox(width: width, child: UserMessageBubble(text: text))),
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

  testWidgets('is umber with white copy, not the tan accent', (tester) async {
    await tester.pumpWidget(_wrap('phở bò'));
    // Tan behind running text would break the palette rule AND fail contrast
    // against white at 2.1:1; umber clears AA at 5.9:1.
    expect(_decoration(tester).color, NhamColors.btn);
    expect(
      tester.widget<Text>(find.text('phở bò')).style?.color,
      NhamColors.bandForeground,
    );
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
}
