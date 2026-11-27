package fit.kallo.app.todaywidget.gauge

import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * The rounded 240° gauge dial's geometry: pure path maths, no views.
 *
 * A line-for-line port of the app's two Dart files, as the iOS widget's
 * `Gauge/GaugeGeometry.swift` is:
 *   `lib/shared/widgets/gauge/rounded_sector_path.dart` (one rounded sector)
 *   `lib/shared/widgets/gauge/gauge_arc_geometry.dart`  (a dial = two sectors)
 * Same constants, same names, same corner fitting; `test/android/today_widget_test.dart`
 * pins the constants.
 *
 * Angles are DEGREES in the maths convention (counter-clockwise positive, y up);
 * [arcPoint] flips y for screen space. The dial sweeps CLOCKWISE from
 * [START_ANGLE] down to [END_ANGLE].
 */
object GaugeGeometry {
  /** 210° → −30°: a 240° sweep with the 60° gap centred at the bottom. */
  const val START_ANGLE = 210.0
  const val END_ANGLE = -30.0

  /** The gap between the filled segment and the remainder. */
  const val PAD_ANGLE = 4.0

  /** The thinnest sliver a dial draws for a real, non-zero value. */
  const val MIN_SWEEP = 3.5

  const val BAND_RATIO = 0.25
  const val CORNER_RATIO = 4.0 / 9.0

  /** A sweep at or below this holds nothing, and draws nothing. */
  private const val DEGENERATE_SWEEP = 0.01
  private const val DEG = Math.PI / 180

  /** Where the dial's two tips sit below its centre. */
  fun tipOffset(outerRadius: Double) = outerRadius / 2

  /** How tall the dial draws: the top half, the drop to the tips, and the cap below them. */
  fun height(outerRadius: Double) = outerRadius + tipOffset(outerRadius) + outerRadius / 8

  /** A point at [radius] and [angle] (degrees, y-up) around [center]. */
  fun arcPoint(center: PointF, radius: Double, angle: Double) = PointF(
    (center.x + radius * cos(angle * DEG)).toFloat(),
    (center.y - radius * sin(angle * DEG)).toFloat(),
  )

  /** The largest corner radius a [sweep]-wide sector can hold without its corner arcs crossing. */
  private fun cornerThatFits(inner: Double, outer: Double, sweep: Double): Double {
    val half = (sweep - 0.5) / 2 * DEG
    if (half <= 0) return 0.0
    val s = sin(half)
    val outerFit = s * outer / (1 + s)
    val innerFit = if (s >= 1) Double.POSITIVE_INFINITY else s * inner / (1 - s)
    return min(outerFit, innerFit)
  }

  /**
   * One rounded sector, sweeping clockwise from [startAngle] down to [endAngle].
   * [cornerRadius] is a maximum: a narrow sweep shrinks it to the largest
   * corner that fits. Empty only for a sweep with nothing in it.
   */
  fun roundedSector(
    center: PointF,
    innerRadius: Double,
    outerRadius: Double,
    startAngle: Double,
    endAngle: Double,
    cornerRadius: Double,
  ): Path {
    val path = Path()
    val sweep = startAngle - endAngle
    if (sweep <= DEGENERATE_SWEEP) return path

    val c = min(cornerRadius, cornerThatFits(innerRadius, outerRadius, sweep))
    val outerInset = asin(c / (outerRadius - c)) / DEG
    val innerInset = asin(c / (innerRadius + c)) / DEG
    // Where each corner circle touches the sector's straight radial edge.
    val outerEdge = (outerRadius - c) * cos(outerInset * DEG)
    val innerEdge = (innerRadius + c) * cos(innerInset * DEG)

    // Each corner names the centre of its own circle, as the Swift port does:
    // the outer corners sit `R − c` out, the inner ones `r + c`, each on the
    // ray through its tangent point. `clockwise` is visual, in y-down space.
    val start = arcPoint(center, outerEdge, startAngle)
    path.moveTo(start.x, start.y)
    val pen = Pen(path, start)
    pen.arc(arcPoint(center, outerRadius - c, startAngle - outerInset), c,
      arcPoint(center, outerRadius, startAngle - outerInset), clockwise = true)
    pen.arc(center, outerRadius,
      arcPoint(center, outerRadius, endAngle + outerInset), clockwise = true)
    pen.arc(arcPoint(center, outerRadius - c, endAngle + outerInset), c,
      arcPoint(center, outerEdge, endAngle), clockwise = true)
    pen.line(arcPoint(center, innerEdge, endAngle))
    pen.arc(arcPoint(center, innerRadius + c, endAngle + innerInset), c,
      arcPoint(center, innerRadius, endAngle + innerInset), clockwise = true)
    pen.arc(center, innerRadius,
      arcPoint(center, innerRadius, startAngle - innerInset), clockwise = false)
    pen.arc(arcPoint(center, innerRadius + c, startAngle - innerInset), c,
      arcPoint(center, innerEdge, startAngle), clockwise = true)
    path.close()
    return path
  }

