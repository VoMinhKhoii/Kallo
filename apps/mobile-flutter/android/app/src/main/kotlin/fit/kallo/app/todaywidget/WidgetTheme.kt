package fit.kallo.app.todaywidget

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import java.util.Calendar

/**
 * The widget's two looks, picked by the hour rather than by the app's
 * Appearance setting: a white card through the day, Aurora after dark.
 *
 * Every value is the app's own, from `lib/theme/palette/kallo_palette_values.dart`
 * (`_light` and `_aurora`), the same as `ios/TodayWidget/WidgetTheme.swift`;
 * `test/android/today_widget_test.dart` holds the files to each other.
 */
class WidgetTheme(
  val card: Int,
  val ink: Int,
  val muted: Int,
  val track: Int,
  val accent: Int,
  val offTarget: Int,
  val protein: Int,
  val carbs: Int,
  val fat: Int,
  /** Aurora's two corner lights (apricot, lilac); null on the light card. */
  val glows: Pair<Int, Int>?,
) {
  companion object {
    val light = WidgetTheme(
      card = rgb(0xFFFFFF), // elev
      ink = rgb(0x141413), // text
      muted = rgb(0x7A7870), // textMuted
      track = rgb(0xEDECE7), // track
      accent = rgb(0xC9A87C), // accent
      offTarget = rgb(0xD37B69), // offTarget
      protein = rgb(0xD46A86), // macroProtein
      carbs = rgb(0xE09C84), // macroCarbs
      fat = rgb(0xE8C55C), // macroFat
      glows = null,
    )

    val aurora = WidgetTheme(
      card = rgb(0x131114), // surface
      ink = rgb(0xF4F0EC), // text
      muted = rgb(0x9C959C), // textMuted
      track = rgb(0x2C282D), // track
      accent = rgb(0xC9A87C), // accent
      offTarget = rgb(0xE08878), // offTarget
      protein = rgb(0xE07C96), // macroProtein
      carbs = rgb(0xE7A68D), // macroCarbs
      fat = rgb(0xEACB66), // macroFat
      // brandApricot / brandLilac at the approved board's 22% and 20%.
      glows = alpha(rgb(0xFFD2B0), 0.22) to alpha(rgb(0xDCC4FF), 0.20),
    )

    /** The light card runs from LIGHT_FROM to LIGHT_UNTIL (local hours). */
    const val LIGHT_FROM = 6
    const val LIGHT_UNTIL = 18

    fun at(millis: Long): WidgetTheme {
      val hour = Calendar.getInstance().apply { timeInMillis = millis }.get(Calendar.HOUR_OF_DAY)
      return if (hour in LIGHT_FROM until LIGHT_UNTIL) light else aurora
    }

    private fun rgb(hex: Int): Int = Color.rgb((hex shr 16) and 0xFF, (hex shr 8) and 0xFF, hex and 0xFF)

    private fun alpha(color: Int, opacity: Double): Int =
      Color.argb((opacity * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
  }

  /**
   * The card behind every size: the flat colour, and in Aurora the two lights
   * in its top corners, each an ellipse 80% of the card across and 60% down,
   * gone by 70% of its radius (the board's `radial-gradient(80% 60% at …)`).
   */
  fun paintBackground(canvas: Canvas, width: Float, height: Float) {
    canvas.drawColor(card)
    val (apricot, lilac) = glows ?: return
    glow(canvas, apricot, 0f, width, height)
    glow(canvas, lilac, width, width, height)
  }

  private fun glow(canvas: Canvas, color: Int, x: Float, width: Float, height: Float) {
    val rx = width * 0.8f
    val ry = height * 0.6f
    val clear = Color.argb(0, Color.red(color), Color.green(color), Color.blue(color))
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = RadialGradient(
        0f, 0f, ry, intArrayOf(color, clear), floatArrayOf(0f, 0.7f), Shader.TileMode.CLAMP,
      )
    }
    // A circle of `ry`, stretched sideways into the ellipse.
    canvas.save()
    canvas.translate(x, 0f)
    canvas.scale(rx / ry, 1f)
    canvas.drawCircle(0f, 0f, ry, paint)
    canvas.restore()
  }
}
