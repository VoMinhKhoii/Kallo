import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';

void main() {
  for (final palette in KalloPaletteId.values) {
    testWidgets('side capsule targets retain their size in $palette', (
      tester,
    ) async {
      final previous = KalloPalette.currentId;
      KalloPalette.currentId = palette;
      addTearDown(() => KalloPalette.currentId = previous);
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: PillNavSurface(
              axis: Axis.vertical,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(key: Key('target'), width: 56, height: 48),
                  SizedBox(width: 56, height: 48),
                  SizedBox(width: 56, height: 56),
                  SizedBox(width: 56, height: 48),
                  SizedBox(width: 56, height: 48),
                ],
              ),
            ),
          ),
        ),
      );
      expect(tester.getSize(find.byType(PillNavSurface)), const Size(56, 272));
      expect(
        tester.getSize(find.byKey(const Key('target'))),
        const Size(56, 48),
      );
      expect(tester.takeException(), isNull);
    });
  }
}
