import SwiftUI
import UIKit

/// The rounded 240° gauge dial's geometry — pure path maths, no views.
///
/// A line-for-line port of the app's two Dart files, so the widget draws the
/// exact dial the Today screen draws:
///   `lib/shared/widgets/gauge/rounded_sector_path.dart` (one rounded sector)
///   `lib/shared/widgets/gauge/gauge_arc_geometry.dart`  (a dial = two sectors)
/// Same constants, same names, same corner fitting. Change the maths there and
/// change it here; `test/ios/today_widget_test.dart` pins the constants.
///
/// Angles are DEGREES in the maths convention (counter-clockwise positive,
/// y up); `arcPoint` flips y for screen space. The dial sweeps CLOCKWISE from
/// `startAngle` down to `endAngle`.
enum GaugeGeometry {
  /// 210° → −30°: a 240° sweep with the 60° gap centred at the bottom.
  static let startAngle: Double = 210
  static let endAngle: Double = -30

  /// The gap between the filled segment and the remainder.
  static let padAngle: Double = 4

  /// The thinnest sliver a dial draws for a real, non-zero value.
  static let minSweep: Double = 3.5

  static let bandRatio: Double = 0.25
  static let cornerRatio: Double = 4.0 / 9.0

  /// A sweep at or below this holds nothing, and draws nothing.
  private static let degenerateSweep: Double = 0.01
  private static let deg = Double.pi / 180

  /// Where the dial's two tips sit below its centre.
  static func tipOffset(_ outerRadius: Double) -> Double { outerRadius / 2 }

  /// How tall the dial draws: the top half, the drop to the tips, and the
  /// rounded cap that hangs below them (`gaugeHeight` in Dart).
  static func height(_ outerRadius: Double) -> Double {
    outerRadius + tipOffset(outerRadius) + outerRadius / 8
  }

  /// A point at `radius` and `angle` (degrees, y-up) around `center`.
  static func arcPoint(_ center: CGPoint, _ radius: Double, _ angle: Double) -> CGPoint {
    CGPoint(
      x: center.x + radius * cos(angle * deg),
      y: center.y - radius * sin(angle * deg)
    )
  }

  /// The largest corner radius a `sweep`-wide sector can hold without its
  /// corner arcs crossing (`_cornerThatFits` in Dart).
  private static func cornerThatFits(_ inner: Double, _ outer: Double, _ sweep: Double) -> Double {
    let half = (sweep - 0.5) / 2 * deg
    if half <= 0 { return 0 }
    let s = sin(half)
    let outerFit = s * outer / (1 + s)
    let innerFit = s >= 1 ? Double.infinity : s * inner / (1 - s)
    return min(outerFit, innerFit)
  }

  /// One rounded sector, sweeping clockwise from `startAngle` down to
  /// `endAngle`. `cornerRadius` is a maximum: a narrow sweep shrinks it to the
  /// largest corner that fits. Empty only for a sweep with nothing in it.
  static func roundedSector(
    center: CGPoint,
    innerRadius: Double,
    outerRadius: Double,
    startAngle: Double,
    endAngle: Double,
    cornerRadius: Double
  ) -> Path {
    let sweep = startAngle - endAngle
    if sweep <= degenerateSweep { return Path() }

    let c = min(cornerRadius, cornerThatFits(innerRadius, outerRadius, sweep))
    let outerInset = asin(c / (outerRadius - c)) / deg
    let innerInset = asin(c / (innerRadius + c)) / deg
    // Where each corner circle touches the sector's straight radial edge.
    let outerEdge = (outerRadius - c) * cos(outerInset * deg)
    let innerEdge = (innerRadius + c) * cos(innerInset * deg)

    // Dart builds this with `arcToPoint` (endpoint arcs). UIKit takes centred
    // arcs, so each corner names the centre of its own circle: the outer
    // corners sit `R − c` out, the inner ones `r + c`, each on the ray through
    // its tangent point. `clockwise` is visual, as it is in Flutter's y-down
    // space — the same direction SVG's sweep-flag 1 takes on the web.
    let path = UIBezierPath()
    path.move(to: arcPoint(center, outerEdge, startAngle))
    arc(path, around: arcPoint(center, outerRadius - c, startAngle - outerInset), c,
        to: arcPoint(center, outerRadius, startAngle - outerInset), clockwise: true)
    arc(path, around: center, outerRadius,
        to: arcPoint(center, outerRadius, endAngle + outerInset), clockwise: true)
    arc(path, around: arcPoint(center, outerRadius - c, endAngle + outerInset), c,
        to: arcPoint(center, outerEdge, endAngle), clockwise: true)
    path.addLine(to: arcPoint(center, innerEdge, endAngle))
    arc(path, around: arcPoint(center, innerRadius + c, endAngle + innerInset), c,
        to: arcPoint(center, innerRadius, endAngle + innerInset), clockwise: true)
    arc(path, around: center, innerRadius,
        to: arcPoint(center, innerRadius, startAngle - innerInset), clockwise: false)
    arc(path, around: arcPoint(center, innerRadius + c, startAngle - innerInset), c,
        to: arcPoint(center, innerEdge, startAngle), clockwise: true)
    path.close()
    return Path(path.cgPath)
  }

  /// An arc from the path's current point to `end`, on the circle of `radius`
  /// around `centre`.
  private static func arc(
    _ path: UIBezierPath, around centre: CGPoint, _ radius: Double,
    to end: CGPoint, clockwise: Bool
  ) {
    let from = path.currentPoint
    path.addArc(
      withCenter: centre,
      radius: radius,
      startAngle: atan2(from.y - centre.y, from.x - centre.x),
      endAngle: atan2(end.y - centre.y, end.x - centre.x),
      clockwise: clockwise
    )
  }

  /// The two halves of a dial at `progress` (0–1): what has been used, and
  /// what is left. Strictly between 0 and 1 both halves are held to
  /// `minSweep`; only an exact 0 or 1 empties a half.
  static func paths(center: CGPoint, outerRadius: Double, progress: Double)
    -> (filled: Path, remainder: Path)
  {
    let band = outerRadius * bandRatio
    let inner = outerRadius - band
    let corner = band * cornerRatio
    let span = (startAngle - endAngle) - padAngle
    let p = progress.isNaN ? 0 : min(max(progress, 0), 1)
    let minShare = minSweep / span
    let shown = p <= 0 ? 0 : p >= 1 ? 1 : min(max(p, minShare), 1 - minShare)
    let mid = startAngle - span * shown

    func segment(_ from: Double, _ to: Double) -> Path {
      roundedSector(
        center: center, innerRadius: inner, outerRadius: outerRadius,
        startAngle: from, endAngle: to, cornerRadius: corner)
    }
    return (segment(startAngle, mid), segment(mid - padAngle, endAngle))
  }

  /// The over-target cap: the tail of a FULL dial repainted in the off-target
  /// colour, sized to the share eaten past the target, never under 8°
  /// (`gaugeOverCapPath` in Dart). Empty at or under target.
  static func overCap(center: CGPoint, outerRadius: Double, progress: Double) -> Path {
    if !(progress > 1) { return Path() }
    let band = outerRadius * bandRatio
    let span = (startAngle - endAngle) - padAngle
    let overShare = min(max(1 - 1 / progress, 8 / span), 1)
    return roundedSector(
      center: center, innerRadius: outerRadius - band, outerRadius: outerRadius,
      startAngle: startAngle - span * (1 - overShare), endAngle: startAngle - span,
      cornerRadius: band * cornerRatio)
  }
}
