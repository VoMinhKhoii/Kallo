import SwiftUI

/// The calorie dial: what was eaten, "Kcal eaten" on the tips, and what is
/// left (or how far over) under the legs (`calorie-dial.tsx`, `gauge-lines.ts`).
struct CalorieDialView: View {
  let radius: Double
  let day: TodaySnapshot
  let theme: WidgetTheme

  var body: some View {
    let format = WidgetFormat(day.locale)
    let m = GaugeReadout.calorieLines(radius)
    let long = GaugeReadout.fitsUnit(
      width: WidgetFont.width(day.copy.kcalEaten, regular: m[1].size), radius: radius)
    let wording =
      day.signedIn
      ? CalorieWording(
        eaten: day.eaten.kcal, target: day.target.kcal,
        atLeast: day.floors.contains("kcal"), long: long, copy: day.copy, format: format)
      : CalorieWording.signedOut(long: long, copy: day.copy)
    GaugeDialView(
      radius: radius,
      progress: day.target.kcal > 0 ? Double(day.eaten.kcal) / Double(day.target.kcal) : 0,
      fill: theme.accent, track: theme.track, overFill: theme.offTarget,
      lines: [
        .init(text: wording.figure, metrics: m[0], font: WidgetFont.medium(m[0].size),
              color: theme.ink, tracking: -0.02 * m[0].size),
        // Ink, not muted: the word binds UP to the figure it names.
        .init(text: wording.unit, metrics: m[1], font: WidgetFont.regular(m[1].size),
              color: theme.ink),
        // Past target the detail carries the overshoot in the off-target pigment.
        .init(text: wording.detail, metrics: m[2], font: WidgetFont.regular(m[2].size),
              color: wording.isOver ? theme.offTarget : theme.muted),
      ])
  }
}

/// The calorie dial's three lines, worded as the app's `CalorieDial` does for
/// the "eaten" framing: the figure is what was eaten, and the detail under the
/// arc says what is left — or, past target, by how much it went over.
struct CalorieWording: Equatable {
  let figure: String
  let unit: String
  let detail: String
  let isOver: Bool

  /// Signed out: the same dial, empty, with a dash for the figure (the app's
  /// mark for a number it does not have) and "Sign in to track" under it.
  static func signedOut(long: Bool, copy: TodaySnapshot.Copy) -> CalorieWording {
    CalorieWording(
      figure: GaugeReadout.noValue, unit: long ? copy.kcalEaten : copy.eatenShort,
      detail: copy.signedOut, isOver: false)
  }

  private init(figure: String, unit: String, detail: String, isOver: Bool) {
    self.figure = figure
    self.unit = unit
    self.detail = detail
    self.isOver = isOver
  }

  init(eaten: Int, target: Int, atLeast: Bool, long: Bool,
       copy: TodaySnapshot.Copy, format: WidgetFormat) {
    // A floor on what was eaten (or over) is a ceiling on what is left.
    let eatenText = (atLeast ? "≥" : "") + format.count(eaten)
    let targetText = format.count(target)
    let left = target - eaten
    figure = eatenText
    isOver = left < 0
    guard long else {
      // The short dial's detail is the bare fraction for every state.
      unit = copy.eatenShort
      detail = WidgetFormat.fill(copy.fraction, ["logged": eatenText, "target": targetText])
      return
    }
    unit = copy.kcalEaten
    detail =
      left >= 0
      ? WidgetFormat.fill(
        copy.leftOfTarget,
        ["left": (atLeast ? "≤" : "") + format.count(left), "target": targetText])
      : WidgetFormat.fill(
        copy.overTargetBy,
        ["over": (atLeast ? "≥" : "") + format.count(-left), "target": targetText])
  }
}
