import Foundation

/// How big a dial's readout is and where it sits — numbers only, no views.
///
/// Ported from the web dial code, which sizes the type from the ARC rather
/// than from a fixed ramp (the Flutter dials still spell fixed sizes, and none
/// of those were drawn for a widget's 57pt mark):
///   `lib/core/ui/gauge-figure-size.ts`    figure / unit / meta sizes
///   `components/shared/gauge/gauge-lines.ts` line heights, calorie meta cap
///   `lib/core/ui/gauge-readout-layout.ts` the second line sits on the tips
///   `lib/core/ui/gauge-strip-metrics.ts`  macro label box, alignCentres
/// `test/ios/today_widget_test.dart` pins these constants to those files.
enum GaugeReadout {
  enum Kind { case calorie, macro }

  static let figureRatioCalorie: Double = 0.39
  static let figureRatioMacro: Double = 0.44
  static let figureMin: Double = 11
  static let figureMax: Double = 44

  /// The gap between a readout's stacked lines, and between a macro's label
  /// and its arc.
  static let lineGap: Double = 2
  static let labelGap: Double = 2

  /// The two short lines carry this much leading above their font size.
  private static let shortLineLeading: Double = 4

  private static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
    max(lo, min(hi, v))
  }

  /// JS `Math.round`: halves go UP, where Swift's `.rounded()` goes away from 0.
  static func jsRound(_ v: Double) -> Double { (v + 0.5).rounded(.down) }

  static func figureSize(_ r: Double, _ kind: Kind) -> Double {
    let ratio = kind == .calorie ? figureRatioCalorie : figureRatioMacro
    return clamp(jsRound(ratio * r), figureMin, figureMax)
  }

  static func unitSize(_ r: Double) -> Double { clamp(jsRound(0.18 * r), 11, 16) }

  static func metaSize(_ r: Double) -> Double { clamp(jsRound(0.25 * r), 10, 14) }

  /// A number the widget does not have (signed out): the app's own mark for
  /// an unknown value (`MacroRing`).
  static let noValue = "—"

  /// Every figure line is set at 1.15, so the stack measures before it paints.
  static func lineHeight(_ fontSize: Double) -> Double { jsRound(fontSize * 1.15) }

  /// The opening between the tip caps, where the unit line sits.
  static func tipOpening(_ r: Double) -> Double { 1.482 * r }

  /// Whether a unit line `width` points wide fits on the tips, or the dial
  /// says the one word instead (`gaugeFitsLongUnit`).
  ///
  /// The web asks this of a fixed worst case — "kcal remaining" at 6.876em —
  /// so its answer cannot flip with a sidebar. A widget has one size per phone
  /// and one language, so it asks of the words it will actually draw: at the
  /// 53pt dial an iPhone 17 Pro gets, "Kcal eaten" clears the tips by ~10pt a side
  /// where the worst case would have cut the sentence to "Eaten".
  static func fitsUnit(width: Double, radius r: Double) -> Bool {
    width <= 0.9 * tipOpening(r)
  }

  /// One line's font size and its line box.
  struct Line: Equatable {
    let size: Double
    let height: Double
  }

  /// The calorie readout: figure, unit, detail. The detail never outgrows the
  /// unit above it (`readoutSizes` in gauge-lines.ts).
  static func calorieLines(_ r: Double) -> [Line] {
    let figure = figureSize(r, .calorie)
    let unit = unitSize(r)
    let meta = min(unit, metaSize(r))
    return [
      Line(size: figure, height: lineHeight(figure)),
      Line(size: unit, height: unit + shortLineLeading),
      Line(size: meta, height: meta + shortLineLeading),
    ]
  }

  /// A macro readout: grams, over the target.
  static func macroLines(_ r: Double) -> [Line] {
    let figure = figureSize(r, .macro)
    let meta = metaSize(r)
    return [
      Line(size: figure, height: lineHeight(figure)),
      Line(size: meta, height: meta + shortLineLeading),
    ]
  }

  struct Layout: Equatable {
    /// How far down the box the arc is painted.
    let arcTop: Double
    /// How far down the box the first line starts.
    let readoutTop: Double
    /// The height the dial reserves for both.
    let height: Double
  }

  /// The SECOND line's middle sits on the arc's tips. A small dial whose lines
  /// want to start above its own arc drops the arc instead of clipping.
  static func layout(_ r: Double, _ lines: [Line]) -> Layout {
    let heights = lines.map(\.height)
    let readout = heights.reduce(0, +) + lineGap * Double(heights.count - 1)
    let wanted = r + GaugeGeometry.tipOffset(r) - heights[1] / 2 - lineGap - heights[0]
    let arcTop = wanted < 0 ? -wanted : 0
    let readoutTop = wanted + arcTop
    return Layout(
      arcTop: arcTop,
      readoutTop: readoutTop,
      height: max(arcTop + GaugeGeometry.height(r), readoutTop + readout)
    )
  }

  /// A macro label's own line box, above its arc.
  static func labelLineHeight(_ r: Double) -> Double { jsRound(metaSize(r) * 1.3) }

  /// The macro glyph beside the label (`macro-dial.tsx`).
  static func glyphSize(_ r: Double) -> Double { max(12, jsRound(r * 0.3)) }

  /// How far each side of a row drops so the arcs share one centre line. Only
  /// one of the two is ever non-zero.
  static func alignCentres(calorie cR: Double, macro mR: Double)
    -> (calorieShift: Double, macroShift: Double)
  {
    let calorie = layout(cR, calorieLines(cR)).arcTop + cR
    let macro = labelLineHeight(mR) + labelGap + layout(mR, macroLines(mR)).arcTop + mR
    return (max(0, macro - calorie), max(0, calorie - macro))
  }

  /// The calorie dial's whole height at `r`.
  static func calorieHeight(_ r: Double) -> Double { layout(r, calorieLines(r)).height }

  /// The largest whole radius, up to `cap`, whose calorie dial fits `room`
  /// points of height — 57 on a 170pt widget; less only on a smaller phone.
  static func calorieRadius(fitting room: Double, cap: Double) -> Double {
    var r = cap
    while r > 20 && calorieHeight(r) > room { r -= 1 }
    return r
  }
}
