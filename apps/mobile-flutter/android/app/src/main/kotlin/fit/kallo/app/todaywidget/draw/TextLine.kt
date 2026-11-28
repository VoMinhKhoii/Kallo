package fit.kallo.app.todaywidget.draw

import android.graphics.Canvas
import android.text.TextPaint
import android.text.TextUtils

// Measuring and setting one line of text on the card. Sizes are dp, as the
// renderer scales its canvas before anything draws.

/** [text], cut with an ellipsis where it would set wider than [maxWidth] dp. */
fun TextPaint.ellipsized(text: String, maxWidth: Double): String =
  if (width(text) <= maxWidth) text
  else TextUtils.ellipsize(text, this, maxWidth.toFloat(), TextUtils.TruncateAt.END).toString()

/** How wide [text] sets in [paint], in dp. */
fun TextPaint.width(text: String): Double = measureText(text).toDouble()

/**
 * One line of text centred in its own line box, as CSS (and the iOS widget's
 * `ReadoutText`) sets it: the glyphs sit in the middle of the box whether they
 * are taller or shorter than it. [x] is the line's left edge.
 */
fun Canvas.drawLine(text: String, paint: TextPaint, x: Double, top: Double, height: Double) {
  val fm = paint.fontMetrics
  val baseline = top + height / 2 - (fm.ascent + fm.descent) / 2
  drawText(text, x.toFloat(), baseline.toFloat(), paint)
}

/** [drawLine], centred on [centreX]. */
fun Canvas.drawLineCentred(text: String, paint: TextPaint, centreX: Double, top: Double, height: Double) =
  drawLine(text, paint, centreX - paint.width(text) / 2, top, height)
