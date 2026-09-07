import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/surface/measured_height.dart';

/// The contract two docks rely on: the height arrives after the first frame,
/// arrives again when the child grows WITHOUT the measuring widget rebuilding,
/// and never arrives for sub-pixel churn.
void main() {
  testWidgets('reports once after the first frame', (tester) async {
    final reports = <double>[];
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        // Loose constraints, as under a dock's Align: at the root the child
        // would be forced to the full 600pt and the test would prove nothing.
        child: Center(
          child: MeasuredHeight(
            onChanged: reports.add,
            child: const SizedBox(height: 47, width: 100),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(reports, [47]);
  });

  testWidgets('reports again when the child grows on its own', (tester) async {
    final reports = <double>[];
    final height = ValueNotifier<double>(47);
    addTearDown(height.dispose);
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        // Loose constraints, as under a dock's Align: at the root the child
        // would be forced to the full 600pt and the test would prove nothing.
        child: Center(
          child: MeasuredHeight(
            onChanged: reports.add,
            // The child rebuilds itself; MeasuredHeight's build never re-runs —
            // exactly how a multiline field grows under the finger.
            child: ValueListenableBuilder<double>(
              valueListenable: height,
              builder: (_, h, __) => SizedBox(height: h, width: 100),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(reports, [47]);

    height.value = 116;
    await tester.pump();
    await tester.pump();
    expect(reports, [47, 116]);
  });

  testWidgets('ignores sub-pixel churn', (tester) async {
    final reports = <double>[];
    final height = ValueNotifier<double>(47);
    addTearDown(height.dispose);
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        // Loose constraints, as under a dock's Align: at the root the child
        // would be forced to the full 600pt and the test would prove nothing.
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
    height.value = 47.3;
    await tester.pump();
    await tester.pump();
    expect(reports, [47], reason: 'a 0.3px move must not re-report');
  });
}
