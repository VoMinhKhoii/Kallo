package fit.kallo.app.todaywidget.gauge

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PointF
import android.text.TextPaint
import fit.kallo.app.todaywidget.draw.drawLineCentred
import fit.kallo.app.todaywidget.draw.ellipsized
import fit.kallo.app.todaywidget.draw.width

/** One readout line: its words, its size and line box, and the paint it sets in. */
class DialLine(val text: String, val metrics: GaugeReadout.Line, val paint: TextPaint) {
  /** [text], cut with an ellipsis to fit [maxWidth] dp. */
  fun fitted(maxWidth: Double): DialLine =
    if (paint.width(text) <= maxWidth) this else DialLine(paint.ellipsized(text, maxWidth), metrics, paint)
}

/**
 * A dial: the 240° arc with its readout nested in the mouth, the second line
 * sitting on the arc's tips (`GaugeDialView` on iOS, `GaugeDial` in Dart and
 * on the web).
 *
 * The READOUT sizes the box and the arc is painted behind it: a line is never
 * narrower for being cramped, only the box can give, until the box reaches
 * the card's width ([maxLineWidth]); then the line is ellipsized.
 */
class GaugeDial(
  private val radius: Double,
  private val progress: Double,
  private val fill: Int,
  private val track: Int,
  private val overFill: Int,
  lines: List<DialLine>,
  /** No line is drawn wider than this; a wider one is ellipsized. */
  maxLineWidth: Double = Double.MAX_VALUE,
) {
  // Named apart from the parameter: in initializers a bare `lines` is the
  // parameter, which would measure the uncut text.
  private val fitted = lines.map { it.fitted(maxLineWidth) }

  private val layout = GaugeReadout.layout(radius, fitted.map { it.metrics })

  /** The arc's width, or the widest line's when a line is wider. */
  val width: Double = maxOf(radius * 2, fitted.maxOf { it.paint.width(it.text) })
  val height: Double = layout.height

  /** Draws the dial with its box's top-left corner at ([left], [top]). */
  fun draw(canvas: Canvas, left: Double, top: Double) {
    val centreX = left + width / 2
    val centre = PointF(centreX.toFloat(), (top + layout.arcTop + radius).toFloat())
    val (filled, remainder) = GaugeGeometry.paths(centre, radius, progress)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    canvas.drawPath(remainder, paint.apply { color = track })
    canvas.drawPath(filled, paint.apply { color = fill })
    canvas.drawPath(GaugeGeometry.overCap(centre, radius, progress), paint.apply { color = overFill })

    var y = top + layout.readoutTop
    for (line in fitted) {
      canvas.drawLineCentred(line.text, line.paint, centreX, y, line.metrics.height)
      y += line.metrics.height + GaugeReadout.LINE_GAP
    }
  }
}
