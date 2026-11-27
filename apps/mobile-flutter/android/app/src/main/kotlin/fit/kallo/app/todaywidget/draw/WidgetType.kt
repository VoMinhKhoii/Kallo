package fit.kallo.app.todaywidget.draw

import android.content.Context
import android.graphics.Canvas
import android.graphics.Typeface
import android.text.TextPaint

/**
 * Be Vietnam Pro, read from the TTFs the app already ships
 * (`assets/google_fonts/`, packed into the APK under `flutter_assets/`), so the
 * widget sets the app's type without a second copy of the fonts. Sizes are dp:
 * the renderer scales its canvas by the screen density before anything draws.
 */
class WidgetType private constructor(
  val regular: Typeface,
  val medium: Typeface,
  val semibold: Typeface,
) {
  /** A paint for one line: [tracking] is in dp, as SwiftUI's `.tracking` is in points. */
  fun paint(face: Typeface, size: Double, color: Int, tracking: Double = 0.0) =
    TextPaint(TextPaint.ANTI_ALIAS_FLAG or TextPaint.SUBPIXEL_TEXT_FLAG).apply {
      typeface = face
      textSize = size.toFloat()
      this.color = color
      letterSpacing = if (size > 0) (tracking / size).toFloat() else 0f
    }

  companion object {
    private const val DIR = "flutter_assets/assets/google_fonts"

    @Volatile private var loaded: WidgetType? = null

    fun of(context: Context): WidgetType =
      loaded ?: synchronized(this) {
        loaded ?: run {
          val assets = context.applicationContext.assets
          fun face(weight: String) =
            try {
              Typeface.createFromAsset(assets, "$DIR/BeVietnamPro-$weight.ttf")
            } catch (_: RuntimeException) {
              // A build without the asset still draws, in the system sans.
              Typeface.DEFAULT
            }
          WidgetType(face("Regular"), face("Medium"), face("SemiBold")).also { loaded = it }
        }
      }
  }
}

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