  /** Tracks the current point, which `android.graphics.Path` does not expose. */
  private class Pen(val path: Path, var at: PointF) {
    fun line(to: PointF) {
      path.lineTo(to.x, to.y)
      at = to
    }

    /** An arc from the current point to [end], on the circle of [radius] around [centre]. */
    fun arc(centre: PointF, radius: Double, end: PointF, clockwise: Boolean) {
      val from = Math.toDegrees(atan2((at.y - centre.y).toDouble(), (at.x - centre.x).toDouble()))
      val to = Math.toDegrees(atan2((end.y - centre.y).toDouble(), (end.x - centre.x).toDouble()))
      // In y-down screen space a positive sweep is visually clockwise.
      var sweep = to - from
      if (clockwise) { while (sweep < 0) sweep += 360.0 } else { while (sweep > 0) sweep -= 360.0 }
      // A float-noise "almost back to the start" is no arc, not a full turn.
      if (kotlin.math.abs(sweep) > 359.9) sweep = 0.0
      val r = radius.toFloat()
      val oval = RectF(centre.x - r, centre.y - r, centre.x + r, centre.y + r)
      path.arcTo(oval, from.toFloat(), sweep.toFloat(), false)
      at = end
    }
  }

  /**
   * The two halves of a dial at [progress] (0–1): what has been used, and what
   * is left. Strictly between 0 and 1 both halves are held to [MIN_SWEEP];
   * only an exact 0 or 1 empties a half.
   */
  fun paths(center: PointF, outerRadius: Double, progress: Double): Pair<Path, Path> {
    val band = outerRadius * BAND_RATIO
    val inner = outerRadius - band
    val corner = band * CORNER_RATIO
    val span = (START_ANGLE - END_ANGLE) - PAD_ANGLE
    val p = if (progress.isNaN()) 0.0 else progress.coerceIn(0.0, 1.0)
    val minShare = MIN_SWEEP / span
    val shown = if (p <= 0) 0.0 else if (p >= 1) 1.0 else p.coerceIn(minShare, 1 - minShare)
    val mid = START_ANGLE - span * shown

    fun segment(from: Double, to: Double) = roundedSector(center, inner, outerRadius, from, to, corner)
    return segment(START_ANGLE, mid) to segment(mid - PAD_ANGLE, END_ANGLE)
  }

  /**
   * The over-target cap: the tail of a FULL dial repainted in the off-target
   * colour, sized to the share eaten past the target, never under 8°
   * (`gaugeOverCapPath` in Dart). Empty at or under target.
   */
  fun overCap(center: PointF, outerRadius: Double, progress: Double): Path {
    if (!(progress > 1)) return Path()
    val band = outerRadius * BAND_RATIO
    val span = (START_ANGLE - END_ANGLE) - PAD_ANGLE
    val overShare = min(maxOf(1 - 1 / progress, 8 / span), 1.0)
    return roundedSector(
      center, outerRadius - band, outerRadius,
      START_ANGLE - span * (1 - overShare), START_ANGLE - span, band * CORNER_RATIO,
    )
  }
}
