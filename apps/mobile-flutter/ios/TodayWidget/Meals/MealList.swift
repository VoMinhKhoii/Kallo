import SwiftUI

/// The large widget's meals: time, the meal as the user wrote it (two lines at
/// most), and its kcal — all one colour family, newest last.
struct MealList: View {
  static let rowGap: Double = 8

  let meals: [TodaySnapshot.Meal]
  let theme: WidgetTheme

  var body: some View {
    // The time column is as wide as the day's widest 24-hour time ("8:12"
    // alone takes 28pt, "19:05" 38pt), not a fixed width for the worst case.
    let timeWidth = (meals.map { WidgetFont.width($0.time, regular: MealRow.size) }.max() ?? 0)
      .rounded(.up)
    NewestThatFit(spacing: Self.rowGap) {
      ForEach(meals.indices, id: \.self) { i in
        MealRow(meal: meals[i], timeWidth: timeWidth, theme: theme)
      }
    }
  }
}
