import 'dart:math';

import 'classic/bar_loaders.dart';
import 'classic/dot_loaders.dart';
import 'classic/heart_loader.dart';
import 'kitchen/pan_loaders.dart';
import 'kitchen/prep_loaders.dart';
import 'kitchen/steam_loaders.dart';
import 'motion/block_loaders.dart';
import 'motion/line_loaders.dart';
import 'motion/wave_loaders.dart';
import 'svg_loader.dart';

export 'svg_loader.dart' show SvgLoaderSpec, SvgLoaderView;

/// The pool one meal draws from — one pick per analysis, held from the first
/// stage through the reveal (a loader that changes mid-run reads as a restart).
///
/// Deliberately spinner-free. The five `classic` entries are the non-circular
/// survivors of the SamHerbert/SVG-Loaders set (MIT) that web still draws from
/// in `components/shared/svg-loaders.tsx`; the rest are this app's own —
/// `kitchen` for the ones that look like cooking, `motion` for the ones that
/// are just alive.
const List<SvgLoaderSpec> kSvgLoaders = [
  // classic
  audioLoader,
  barsLoader,
  gridLoader,
  heartsLoader,
  threeDotsLoader,
  // kitchen
  bubblesLoader,
  knifeChopLoader,
  panFlipLoader,
  pourDripLoader,
  riceFallLoader,
  steamLoader,
  whiskLoader,
  // motion
  bounceLoader,
  dashLoader,
  ecgLoader,
  flipSquaresLoader,
  jellyLoader,
  ladderLoader,
  waveLoader,
];

final Random _random = Random();

/// A random index into [kSvgLoaders]. Takes a [Random] so tests are
/// deterministic.
int pickLoaderIndex([Random? random]) =>
    (random ?? _random).nextInt(kSvgLoaders.length);

/// The loader at [index], wrapping out-of-range values rather than throwing —
/// the index is persisted across rebuilds and must never crash the feed.
SvgLoaderSpec loaderAt(int index) =>
    kSvgLoaders[index.abs() % kSvgLoaders.length];
