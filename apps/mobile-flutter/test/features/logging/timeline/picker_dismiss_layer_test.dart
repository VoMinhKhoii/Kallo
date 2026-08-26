import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/picker_dismiss_layer.dart';

/// Pumps the layer in the constraint context the logging screen actually gives
/// it: a [Column] child under [Expanded], i.e. a TIGHT height and a LOOSE
/// width. Putting the layer straight into `home:` instead would hand it tight
/// constraints on both axes and mask the very collapse these tests exist for.
Future<void> _pumpInColumn(
  WidgetTester tester, {
  required ValueListenable<bool> expanded,
  VoidCallback? onDismiss,
  VoidCallback? onFeedTap,
}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Column(
          children: [
            const SizedBox(height: 56),
            Expanded(
              child: PickerDismissLayer(
                expanded: expanded,
                onDismiss: onDismiss ?? () {},
                child: GestureDetector(
                  onTap: onFeedTap ?? () {},
                  child: Container(
                    key: const Key('feed'),
                    color: const Color(0xFFFF0000),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

double _feedWidth(WidgetTester tester) =>
    tester.getSize(find.byKey(const Key('feed'))).width;

void main() {
  group('PickerDismissLayer', () {
    testWidgets('the feed keeps full width while the picker is collapsed', (
      tester,
    ) async {
      final expanded = ValueNotifier(false);
      addTearDown(expanded.dispose);

      await _pumpInColumn(tester, expanded: expanded);

      final screenWidth = tester.getSize(find.byType(Scaffold)).width;
      expect(_feedWidth(tester), screenWidth);
    });

    testWidgets('the feed keeps full width across an expand/collapse cycle', (
      tester,
    ) async {
      final expanded = ValueNotifier(false);
      addTearDown(expanded.dispose);

      await _pumpInColumn(tester, expanded: expanded);
      final screenWidth = tester.getSize(find.byType(Scaffold)).width;

      expanded.value = true;
      await tester.pump();
      expect(_feedWidth(tester), screenWidth, reason: 'while expanded');

      // The regression: collapsing used to swap the positioned scrim for a
      // zero-sized non-positioned child, which sized the whole stack to 0.
      expanded.value = false;
      await tester.pump();
      expect(_feedWidth(tester), screenWidth, reason: 'after collapsing');
    });

    testWidgets('taps reach the feed while collapsed, the scrim while expanded', (
      tester,
    ) async {
      final expanded = ValueNotifier(false);
      addTearDown(expanded.dispose);

      var dismissed = 0;
      var feedTaps = 0;
      await _pumpInColumn(
        tester,
        expanded: expanded,
        onDismiss: () => dismissed++,
        onFeedTap: () => feedTaps++,
      );

      await tester.tap(find.byKey(const Key('feed')));
      expect(feedTaps, 1);
      expect(dismissed, 0);

      expanded.value = true;
      await tester.pump();

      await tester.tap(find.byKey(const Key('feed')));
      expect(dismissed, 1);
      expect(feedTaps, 1, reason: 'the scrim swallows the tap');
    });
  });
}
