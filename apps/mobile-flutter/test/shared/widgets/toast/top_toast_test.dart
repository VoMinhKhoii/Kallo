import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';

/// The toast is inserted into the ROOT overlay, above every Material in the
/// app. Text with no Material ancestor inherits Flutter's fallback style, which
/// carries a yellow double underline; `dashBody` merges onto it and overrides
/// colour/size/family but not `decoration`, so the underline used to survive
/// and paint yellow under the message.
TextStyle _resolvedStyle(WidgetTester tester, String text) {
  final richText = tester.widget<RichText>(
    find.descendant(of: find.text(text), matching: find.byType(RichText)),
  );
  return (richText.text as TextSpan).style!;
}

Widget _host(void Function(BuildContext) show) => MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => show(context),
            child: const Text('go'),
          ),
        ),
      ),
    );

void main() {
  testWidgets('message carries no inherited text decoration', (tester) async {
    await tester.pumpWidget(_host((c) => showTopToast(c, 'Saved')));
    await tester.tap(find.text('go'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    final style = _resolvedStyle(tester, 'Saved');
    expect(style.decoration ?? TextDecoration.none, TextDecoration.none);
    // decorationColor is inherited from the theme and is inert while there is
    // no decoration; what must never come back is the fallback's yellow.
    expect(style.decorationColor, isNot(const Color(0xFFFFFF00)));

    await tester.pumpAndSettle(const Duration(seconds: 3));
  });

  testWidgets('action label carries no inherited text decoration',
      (tester) async {
    await tester.pumpWidget(
      _host((c) => showTopToast(c, 'Removed', actionLabel: 'Undo')),
    );
    await tester.tap(find.text('go'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    final style = _resolvedStyle(tester, 'Undo');
    expect(style.decoration ?? TextDecoration.none, TextDecoration.none);
    // decorationColor is inherited from the theme and is inert while there is
    // no decoration; what must never come back is the fallback's yellow.
    expect(style.decorationColor, isNot(const Color(0xFFFFFF00)));

    await tester.pumpAndSettle(const Duration(seconds: 3));
  });
}
