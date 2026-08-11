import 'dart:math';

import 'bar_loaders.dart';
import 'dot_loaders.dart';
import 'heart_loader.dart';
import 'ring_loaders.dart';
import 'spin_loaders.dart';
import 'svg_loader.dart';

export 'svg_loader.dart' show SvgLoaderSpec, SvgLoaderView;

/// The pool one meal draws from — the full SamHerbert/SVG-Loaders collection
/// (MIT), alphabetical. Web picks from a six-loader subset of the same set
/// (`components/shared/svg-loaders.tsx`); mobile carries all twelve, so the
/// loader is rarely the same two meals running.
///
/// One pick per analysis, held from the first stage through the reveal — a
/// loader that changes mid-run reads as a restart.
const List<SvgLoaderSpec> kSvgLoaders = [
  audioLoader,
  ballTriangleLoader,
  barsLoader,
  circlesLoader,
  gridLoader,
  heartsLoader,
  ovalLoader,
  puffLoader,
  ringsLoader,
  spinningCirclesLoader,
  tailSpinLoader,
  threeDotsLoader,
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
