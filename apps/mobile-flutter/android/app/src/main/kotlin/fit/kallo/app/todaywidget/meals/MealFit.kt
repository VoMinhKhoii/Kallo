package fit.kallo.app.todaywidget.meals

/**
 * Which meals the large widget shows when the day has more than fit.
 *
 * A widget cannot scroll, so the list reads as if it were scrolled to the
 * bottom (owner ruling, 2026-11-04): the NEWEST meals that fit, in order,
 * newest last, and the oldest dropped. No "+N more" and no count; a tap opens
 * Today, which has the whole day. The same rule as `ios/TodayWidget/Meals/MealFit.swift`.
 */
object MealFit {
  /**
   * The index of the first row to show: rows `first until heights.size` are
   * the longest run ending at the newest row whose heights, with [spacing]
   * between them, fit in [room]. [heights] is oldest first.
   */
  fun firstShown(heights: List<Double>, spacing: Double, room: Double): Int {
    var used = 0.0
    var first = heights.size
    for (i in heights.indices.reversed()) {
      val next = used + heights[i] + if (first == heights.size) 0.0 else spacing
      if (next > room) break
      used = next
      first = i
    }
    return first
  }
}
