import 'package:flutter/material.dart';

/// System insets measured on the Duo simulator with Flutter 3.47.7
/// (duo-flutter-findings.md in the adaptation research scratchpad).
class Pose {
  const Pose(this.name, this.size, this.padding);

  final String name;
  final Size size;
  final EdgeInsets padding;
  double get devicePixelRatio => 2;
}

const poses = [
  Pose('phone', Size(402, 874), EdgeInsets.fromLTRB(0, 62, 0, 34)),
  Pose(
    'outer-portrait',
    Size(466, 678),
    EdgeInsets.only(right: 84, bottom: 34),
  ),
  Pose(
    'outer-landscape',
    Size(678, 466),
    EdgeInsets.only(right: 84, bottom: 34),
  ),
  Pose('inner-portrait', Size(669, 951), EdgeInsets.only(top: 82, bottom: 34)),
  Pose(
    'inner-portrait-small',
    Size(626, 890),
    EdgeInsets.only(top: 82, bottom: 34),
  ),
  Pose(
    'inner-landscape',
    Size(951, 669),
    EdgeInsets.only(right: 84, bottom: 34),
  ),
  Pose('split-left', Size(475, 669), EdgeInsets.only(left: 84, bottom: 34)),
  Pose('split-right', Size(475, 669), EdgeInsets.only(right: 84, bottom: 34)),
  Pose('pip-pinned', Size(951, 420), EdgeInsets.only(right: 84, bottom: 34)),
  Pose('tiny', Size(320, 480), EdgeInsets.only(top: 20)),
  Pose('huge', Size(1200, 800), EdgeInsets.fromLTRB(0, 24, 0, 20)),
];
