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
