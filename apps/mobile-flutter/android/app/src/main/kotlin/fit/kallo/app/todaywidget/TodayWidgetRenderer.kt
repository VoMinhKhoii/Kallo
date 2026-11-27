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
import fit.kallo.app.todaywidget.draw.ellipsized
import fit.kallo.app.todaywidget.gauge.DialRow
import fit.kallo.app.todaywidget.gauge.GaugeReadout
import fit.kallo.app.todaywidget.gauge.Macro
import fit.kallo.app.todaywidget.gauge.calorieDial
import fit.kallo.app.todaywidget.meals.MealList
import kotlin.math.floor

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

  /**
   * The card at [widthDp] × [heightDp], drawn at [scale] pixels per dp: the
   * screen density, or less when the provider must keep its bitmaps inside
   * the launcher's memory budget.
   */
  fun render(
    snapshot: TodaySnapshot?,
    now: Long,
    widthDp: Double,
    heightDp: Double,
    theme: WidgetTheme,
    scale: Float,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(
      maxOf(1, (widthDp * scale).toInt()), maxOf(1, (heightDp * scale).toInt()),
      Bitmap.Config.ARGB_8888,
    )
    val canvas = Canvas(bitmap)
    canvas.scale(scale, scale)
    // The card's own corners, so every launcher shows the same rounded card.
    val corner = cornerRadiusDp()
    canvas.clipPath(Path().apply {
      addRoundRect(RectF(0f, 0f, widthDp.toFloat(), heightDp.toFloat()), corner, corner, Path.Direction.CW)
    })
    theme.paintBackground(canvas, widthDp.toFloat(), heightDp.toFloat())
    draw(canvas, snapshot?.shownOn(TodaySnapshotStore.dayKey(now)), now, widthDp, heightDp, theme)
    return bitmap
  }

  /**
   * A card shorter than the smallest legible layout (the date over a radius-20
   * dial; a 2-row widget in landscape on a short screen) is laid out at that
   * height and drawn whole at a smaller scale, never clipped.
   */
  private fun draw(canvas: Canvas, day: TodaySnapshot?, now: Long, w: Double, h: Double, theme: WidgetTheme) {
    val shortest = CONTENT_TOP + GaugeReadout.calorieHeight(MIN_RADIUS) + MARGIN
    if (h >= shortest) return drawContent(canvas, day, now, w, h, theme)
    val k = h / shortest
    canvas.save()
    canvas.scale(k.toFloat(), k.toFloat())
    drawContent(canvas, day, now, w / k, shortest, theme)
    canvas.restore()
  }

  private fun drawContent(canvas: Canvas, day: TodaySnapshot?, now: Long, w: Double, h: Double, theme: WidgetTheme) {
    val left = MARGIN
    val inner = w - 2 * MARGIN
    val date = WidgetFormat(day?.locale ?: java.util.Locale.getDefault().language).dateHeader(now)
    val datePaint = type.paint(type.semibold, DATE_SIZE, theme.ink, -0.3)
    // Every free-standing line is held to the card's width ("Th 5, thg 12 28"
    // is 112dp; a 2-cell card can be 78dp inside its margins).
    canvas.drawLine(datePaint.ellipsized(date, inner), datePaint, left, MARGIN, DATE_LINE_BOX)
    // Signed out draws the same dials, empty and dashed (`CalorieWording`).
    day ?: return
    val top = CONTENT_TOP
    val family = familyOf(w, h)
    // The large widget draws the medium's row, so it sizes from a medium's height.
    val rowBox = if (family == Family.LARGE) minOf(h, MEDIUM_HEIGHT) else h
    val fullRadius =
      GaugeReadout.calorieRadius(rowBox - 2 * MARGIN - DATE_LINE_BOX - DATE_GAP, CALORIE_RADIUS_CAP)
    // Launchers vary far more than iPhones do (2 to 5 cells across, rows of
    // any height, landscape), so the layout is searched, not assumed: the
    // largest calorie radius whose drawing fits the box across AND down.
    val radii = generateSequence(fullRadius) { it - 1 }.takeWhile { it >= MIN_RADIUS }
    val signInBelow = family != Family.LARGE
    if (family != Family.SMALL) {
      val row = radii.map { dialRow(it, day, theme, signInBelow) }
        .firstOrNull { it.minWidth <= inner && top + it.height <= rowBox - MARGIN }
      if (row != null) {
        row.draw(canvas, left, top, inner)
        if (family == Family.LARGE) drawMeals(canvas, day, theme, top + row.height + MEALS_GAP, inner, h)
        return
      }
      // No radius fits four dials (a 3-cell widget in Vietnamese, a short
      // landscape row): the calorie dial alone, as the small card draws it.
    }
    // A line no radius can narrow enough (a long signed-out sentence on a
    // 2-cell card) keeps the arc as large as fits and is ellipsized.
    val dial = radii.map { calorieDial(it, day, theme, type, signInBelow) }.firstOrNull { it.width <= inner }
      ?: calorieDial(minOf(fullRadius, maxOf(MIN_RADIUS, floor(inner / 2))), day, theme, type, signInBelow, inner)
    dial.draw(canvas, left + (inner - dial.width) / 2, top)
    if (family == Family.LARGE) drawMeals(canvas, day, theme, top + dial.height + MEALS_GAP, inner, h)
  }

  /** The large card's meals under the dials, or "Sign in to track" where they would go. */
  private fun drawMeals(canvas: Canvas, day: TodaySnapshot, theme: WidgetTheme, mealsTop: Double, inner: Double, h: Double) {
    val left = MARGIN
    val room = h - MARGIN - mealsTop
    if (day.signedIn) {
      MealList(day.meals, theme, type).draw(canvas, left, mealsTop, inner, room)
    } else {
      // Signed out: "Sign in to track" in the middle of where the meals go.
      val paint = type.paint(type.regular, MealList.SIZE, theme.muted)
      canvas.drawLineCentred(
        paint.ellipsized(day.copy.signedOut, inner), paint, left + inner / 2, mealsTop + (room - MealList.LINE_BOX) / 2, MealList.LINE_BOX,
      )
    }
  }

  private fun dialRow(radius: Double, day: TodaySnapshot, theme: WidgetTheme, signInBelow: Boolean) =
    DialRow(radius, day, theme, type, ::glyph, signInBelow)

  private fun glyph(macro: Macro): Drawable {
    val id = when (macro) {
      Macro.PROTEIN -> R.drawable.today_widget_protein
      Macro.CARBS -> R.drawable.today_widget_carbs
      Macro.FAT -> R.drawable.today_widget_fat
    }
    return context.getDrawable(id)!!
  }

  /** The system's widget corner on Android 12+, the platform's 16 before it. */
  private fun cornerRadiusDp(): Float =
    if (android.os.Build.VERSION.SDK_INT >= 31) {
      context.resources.getDimension(android.R.dimen.system_app_widget_background_radius) /
        context.resources.displayMetrics.density
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

    /** Where the dials start: under the date header and its gap. */
    private const val CONTENT_TOP = MARGIN + DATE_LINE_BOX + DATE_GAP

    /** The smallest calorie dial, the same floor `GaugeReadout.calorieRadius` stops at. */
    private const val MIN_RADIUS = 20.0

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
