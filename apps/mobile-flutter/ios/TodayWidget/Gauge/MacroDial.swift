import SwiftUI

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
          .init(text: day.signedIn
                  ? (day.floors.contains(macro.rawValue) ? "≥" : "") + "\(eaten)g"
                  : GaugeReadout.noValue,
                metrics: m[0], font: WidgetFont.medium(m[0].size), color: theme.ink,
                tracking: -0.02 * m[0].size),
          .init(text: day.signedIn ? "/\(target)g" : "", metrics: m[1], font: WidgetFont.regular(m[1].size),
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
