import SwiftUI

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
