package fit.kallo.app.todaywidget.gauge

import fit.kallo.app.todaywidget.TodaySnapshot
import fit.kallo.app.todaywidget.WidgetFormat
import fit.kallo.app.todaywidget.WidgetTheme
import fit.kallo.app.todaywidget.draw.WidgetType
import fit.kallo.app.todaywidget.draw.width

/**
 * The calorie dial: what was eaten, "Kcal eaten" on the tips, and what is left
 * (or how far over) under the legs (`ios/TodayWidget/Gauge/CalorieDial.swift`).
 *
 * [signInBelow]: signed out, "Sign in to track" goes under the dial. False on
 * the large widget, which says it in its empty meal area instead.
 */
fun calorieDial(
  radius: Double,
  day: TodaySnapshot,
  theme: WidgetTheme,
  type: WidgetType,
  signInBelow: Boolean = true,
): GaugeDial {
  val m = GaugeReadout.calorieLines(radius)
  val unitPaint = type.paint(type.regular, m[1].size, theme.ink)
  val long = GaugeReadout.fitsUnit(unitPaint.width(day.copy.kcalEaten), radius)
  val wording =
    if (day.signedIn) {
      CalorieWording.of(
        eaten = day.eaten.kcal, target = day.target.kcal, atLeast = "kcal" in day.floors,
        long = long, copy = day.copy, format = WidgetFormat(day.locale),
      )
    } else {
      CalorieWording.signedOut(long, signInBelow, day.copy)
    }
  return GaugeDial(
    radius = radius,
    progress = if (day.target.kcal > 0) day.eaten.kcal.toDouble() / day.target.kcal else 0.0,
    fill = theme.accent, track = theme.track, overFill = theme.offTarget,
    lines = listOf(
      DialLine(wording.figure, m[0], type.paint(type.medium, m[0].size, theme.ink, -0.02 * m[0].size)),
      // Ink, not muted: the word binds UP to the figure it names.
      DialLine(wording.unit, m[1], unitPaint),
      // Past target the detail carries the overshoot in the off-target pigment.
      DialLine(
        wording.detail, m[2],
        type.paint(type.regular, m[2].size, if (wording.isOver) theme.offTarget else theme.muted),
      ),
    ),
  )
}

/**
 * The calorie dial's three lines, worded as the app's `CalorieDial` does for
 * the "eaten" framing: the figure is what was eaten, and the detail under the
 * arc says what is left, or, past target, by how much it went over.
 */
data class CalorieWording(val figure: String, val unit: String, val detail: String, val isOver: Boolean) {
  companion object {
    /**
     * Signed out: the same dial, empty, with a dash for every number. The
     * detail is either "Sign in to track" or the usual wording, dashed.
     */
    fun signedOut(long: Boolean, signInBelow: Boolean, copy: TodaySnapshot.Copy): CalorieWording {
      val dash = GaugeReadout.NO_VALUE
      val detail = when {
        signInBelow -> copy.signedOut
        long -> WidgetFormat.fill(copy.leftOfTarget, mapOf("left" to dash, "target" to dash))
        else -> WidgetFormat.fill(copy.fraction, mapOf("logged" to dash, "target" to dash))
      }
      return CalorieWording(dash, if (long) copy.kcalEaten else copy.eatenShort, detail, false)
    }

    fun of(
      eaten: Int,
      target: Int,
      atLeast: Boolean,
      long: Boolean,
      copy: TodaySnapshot.Copy,
      format: WidgetFormat,
    ): CalorieWording {
      // A floor on what was eaten (or over) is a ceiling on what is left.
      val eatenText = (if (atLeast) "≥" else "") + format.count(eaten)
      val targetText = format.count(target)
      val left = target - eaten
      if (!long) {
        // The short dial's detail is the bare fraction for every state.
        val detail = WidgetFormat.fill(copy.fraction, mapOf("logged" to eatenText, "target" to targetText))
        return CalorieWording(eatenText, copy.eatenShort, detail, left < 0)
      }
      val detail =
        if (left >= 0) {
          WidgetFormat.fill(
            copy.leftOfTarget,
            mapOf("left" to (if (atLeast) "≤" else "") + format.count(left), "target" to targetText),
          )
        } else {
          WidgetFormat.fill(
            copy.overTargetBy,
            mapOf("over" to (if (atLeast) "≥" else "") + format.count(-left), "target" to targetText),
          )
        }
      return CalorieWording(eatenText, copy.kcalEaten, detail, left < 0)
    }
  }
}
