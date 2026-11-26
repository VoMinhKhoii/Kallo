import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/window/column_free_page.dart';
import 'package:kallo_mobile/shell/window/keep_clear.dart';
import 'package:kallo_mobile/shell/window/keep_clear_clip.dart';
import 'package:kallo_mobile/shell/window/keep_clear_zones.dart';
import 'package:kallo_mobile/shell/window/window_layout.dart';

/// The closed Duo held upright: a 466pt window with its control column, 84pt,
/// on the right.
const _size = Size(466, 678);
const _column = EdgeInsets.only(right: 84, bottom: 34);

Future<void> _pump(
  WidgetTester tester,
  Widget page, {
  EdgeInsets insets = _column,
  Size size = _size,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(size: size, padding: insets, viewPadding: insets),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: ColumnFreePage(child: page),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// A full-width row [top] points down the page, on a 24pt margin.
Widget _row(double top, KeepClearMode mode, {Key? key}) => Column(
  crossAxisAlignment: CrossAxisAlignment.stretch,
  children: [
    SizedBox(height: top),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: KeepClear(mode: mode, child: SizedBox(key: key, height: 40)),
    ),
  ],
);

void main() {
  test('the keep-clear corner follows what the system puts in the column', () {
    // Outer display upright: camera, clock and status icons at the top.
    expect(WindowLayout.resolve(_size, _column).keepClear, [
      const Rect.fromLTWH(382, 0, 84, kOuterStatusClear),
    ]);
    // Outer display on its side: only the camera, at the top with the column
    // on the left and at the bottom with it on the right.
    expect(
      WindowLayout.resolve(
        const Size(678, 466),
        const EdgeInsets.only(left: 84),
      ).keepClear,
      [const Rect.fromLTWH(0, 0, 84, kCameraCornerClear)],
    );
    expect(
      WindowLayout.resolve(
        const Size(678, 466),
        const EdgeInsets.only(right: 84),
      ).keepClear,
      [
        const Rect.fromLTWH(
          594,
          466 - kCameraCornerClear,
          84,
          kCameraCornerClear,
        ),
      ],
    );
    // Inner display, also under a pinned video: the status items alone.
    for (final size in const [Size(951, 669), Size(951, 420)]) {
      expect(
        WindowLayout.resolve(size, const EdgeInsets.only(right: 84)).keepClear,
        [const Rect.fromLTWH(867, 0, 84, kInnerStatusClear)],
      );
    }
    expect(
      WindowLayout.resolve(
        const Size(402, 874),
        const EdgeInsets.fromLTRB(0, 62, 0, 34),
      ).keepClear,
      isEmpty,
    );
  });

  testWidgets('the page takes the whole window and centres on it', (
    tester,
  ) async {
    const key = Key('content');
    await _pump(tester, const SafeArea(child: SizedBox.expand(key: key)));
    final rect = tester.getRect(find.byKey(key));
    expect(rect.left, 0);
    expect(rect.right, _size.width);
  });

  testWidgets('beside the status items a row gives way on the column side', (
    tester,
  ) async {
    const key = Key('row');
    await _pump(tester, _row(60, KeepClearMode.side, key: key));
    // It keeps the same 24pt from the column it kept from the window edge.
    expect(
      tester.getRect(find.byKey(key)),
      const Rect.fromLTRB(24, 60, 358, 100),
    );
  });

  testWidgets('a centred row gives way on both sides', (tester) async {
    const key = Key('row');
    await _pump(tester, _row(60, KeepClearMode.centred, key: key));
    final rect = tester.getRect(find.byKey(key));
    expect(rect, const Rect.fromLTRB(108, 60, 358, 100));
    expect(rect.center.dx, _size.width / 2);
  });

  testWidgets('a full-width row moves down below the corner', (tester) async {
    const key = Key('row');
    await _pump(tester, _row(60, KeepClearMode.below, key: key));
    expect(
      tester.getRect(find.byKey(key)),
      const Rect.fromLTRB(24, kOuterStatusClear, 442, kOuterStatusClear + 40),
    );
  });

  testWidgets('a row below the corner keeps the full width', (tester) async {
    const key = Key('row');
    await _pump(tester, _row(200, KeepClearMode.side, key: key));
    expect(
      tester.getRect(find.byKey(key)),
      const Rect.fromLTRB(24, 200, 442, 240),
    );
  });

  testWidgets('a window without a control column changes nothing', (
    tester,
  ) async {
    const key = Key('row');
    await _pump(
      tester,
      _row(60, KeepClearMode.side, key: key),
      insets: const EdgeInsets.fromLTRB(0, 62, 0, 34),
      size: const Size(402, 874),
    );
    expect(
      tester.getRect(find.byKey(key)),
      const Rect.fromLTRB(24, 60, 378, 100),
    );
  });

  testWidgets('a scroll view cuts the corner out of what it paints', (
    tester,
  ) async {
    await _pump(
      tester,
      const KeepClearClip(
        child: SingleChildScrollView(child: SizedBox(height: 2000)),
      ),
    );
    final clip = tester.renderObject<RenderKeepClearClip>(
      find.byType(KeepClearClip),
    );
    expect(clip.holes, [const Rect.fromLTWH(382, 0, 84, kOuterStatusClear)]);
    expect(
      tester.layers.whereType<ClipPathLayer>().single.clipPath!.contains(
        const Offset(420, 80),
      ),
      isFalse,
    );
  });
}
