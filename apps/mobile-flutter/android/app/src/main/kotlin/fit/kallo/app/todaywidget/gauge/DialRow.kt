package fit.kallo.app.todaywidget.gauge

import android.graphics.Canvas
import android.graphics.drawable.Drawable
import fit.kallo.app.todaywidget.TodaySnapshot
import fit.kallo.app.todaywidget.WidgetTheme
import fit.kallo.app.todaywidget.draw.WidgetType

/**
 * The calorie dial and the three macros on one line, the arcs on one even gap
 * (not the iOS `space-between`, which spread them by label length) and sharing
 * one centre line (`ios/TodayWidget/Gauge/DialRow.swift`,
 * `alignCentres` in gauge-strip-metrics.ts).
 */
class DialRow(
  calorieRadius: Double,
  day: TodaySnapshot,
  theme: WidgetTheme,
  type: WidgetType,
  glyphs: (Macro) -> Drawable,
  signInBelow: Boolean = true,
) {
  private val calorie = calorieDial(calorieRadius, day, theme, type, signInBelow)
  private val macros = Macro.entries.map { MacroDial(it, MACRO_RADIUS, day, theme, type, glyphs(it)) }
  private val shift = GaugeReadout.alignCentres(calorieRadius, MACRO_RADIUS)

  /**
   * Where the calorie arc ends, from the row's left edge. The gaps are measured
   * from here, not from the calorie dial's widest line: that line ("Đăng nhập
   * để theo dõi") sits under the arc's tips, below the macro row, so it may
   * reach into the gap without touching a macro.
   */
  private val calorieArcRight = calorie.width / 2 + calorieRadius

  /** The macro arcs' width (a readout can be wider than its arc). */
  private val arc = macros.maxOf { it.dialWidth }

  /** How far a column's label reaches past its arc on each side. */
  private fun overhang(macro: MacroDial) = maxOf(0.0, (macro.width - arc) / 2)

  /**
   * The least gap between two macro arcs: each pair of labels ("TINH BỘT",
   * "CHẤT BÉO") must keep 8 between them. One gap for all three macros, so
   * they sit on one even pitch whatever their names.
   */
  private val macroGapMin = macros.zipWithNext { l, r -> (l.width + r.width) / 2 + LABEL_GAP_MIN - arc }
    .fold(0.0, ::maxOf)

  /**
   * The least gap from the calorie dial to the first arc: 12 between the two
   * arcs, and the first label clear of the dial by 4.
   */
  private val calorieGapMin = maxOf(CALORIE_ARC_GAP, CALORIE_CLEARANCE + overhang(macros.first()))

  /** The arcs and the gaps between them, past the calorie dial; the last label hangs over. */
  private fun span(calorieGap: Double, macroGap: Double) =
    calorieGap + macros.size * arc + (macros.size - 1) * macroGap + overhang(macros.last())

  /** The narrowest the row can be: every gap at its least. */
  val minWidth: Double = maxOf(calorie.width, calorieArcRight + span(calorieGapMin, macroGapMin))

  val height: Double = maxOf(
    shift.first + calorie.height,
    shift.second + (macros.maxOfOrNull { it.height } ?: 0.0),
  )

  /**
   * One gap between every pair of the four arcs when the card is wide enough.
   * When it is not (long Vietnamese labels), the macros hold their least gap
   * and the gap beside the calorie dial takes the rest, so it narrows smoothly
   * as the card does, and the calorie dial keeps its size.
   */
  fun draw(canvas: Canvas, left: Double, top: Double, width: Double) {
    calorie.draw(canvas, left, top + shift.first)
    val room = width - span(0.0, 0.0) - calorieArcRight
    val even = room / macros.size
    val between = macros.size - 1
    val (calorieGap, macroGap) = when {
      even >= macroGapMin && even >= calorieGapMin -> even to even
      even < macroGapMin -> (room - between * macroGapMin) to macroGapMin
      else -> calorieGapMin to (room - calorieGapMin) / between
    }
    var arcLeft = left + calorieArcRight + calorieGap - macroGap
    for (macro in macros) {
      arcLeft += macroGap
      // Each column is centred on its arc.
      macro.draw(canvas, arcLeft + arc / 2 - macro.width / 2, top + shift.second)
      arcLeft += arc
    }
  }

  companion object {
    /** MACRO_MIN_RADIUS in the web's gauge-strip-layout.ts. */
    const val MACRO_RADIUS = 26.0

    /** The least room between two neighbouring macro labels. */
    private const val LABEL_GAP_MIN = 8.0

    /** The least room between the calorie dial and the first macro label. */
    private const val CALORIE_CLEARANCE = 4.0

    /** The least room between the calorie arc and the first macro arc. */
    private const val CALORIE_ARC_GAP = 12.0
  }
}
