import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/surface/scroll_separator.dart';

void main() {
  testWidgets(
    'a restored offset corrected during layout updates the hairline safely',
    (tester) async {
      final controller = ScrollController(initialScrollOffset: 1200);
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ScrollSeparator(
              header: const SizedBox(height: 48),
              child: CustomScrollView(
                controller: controller,
                physics: const BouncingScrollPhysics(),
                slivers: const [
                  SliverToBoxAdapter(child: SizedBox(height: 1000)),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(controller.offset, controller.position.maxScrollExtent);
      expect(
        tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity,
        1,
      );
      controller.jumpTo(0);
      await tester.pumpAndSettle();
      expect(
        tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity,
        0,
      );
    },
  );
}
