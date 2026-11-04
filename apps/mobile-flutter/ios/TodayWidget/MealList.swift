import SwiftUI

/// The large widget's meals: time, the meal as the user wrote it (two lines at
/// most), and its kcal — all one colour family, newest last.
struct MealList: View {
  static let rowGap: Double = 8

  let meals: [TodaySnapshot.Meal]
  let theme: WidgetTheme

  var body: some View {
    NewestThatFit(spacing: Self.rowGap) {
      ForEach(meals.indices, id: \.self) { i in
        MealRow(meal: meals[i], theme: theme)
      }
    }
  }
}

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

/// A column that keeps the newest rows that fit its height and drops the
/// earliest (`MealFit` decides which). Dropped rows are placed off the card
/// (the view clips): WidgetKit has no way to remove a view after measuring it.
struct NewestThatFit: Layout {
  let spacing: Double

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 0
    let heights = measure(subviews, width: width)
    let first = MealFit.firstShown(
      heights: heights, spacing: spacing, room: proposal.height ?? .infinity)
    let kept = heights[first...]
    let height = kept.reduce(0, +) + spacing * Double(max(kept.count - 1, 0))
    return CGSize(width: width, height: height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let heights = measure(subviews, width: bounds.width)
    let first = MealFit.firstShown(heights: heights, spacing: spacing, room: bounds.height)
    let size = ProposedViewSize(width: bounds.width, height: nil)
    var y = bounds.minY
    for (i, subview) in subviews.enumerated() {
      guard i >= first else {
        subview.place(at: CGPoint(x: bounds.minX, y: bounds.maxY + 1000), proposal: size)
        continue
      }
      subview.place(at: CGPoint(x: bounds.minX, y: y), proposal: size)
      y += heights[i] + spacing
    }
  }

  /// Each row's height at `width`, oldest first.
  private func measure(_ subviews: Subviews, width: Double) -> [Double] {
    subviews.map { Double($0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height) }
  }
}
