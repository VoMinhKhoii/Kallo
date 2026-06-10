import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/app.dart';

void main() {
  testWidgets('Nham placeholder renders', (WidgetTester tester) async {
    await tester.pumpWidget(const NhamApp());

    expect(find.text('Nham'), findsOneWidget);
  });
}
