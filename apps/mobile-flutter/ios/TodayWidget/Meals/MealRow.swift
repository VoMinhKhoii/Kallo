import SwiftUI

/// 14 on an 18 line box, as the board sets it. Be Vietnam Pro's own line is
/// 1.265em (ascender 1000, descender 265, no line gap), so the extra spacing
/// below makes the second line land exactly 18 under the first.
struct MealRow: View {
  static let size: Double = 14
  static let lineBox: Double = 18
  static let timeWidth: Double = 64
  private static let fontLine = size * 1.265

  let meal: TodaySnapshot.Meal
  let theme: WidgetTheme

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      line(meal.time, color: theme.muted)
        .frame(width: Self.timeWidth, alignment: .leading)
      Text(meal.text)
        .font(WidgetFont.regular(Self.size))
        .foregroundStyle(theme.ink)
        .lineLimit(2)
        .lineSpacing(Self.lineBox - Self.fontLine)
        .padding(.vertical, (Self.lineBox - Self.fontLine) / 2)
        .frame(maxWidth: .infinity, alignment: .leading)
      line(meal.kcal, color: theme.ink)
    }
  }

  private func line(_ text: String, color: Color) -> some View {
    ReadoutText(text: text, font: WidgetFont.regular(Self.size), color: color, height: Self.lineBox)
  }
}
