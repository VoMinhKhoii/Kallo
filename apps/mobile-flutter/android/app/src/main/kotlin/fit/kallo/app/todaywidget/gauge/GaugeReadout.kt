package fit.kallo.app.todaywidget.gauge

import kotlin.math.floor

/**
 * How big a dial's readout is and where it sits: numbers only, no drawing.
 *
 * The same port of the web dial code as `ios/TodayWidget/Gauge/GaugeReadout.swift`:
 *   `lib/core/ui/gauge-figure-size.ts`       figure / unit / meta sizes
 *   `components/shared/gauge/gauge-lines.ts` line heights, calorie meta cap
 *   `lib/core/ui/gauge-readout-layout.ts`    the second line sits on the tips
 *   `lib/core/ui/gauge-strip-metrics.ts`     macro label box, alignCentres
 * `test/android/today_widget_test.dart` pins these constants to those files.
 * Units are dp.
 */
object GaugeReadout {
  enum class Kind { CALORIE, MACRO }

  const val FIGURE_RATIO_CALORIE = 0.39
  const val FIGURE_RATIO_MACRO = 0.44
  const val FIGURE_MIN = 11.0
  const val FIGURE_MAX = 44.0

  /** The gap between a readout's stacked lines, and between a macro's label and its arc. */
  const val LINE_GAP = 2.0
  const val LABEL_GAP = 2.0

  /** The two short lines carry this much leading above their font size. */
  private const val SHORT_LINE_LEADING = 4.0

  /** A number the widget does not have (signed out): the app's own mark for an unknown value. */
  const val NO_VALUE = "—"

  /** JS `Math.round`: halves go UP. */
  fun jsRound(v: Double) = floor(v + 0.5)

  fun figureSize(r: Double, kind: Kind): Double {
    val ratio = if (kind == Kind.CALORIE) FIGURE_RATIO_CALORIE else FIGURE_RATIO_MACRO
    return jsRound(ratio * r).coerceIn(FIGURE_MIN, FIGURE_MAX)
  }

  fun unitSize(r: Double) = jsRound(0.18 * r).coerceIn(11.0, 16.0)

  fun metaSize(r: Double) = jsRound(0.25 * r).coerceIn(10.0, 14.0)

  /** Every figure line is set at 1.15, so the stack measures before it paints. */
  fun lineHeight(fontSize: Double) = jsRound(fontSize * 1.15)

  /** The opening between the tip caps, where the unit line sits. */
  fun tipOpening(r: Double) = 1.482 * r

  /**
   * Whether a unit line [width] dp wide fits on the tips, or the dial says the
   * one word instead. Asked of the words it will draw, as on iOS.
   */
  fun fitsUnit(width: Double, r: Double) = width <= 0.9 * tipOpening(r)

  /** One line's font size and its line box. */
  data class Line(val size: Double, val height: Double)

  /** The calorie readout: figure, unit, detail. The detail never outgrows the unit above it. */
  fun calorieLines(r: Double): List<Line> {
    val figure = figureSize(r, Kind.CALORIE)
    val unit = unitSize(r)
    val meta = minOf(unit, metaSize(r))
    return listOf(
      Line(figure, lineHeight(figure)),
      Line(unit, unit + SHORT_LINE_LEADING),
      Line(meta, meta + SHORT_LINE_LEADING),
    )
  }

  /** A macro readout: grams, over the target. */
  fun macroLines(r: Double): List<Line> {
    val figure = figureSize(r, Kind.MACRO)
    val meta = metaSize(r)
    return listOf(Line(figure, lineHeight(figure)), Line(meta, meta + SHORT_LINE_LEADING))
  }

  data class Layout(
    /** How far down the box the arc is painted. */
    val arcTop: Double,
    /** How far down the box the first line starts. */
    val readoutTop: Double,
    /** The height the dial reserves for both. */
    val height: Double,
  )

  /**
   * The SECOND line's middle sits on the arc's tips. A small dial whose lines
   * want to start above its own arc drops the arc instead of clipping.
   */
  fun layout(r: Double, lines: List<Line>): Layout {
    val heights = lines.map { it.height }
    val readout = heights.sum() + LINE_GAP * (heights.size - 1)
    val wanted = r + GaugeGeometry.tipOffset(r) - heights[1] / 2 - LINE_GAP - heights[0]
    val arcTop = if (wanted < 0) -wanted else 0.0
    val readoutTop = wanted + arcTop
    return Layout(arcTop, readoutTop, maxOf(arcTop + GaugeGeometry.height(r), readoutTop + readout))
  }

  /** A macro label's own line box, above its arc. */
  fun labelLineHeight(r: Double) = jsRound(metaSize(r) * 1.3)

  /** The macro glyph beside the label (`macro-dial.tsx`). */
  fun glyphSize(r: Double) = maxOf(12.0, jsRound(r * 0.3))

  /**
   * How far each side of a row drops so the arcs share one centre line. Only
   * one of the two is ever non-zero.
   */
  fun alignCentres(calorie: Double, macro: Double): Pair<Double, Double> {
    val c = layout(calorie, calorieLines(calorie)).arcTop + calorie
    val m = labelLineHeight(macro) + LABEL_GAP + layout(macro, macroLines(macro)).arcTop + macro
    return maxOf(0.0, m - c) to maxOf(0.0, c - m)
  }

  /** The smallest calorie dial drawn; every radius search stops here. */
  const val MIN_CALORIE_RADIUS = 20.0

  /** The calorie dial's whole height at [r]. */
  fun calorieHeight(r: Double) = layout(r, calorieLines(r)).height

  /** The largest whole radius, up to [cap], whose calorie dial fits [room] dp of height. */
  fun calorieRadius(room: Double, cap: Double): Double {
    var r = cap
    while (r > MIN_CALORIE_RADIUS && calorieHeight(r) > room) r -= 1
    return r
  }
}
