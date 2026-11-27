package fit.kallo.app.todaywidget.gauge

import android.graphics.Canvas
import android.graphics.drawable.Drawable
import fit.kallo.app.todaywidget.TodaySnapshot
import fit.kallo.app.todaywidget.WidgetTheme
import fit.kallo.app.todaywidget.draw.WidgetType

/**
 * The calorie dial and the three macros on one line, `space-between`, the arcs
 * sharing one centre line (`ios/TodayWidget/Gauge/DialRow.swift`,
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

  /** The narrowest the row can be: every dial, no space between. */
  val minWidth: Double = calorie.width + macros.sumOf { it.width }

  val height: Double = maxOf(
    shift.first + calorie.height,
    shift.second + (macros.maxOfOrNull { it.height } ?: 0.0),
  )

  fun draw(canvas: Canvas, left: Double, top: Double, width: Double) {
    calorie.draw(canvas, left, top + shift.first)
    val gap = maxOf(0.0, (width - minWidth) / macros.size)
    var x = left + calorie.width
    for (macro in macros) {
      x += gap
      macro.draw(canvas, x, top + shift.second)
      x += macro.width
    }
  }

  companion object {
    /** MACRO_MIN_RADIUS in the web's gauge-strip-layout.ts. */
    const val MACRO_RADIUS = 26.0
  }
}
