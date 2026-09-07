import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/surface/measured_height.dart';

/// The contract two docks rely on: the height arrives after the first frame,
/// arrives again when the child grows WITHOUT the measuring widget rebuilding,
/// and never arrives for sub-pixel churn.
///
/// Every case mounts under loose constraints, as under a dock's Align: at the
/// root the child would be forced to the full 600pt and prove nothing. A
/// [ValueNotifier] drives the child's height so IT rebuilds and
/// [MeasuredHeight]'s build never re-runs — exactly how a multiline field
/// grows under the finger.
Future<List<double>> _mount(
  WidgetTester tester,
  ValueNotifier<double> height,
) async {
  final reports = <double>[];
  await tester.pumpWidget(
    Directionality(
      textDirection: TextDirection.ltr,
      child: Center(
        child: MeasuredHeight(
          onChanged: reports.add,
          child: ValueListenableBuilder<double>(
            valueListenable: height,
            builder: (_, h, __) => SizedBox(height: h, width: 100),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return reports;
}

void main() {
  late ValueNotifier<double> height;

  setUp(() {
    height = ValueNotifier<double>(47);
    addTearDown(height.dispose);
  });

  testWidgets('reports once after the first frame', (tester) async {
    final reports = await _mount(tester, height);
    expect(reports, [47]);
  });

  testWidgets('reports again when the child grows on its own', (tester) async {
    final reports = await _mount(tester, height);
    height.value = 116;
    await tester.pump();
    await tester.pump();
    expect(reports, [47, 116]);
  });

  testWidgets('ignores sub-pixel churn', (tester) async {
    final reports = await _mount(tester, height);
    height.value = 47.3;
    await tester.pump();
    await tester.pump();
    expect(reports, [47], reason: 'a 0.3px move must not re-report');
  });
}
