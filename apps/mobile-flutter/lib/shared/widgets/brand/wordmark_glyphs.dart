import 'dart:ui';

import '../../logic/svg_path_parser.dart';

/// The letters of the Kallo wordmark, left to right.
enum WordmarkGlyph { k, a, l1, l2, o }

/// The Kallo wordmark taken apart letter by letter, in the 2180x812 viewBox of
/// `docs/brand/kallo/assets/kallo-wordmark.svg`.
///
/// [KalloWordmark] joins the letters back into one path ([svgPathData]); the
/// launch intro (`shell/launch/`) moves them one at a time. One copy of the
/// geometry serves both, so the letters the intro assembles are exactly the
/// mark the rest of the app wears.
abstract final class WordmarkGlyphs {
  /// The wordmark's viewBox.
  static const Size viewBox = Size(2180, 812);

  /// The line every letter stands on.
  static const double baseline = 776;

  /// Each letter's ink bounds. The a and the o overshoot the baseline by a
  /// few units, as round letters do.
  static const Map<WordmarkGlyph, Rect> bounds = {
    WordmarkGlyph.k: Rect.fromLTRB(20, 68, 676, 776),
    WordmarkGlyph.a: Rect.fromLTRB(619, 262, 1094, 788),
    WordmarkGlyph.l1: Rect.fromLTRB(1158, 20, 1324, 776),
    WordmarkGlyph.l2: Rect.fromLTRB(1396, 20, 1562, 776),
    WordmarkGlyph.o: Rect.fromLTRB(1607, 262, 2160, 792),
  };

  /// The whole wordmark as one run of path data, for an SVG `d` attribute.
  static const String svgPathData = '$_k$_a$_l1$_l2$_oRing$_oCounter';

  /// The letter's outline, parsed once and cached.
  static Path pathOf(WordmarkGlyph glyph) =>
      _paths.putIfAbsent(glyph, () => parseSvgPathData(_data[glyph]!));

  /// The hole inside the o, alone — where the launch intro opens its window
  /// into the app.
  static final Path counter = parseSvgPathData(_oCounter);

  static final Map<WordmarkGlyph, Path> _paths = {};

  static const Map<WordmarkGlyph, String> _data = {
    WordmarkGlyph.k: _k,
    WordmarkGlyph.a: _a,
    WordmarkGlyph.l1: _l1,
    WordmarkGlyph.l2: _l2,
    WordmarkGlyph.o: '$_oRing$_oCounter',
  };

  // The glyph data below is `kallo-wordmark.svg` split at its subpaths —
  // byte for byte, so [svgPathData] reproduces the file's `d` exactly.

  static const String _k =
      'M20 68H188V776H20ZM444 68H658L430 345H216ZM216 457H439L676 776H453Z';

  static const String _a =
      'M944 559H923Q896 559 868.5 561.5Q841 564 819.5 571.0Q798 578 784.0 591.5Q770 605 770 627Q770 641 776.5 651.0Q783 661 793.0 667.0Q803 673 816.0 675.5Q829 678 841 678Q891 678 917.5 650.5Q944 623 944 576ZM643 346Q687 304 745.5 283.0Q804 262 865 262Q928 262 971.5 277.5Q1015 293 1042.0 325.5Q1069 358 1081.5 407.5Q1094 457 1094 525V776H944V723H941Q922 754 883.5 771.0Q845 788 800 788Q770 788 738.0 780.0Q706 772 679.5 754.0Q653 736 636.0 706.0Q619 676 619 632Q619 578 648.5 545.0Q678 512 724.5 494.0Q771 476 828.0 470.0Q885 464 939 464V456Q939 419 913.0 401.5Q887 384 849 384Q814 384 781.5 399.0Q749 414 726 435Z';

  static const String _l1 = 'M1158 776V20H1324V776Z';

  static const String _l2 = 'M1396 776V20H1562V776Z';

  static const String _oRing =
      'M2160 525Q2160 586 2138.0 635.5Q2116 685 2078.0 719.5Q2040 754 1990.0 773.0Q1940 792 1883 792Q1827 792 1776.5 773.0Q1726 754 1688.5 719.5Q1651 685 1629.0 635.5Q1607 586 1607 525Q1607 464 1629.0 415.0Q1651 366 1688.5 332.0Q1726 298 1776.5 280.0Q1827 262 1883 262Q1940 262 1990.0 280.0Q2040 298 2078.0 332.0Q2116 366 2138.0 415.0Q2160 464 2160 525Z';

  static const String _oCounter =
      'M2002 525Q2002 501 1994.0 478.0Q1986 455 1971.0 437.5Q1956 420 1934.0 409.0Q1912 398 1883 398Q1854 398 1832.0 409.0Q1810 420 1795.5 437.5Q1781 455 1773.5 478.0Q1766 501 1766 525Q1766 549 1773.5 572.0Q1781 595 1796.0 613.5Q1811 632 1833.0 643.0Q1855 654 1884 654Q1913 654 1935.0 643.0Q1957 632 1972.0 613.5Q1987 595 1994.5 572.0Q2002 549 2002 525Z';
}
