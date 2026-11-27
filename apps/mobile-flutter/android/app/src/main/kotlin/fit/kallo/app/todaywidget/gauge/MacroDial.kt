package fit.kallo.app.todaywidget.gauge

import android.graphics.Canvas
import android.graphics.drawable.Drawable
import fit.kallo.app.todaywidget.TodaySnapshot
import fit.kallo.app.todaywidget.WidgetTheme
import fit.kallo.app.todaywidget.draw.WidgetType
import fit.kallo.app.todaywidget.draw.drawLine
import fit.kallo.app.todaywidget.draw.width

enum class Macro(val key: String) { PROTEIN("protein"), CARBS("carbs"), FAT("fat") }

/**
 * One macro: its glyph and uppercase name over the same dial, a size down
 * (`ios/TodayWidget/Gauge/MacroDial.swift`). [glyph] is the Lucide icon,
 * tinted here.
 */
class MacroDial(
  macro: Macro,
  private val radius: Double,
  day: TodaySnapshot,
  theme: WidgetTheme,
  type: WidgetType,
  private val glyph: Drawable,
) {
  private val labelHeight = GaugeReadout.labelLineHeight(radius)
  private val glyphSize = GaugeReadout.glyphSize(radius)
  private val label: String
  private val labelPaint = type.paint(type.medium, GaugeReadout.metaSize(radius), theme.muted, 0.3)
  private val dial: GaugeDial

  init {
    val (eaten, target, name, color) = when (macro) {
      Macro.PROTEIN -> Parts(day.eaten.protein, day.target.protein, day.copy.protein, theme.protein)
      Macro.CARBS -> Parts(day.eaten.carbs, day.target.carbs, day.copy.carbs, theme.carbs)
      Macro.FAT -> Parts(day.eaten.fat, day.target.fat, day.copy.fat, theme.fat)
    }
    label = name.uppercase(day.format.locale)
    glyph.mutate().setTint(color)
    val m = GaugeReadout.macroLines(radius)
    val dash = GaugeReadout.NO_VALUE
    dial = GaugeDial(
      radius = radius,
      progress = if (target > 0) eaten.toDouble() / target else 0.0,
      fill = color, track = theme.track, overFill = theme.offTarget,
      lines = listOf(
        DialLine(
          if (day.signedIn) (if (macro.key in day.floors) "≥" else "") + "${eaten}g" else "${dash}g",
          m[0], type.paint(type.medium, m[0].size, theme.ink, -0.02 * m[0].size),
        ),
        DialLine(
          if (day.signedIn) "/${target}g" else "/${dash}g",
          m[1], type.paint(type.regular, m[1].size, theme.muted),
        ),
      ),
    )
  }

  private data class Parts(val eaten: Int, val target: Int, val name: String, val color: Int)

  private val labelRowWidth = glyphSize + 6 + labelPaint.width(label)

  val width: Double = maxOf(labelRowWidth, dial.width)

  /** The dial's own width under the label: its arc, or a wider readout. */
  val dialWidth: Double get() = dial.width
  val height: Double = labelHeight + GaugeReadout.LABEL_GAP + dial.height

  /** Draws the label row and the dial with the box's top-left corner at ([left], [top]). */
  fun draw(canvas: Canvas, left: Double, top: Double) {
    val rowLeft = left + (width - labelRowWidth) / 2
    val glyphTop = top + (labelHeight - glyphSize) / 2
    glyph.setBounds(
      rowLeft.toInt(), glyphTop.toInt(), (rowLeft + glyphSize).toInt(), (glyphTop + glyphSize).toInt(),
    )
    glyph.draw(canvas)
    canvas.drawLine(label, labelPaint, rowLeft + glyphSize + 6, top, labelHeight)
    dial.draw(canvas, left + (width - dial.width) / 2, top + labelHeight + GaugeReadout.LABEL_GAP)
  }
}
