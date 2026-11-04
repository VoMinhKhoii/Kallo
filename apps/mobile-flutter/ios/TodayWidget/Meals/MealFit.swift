import Foundation

/// Which meals the large widget shows when the day has more than fit.
///
/// WidgetKit cannot scroll, so the list reads as if it were scrolled to the
/// bottom (owner ruling, 2026-11-04): the NEWEST meals that fit, in order,
/// newest last, and the oldest dropped. No "+N more" and no count; a tap opens
/// Today, which has the whole day.
///
/// Pure arithmetic over row heights, so it can be tested without SwiftUI:
/// `test/ios/meal_fit_test.dart` compiles this file with a check program.
enum MealFit {
  /// The index of the first row to show: rows `[first..<heights.count]` are
  /// the longest run ending at the newest row whose heights, with `spacing`
  /// between them, fit in `room`. `heights` is oldest first.
  static func firstShown(heights: [Double], spacing: Double, room: Double) -> Int {
    var used = 0.0
    var first = heights.count
    for (i, height) in heights.enumerated().reversed() {
      let next = used + height + (first == heights.count ? 0 : spacing)
      if next > room { break }
      used = next
      first = i
    }
    return first
  }
}
