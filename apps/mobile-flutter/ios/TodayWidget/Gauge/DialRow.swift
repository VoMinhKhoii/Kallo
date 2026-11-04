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
    let wording = CalorieWording(
      eaten: day.eaten.kcal, target: day.target.kcal,
      atLeast: day.floors.contains("kcal"),
      long: GaugeReadout.fitsUnit(
        width: WidgetFont.width(day.copy.kcalEaten, regular: m[1].size), radius: radius),
      copy: day.copy, format: format)
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

/// One macro: its glyph and uppercase name over the same dial, a size down.
struct MacroDialView: View {
  enum Macro: String, CaseIterable { case protein, carbs, fat }

  let macro: Macro
  let radius: Double
  let day: TodaySnapshot
  let theme: WidgetTheme

  var body: some View {
    let (eaten, target, label, color) = parts
    let m = GaugeReadout.macroLines(radius)
    let labelSize = GaugeReadout.metaSize(radius)
    let glyph = GaugeReadout.glyphSize(radius)
    VStack(spacing: GaugeReadout.labelGap) {
      HStack(spacing: 6) {
        Image(macro.rawValue)
          .renderingMode(.template)
          .resizable()
          .frame(width: glyph, height: glyph)
          .foregroundStyle(color)
        ReadoutText(
          text: label.uppercased(with: Locale(identifier: day.locale)),
          font: WidgetFont.medium(labelSize), color: theme.muted,
          height: GaugeReadout.labelLineHeight(radius), tracking: 0.3)
      }
      .frame(height: GaugeReadout.labelLineHeight(radius))
      GaugeDialView(
        radius: radius,
        progress: target > 0 ? Double(eaten) / Double(target) : 0,
        fill: color, track: theme.track, overFill: theme.offTarget,
        lines: [
          .init(text: (day.floors.contains(macro.rawValue) ? "≥" : "") + "\(eaten)g",
                metrics: m[0], font: WidgetFont.medium(m[0].size), color: theme.ink,
                tracking: -0.02 * m[0].size),
          .init(text: "/\(target)g", metrics: m[1], font: WidgetFont.regular(m[1].size),
                color: theme.muted),
        ])
    }
  }

  private var parts: (Int, Int, String, Color) {
    switch macro {
    case .protein: (day.eaten.protein, day.target.protein, day.copy.protein, theme.protein)
    case .carbs: (day.eaten.carbs, day.target.carbs, day.copy.carbs, theme.carbs)
    case .fat: (day.eaten.fat, day.target.fat, day.copy.fat, theme.fat)
    }
  }
}

/// The calorie dial and the three macros on one line, `space-between`, the
/// arcs sharing one centre line (`alignCentres` in gauge-strip-metrics.ts).
struct DialRow: View {
  static let macroRadius: Double = 26  // MACRO_MIN_RADIUS

  let calorieRadius: Double
  let day: TodaySnapshot
  let theme: WidgetTheme

  var body: some View {
    let shift = GaugeReadout.alignCentres(calorie: calorieRadius, macro: Self.macroRadius)
    HStack(alignment: .top, spacing: 0) {
      CalorieDialView(radius: calorieRadius, day: day, theme: theme)
        .padding(.top, shift.calorieShift)
      ForEach(MacroDialView.Macro.allCases, id: \.self) { macro in
        Spacer(minLength: 0)
        MacroDialView(macro: macro, radius: Self.macroRadius, day: day, theme: theme)
          .padding(.top, shift.macroShift)
      }
    }
  }
}
