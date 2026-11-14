import 'package:flutter/material.dart';

/// The windows iPhone Duo hands an app, plus a classic phone both ways up.
///
/// Sizes and insets are what Flutter 3.47.7 reports on the Duo simulator
/// (iOS 27.1): flutter/flutter#193025 and #195928. Apple publishes no point
/// sizes, so treat these as observations to re-measure, not constants. The
/// Split View and pinned-video rows are estimates: nobody has published those
/// windows' insets.
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
  // On its side a classic phone has EQUAL side insets: no control column.
  Pose('phone-landscape', Size(874, 402), EdgeInsets.fromLTRB(62, 0, 62, 21)),
];
