package fit.kallo.app.todaywidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.Drawable
import fit.kallo.app.R
import fit.kallo.app.todaywidget.draw.WidgetType
import fit.kallo.app.todaywidget.draw.drawLine
import fit.kallo.app.todaywidget.draw.drawLineCentred
import fit.kallo.app.todaywidget.gauge.DialRow
import fit.kallo.app.todaywidget.gauge.GaugeReadout
import fit.kallo.app.todaywidget.gauge.Macro
import fit.kallo.app.todaywidget.gauge.calorieDial
import fit.kallo.app.todaywidget.meals.MealList

/** The three looks the iOS widget has, picked here from the size the launcher gives. */
enum class Family { SMALL, MEDIUM, LARGE }

/**
 * Draws the whole card into one bitmap: direction "I · Dial row", the same
 * layout as `ios/TodayWidget/TodayWidgetView.swift`. Every size: a 16 margin,
 * the date top-left in the app's section-header style, 8 below it. Small is
 * the calorie dial alone; medium adds the three macro dials on the same line;
 * large hangs the day's meals 24 under that row.
 *
 * One bitmap rather than RemoteViews text, because the dial is a drawing and
 * the type is Be Vietnam Pro, which a launcher-side TextView cannot set.
 */
class TodayWidgetRenderer(private val context: Context) {
  private val type = WidgetType.of(context)

  fun render(
    snapshot: TodaySnapshot?,
    now: Long,
    widthDp: Double,
    heightDp: Double,
    theme: WidgetTheme,
  ): Bitmap {
    val density = context.resources.displayMetrics.density
    val bitmap = Bitmap.createBitmap(
      maxOf(1, (widthDp * density).toInt()), maxOf(1, (heightDp * density).toInt()),
      Bitmap.Config.ARGB_8888,
    )
    val canvas = Canvas(bitmap)
    canvas.scale(density, density)
    // The card's own corners, so every launcher shows the same rounded card.
    val corner = cornerRadiusDp(density)
    canvas.clipPath(Path().apply {
      addRoundRect(RectF(0f, 0f, widthDp.toFloat(), heightDp.toFloat()), corner, corner, Path.Direction.CW)
    })
    theme.paintBackground(canvas, widthDp.toFloat(), heightDp.toFloat())
    draw(canvas, snapshot?.shownOn(TodaySnapshotStore.dayKey(now)), now, widthDp, heightDp, theme)
    return bitmap
  }

  private fun draw(canvas: Canvas, day: TodaySnapshot?, now: Long, w: Double, h: Double, theme: WidgetTheme) {
    val left = MARGIN
    val inner = w - 2 * MARGIN
    val date = WidgetFormat(day?.locale ?: java.util.Locale.getDefault().language).dateHeader(now)
    canvas.drawLine(date, type.paint(type.semibold, DATE_SIZE, theme.ink, -0.3), left, MARGIN, DATE_LINE_BOX)
    // Signed out draws the same dials, empty and dashed (`CalorieWording`).
    day ?: return
    val top = MARGIN + DATE_LINE_BOX + DATE_GAP
    val family = familyOf(w, h)
    // The large widget draws the medium's row, so it sizes from a medium's height.
    val rowBox = if (family == Family.LARGE) minOf(h, MEDIUM_HEIGHT) else h
    var radius = GaugeReadout.calorieRadius(rowBox - 2 * MARGIN - DATE_LINE_BOX - DATE_GAP, CALORIE_RADIUS_CAP)
    if (family == Family.SMALL) {
      val dial = calorieDial(radius, day, theme, type)
      dial.draw(canvas, left + (inner - dial.width) / 2, top)
      return
    }
    // Launchers vary more in width than iOS does: a row that would overflow
    // gives up calorie radius until it fits.
    var row = dialRow(radius, day, theme, family)
    while (row.minWidth > inner && radius > 20) {
      radius -= 1
      row = dialRow(radius, day, theme, family)
    }
    row.draw(canvas, left, top, inner)
    if (family != Family.LARGE) return
    val mealsTop = top + row.height + MEALS_GAP
    val room = h - MARGIN - mealsTop
    if (day.signedIn) {
      MealList(day.meals, theme, type).draw(canvas, left, mealsTop, inner, room)
    } else {
      // Signed out: "Sign in to track" in the middle of where the meals go.
      val paint = type.paint(type.regular, MealList.SIZE, theme.muted)
      canvas.drawLineCentred(
        day.copy.signedOut, paint, left + inner / 2, mealsTop + (room - MealList.LINE_BOX) / 2, MealList.LINE_BOX,
      )
    }
  }

  private fun dialRow(radius: Double, day: TodaySnapshot, theme: WidgetTheme, family: Family) =
    DialRow(radius, day, theme, type, ::glyph, signInBelow = family != Family.LARGE)

  private fun glyph(macro: Macro): Drawable {
    val id = when (macro) {
      Macro.PROTEIN -> R.drawable.today_widget_protein
      Macro.CARBS -> R.drawable.today_widget_carbs
      Macro.FAT -> R.drawable.today_widget_fat
    }
    return context.getDrawable(id)!!
  }

  /** The system's widget corner on Android 12+, the platform's 16 before it. */
  private fun cornerRadiusDp(density: Float): Float =
    if (android.os.Build.VERSION.SDK_INT >= 31) {
      context.resources.getDimension(android.R.dimen.system_app_widget_background_radius) / density
    } else {
      16f
    }

  companion object {
    const val MARGIN = 16.0
    const val DATE_SIZE = 16.0
    const val DATE_LINE_BOX = 19.0 // 16 × 1.2, as the board rounds it
    const val DATE_GAP = 8.0
    const val MEALS_GAP = 24.0
    const val CALORIE_RADIUS_CAP = 57.0

    /** The iOS medium widget's height on the largest phone: the large's row is sized for it. */
    const val MEDIUM_HEIGHT = 170.0

    /** Under 250dp across holds only the calorie dial; 250dp down adds the meals. */
    fun familyOf(widthDp: Double, heightDp: Double): Family = when {
      widthDp < 250 -> Family.SMALL
      heightDp < 250 -> Family.MEDIUM
      else -> Family.LARGE
    }
  }
}
