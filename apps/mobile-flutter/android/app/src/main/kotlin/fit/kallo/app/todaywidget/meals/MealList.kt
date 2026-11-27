package fit.kallo.app.todaywidget.meals

import android.graphics.Canvas
import android.text.Layout
import android.text.StaticLayout
import android.text.TextUtils
import fit.kallo.app.todaywidget.TodaySnapshot
import fit.kallo.app.todaywidget.WidgetTheme
import fit.kallo.app.todaywidget.draw.WidgetType
import fit.kallo.app.todaywidget.draw.drawLine
import fit.kallo.app.todaywidget.draw.width
import kotlin.math.ceil

/**
 * The large widget's meals: time, the meal as the user wrote it (two lines at
 * most), and its kcal, newest last (`ios/TodayWidget/Meals/MealList.swift`,
 * `MealRow.swift`). 14 on an 18 line box, as the board sets it.
 */
class MealList(private val meals: List<TodaySnapshot.Meal>, private val theme: WidgetTheme, type: WidgetType) {
  private val muted = type.paint(type.regular, SIZE, theme.muted)
  private val ink = type.paint(type.regular, SIZE, theme.ink)

  /**
   * The time column is as wide as the day's widest 24-hour time ("8:12" or
   * "19:05"), not a fixed width for the worst case.
   */
  private val timeWidth = ceil(meals.maxOfOrNull { muted.width(it.time) } ?: 0.0)

  /** Draws the newest rows that fit in [room] dp under ([left], [top]). */
  fun draw(canvas: Canvas, left: Double, top: Double, width: Double, room: Double) {
    val laid = meals.map { meal ->
      val kcalWidth = ink.width(meal.kcal)
      val textWidth = maxOf(1.0, width - timeWidth - GAP - GAP - kcalWidth)
      val text = StaticLayout.Builder
        .obtain(meal.text, 0, meal.text.length, ink, textWidth.toInt())
        .setMaxLines(2)
        .setEllipsize(TextUtils.TruncateAt.END)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
        .setIncludePad(false)
        .build()
      Row(meal, text, kcalWidth)
    }
    val heights = laid.map { maxOf(1, it.text.lineCount) * LINE_BOX }
    val first = MealFit.firstShown(heights, ROW_GAP, room)
    var y = top
    for (i in first until laid.size) {
      val row = laid[i]
      canvas.drawLine(row.meal.time, muted, left, y, LINE_BOX)
      // Each line of the meal sits in its own 18 box, so the second lands 18 under the first.
      for (line in 0 until row.text.lineCount) {
        val start = row.text.getLineStart(line)
        var end = row.text.getLineEnd(line)
        var words = row.meal.text.substring(start, end).trimEnd()
        val cut = row.text.getEllipsisCount(line)
        if (cut > 0) {
          end = start + row.text.getEllipsisStart(line)
          words = row.meal.text.substring(start, end).trimEnd() + "…"
        }
        canvas.drawLine(words, ink, left + timeWidth + GAP, y + line * LINE_BOX, LINE_BOX)
      }
      canvas.drawLine(row.meal.kcal, ink, left + width - row.kcalWidth, y, LINE_BOX)
      y += heights[i] + ROW_GAP
    }
  }

  private class Row(val meal: TodaySnapshot.Meal, val text: StaticLayout, val kcalWidth: Double)

  companion object {
    const val SIZE = 14.0
    const val LINE_BOX = 18.0
    const val ROW_GAP = 8.0
    private const val GAP = 12.0
  }
}
