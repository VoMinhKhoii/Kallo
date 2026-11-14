import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shell/window/window_layout.dart';

/// The window sizes and insets below are what Flutter reports on the iPhone
/// Duo simulator (Flutter 3.47.7, iOS 27.1), plus the classic phone in both
/// orientations, which must keep resolving to today's layout.
WindowLayout _resolve(
  double w,
  double h, {
  double left = 0,
  double top = 0,
  double right = 0,
  double bottom = 0,
}) => WindowLayout.resolve(
  Size(w, h),
  EdgeInsets.fromLTRB(left, top, right, bottom),
);

void main() {
  test('a phone in portrait keeps its controls on the bottom', () {
    final layout = _resolve(402, 874, top: 62, bottom: 34);
    expect(layout.controlEdge, ControlEdge.bottom);
    expect(layout.columnWidth, 0);
    expect(layout.regularWidth, isFalse);
    expect(layout.twoPane, isFalse);
  });

  test('a phone on its side has no fold: one column, nothing kept clear', () {
    final layout = _resolve(874, 402, left: 62, right: 62, bottom: 21);
    expect(layout.controlEdge, ControlEdge.bottom);
    expect(layout.regularWidth, isTrue);
    expect(layout.compactHeight, isTrue);
    expect(layout.twoPane, isFalse);
    expect(layout.foldAcross, isFalse);
  });

  test('the outer display puts the controls in a column on the right', () {
    final layout = _resolve(466, 678, right: 84, bottom: 34);
    expect(layout.controlEdge, ControlEdge.right);
    expect(layout.columnWidth, 84);
    expect(layout.contentWidth, 382);
    expect(layout.regularWidth, isFalse);
    expect(layout.twoPane, isFalse);
  });

  test('the outer display on its side is compact both ways', () {
    final layout = _resolve(678, 466, right: 84, bottom: 34);
    expect(layout.controlEdge, ControlEdge.right);
    expect(layout.compactHeight, isTrue);
    expect(layout.regularWidth, isFalse);
    expect(layout.twoPane, isFalse);
  });

  test('the outer display turned the other way moves the column left', () {
    final layout = _resolve(678, 466, left: 84, bottom: 34);
    expect(layout.controlEdge, ControlEdge.left);
    expect(layout.columnWidth, 84);
  });

  test('the inner display in landscape splits into two panes at the fold', () {
    final layout = _resolve(951, 669, right: 84, bottom: 34);
    expect(layout.controlEdge, ControlEdge.right);
    expect(layout.regularWidth, isTrue);
    expect(layout.twoPane, isTrue);
    expect(layout.foldX, 475.5);
  });

  test('the inner display in portrait is regular width, one column', () {
    final layout = _resolve(669, 951, top: 82, bottom: 34);
    expect(layout.controlEdge, ControlEdge.bottom);
    expect(layout.regularWidth, isTrue);
    expect(layout.twoPane, isFalse);
    expect(layout.foldAcross, isTrue);
  });

  test('the left app of a Split View has its column on the left', () {
    final layout = _resolve(475, 669, left: 84, bottom: 34);
    expect(layout.controlEdge, ControlEdge.left);
    expect(layout.regularWidth, isFalse);
    expect(layout.twoPane, isFalse);
  });

  test('a wide window under a pinned video keeps two panes', () {
    final layout = _resolve(951, 420, right: 84, bottom: 34);
    expect(layout.compactHeight, isTrue);
    expect(layout.twoPane, isTrue);
  });
}
