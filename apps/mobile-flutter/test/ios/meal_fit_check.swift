// Compiled with ios/TodayWidget/MealFit.swift and run by meal_fit_test.dart.
// Each case prints "ok <name>" or "FAIL <name>: <got> != <want>"; exit 1 on any failure.
import Foundation

@main
enum MealFitCheck {
  static var failed = false

  static func check(_ name: String, _ got: Int, _ want: Int) {
    if got == want { print("ok \(name)") } else { print("FAIL \(name): \(got) != \(want)"); failed = true }
  }

  static func main() {
    // Rows are 18 (one line) or 36 (two lines), 8 apart, as MealRow sets them.
    let six: [Double] = [36, 18, 36, 18, 36, 36]  // oldest first

    // 6 in, room for the last 4 (36+8+18+8+36+8+36 = 150): the 2 oldest drop.
    check("six meals, room for four: shows the newest four", MealFit.firstShown(heights: six, spacing: 8, room: 150), 2)
    // One point short of that, the 4th-newest no longer fits.
    check("one point short drops one more", MealFit.firstShown(heights: six, spacing: 8, room: 149), 3)
    // Everything fits: nothing drops.
    check("all fit: shows all", MealFit.firstShown(heights: six, spacing: 8, room: 1000), 0)
    // Exactly the total fits (no trailing gap is counted).
    let total = six.reduce(0, +) + 8 * 5
    check("exactly the whole day fits", MealFit.firstShown(heights: six, spacing: 8, room: total), 0)
    // Not even the newest fits: none shown, never an older one in its place.
    check("not even the newest fits: none", MealFit.firstShown(heights: six, spacing: 8, room: 30), 6)
    // A short older row is never shown in a gap the newer rows left.
    check("no skipping back to a shorter old row", MealFit.firstShown(heights: [18, 36, 36], spacing: 8, room: 60), 2)
    check("no meals", MealFit.firstShown(heights: [], spacing: 8, room: 100), 0)

    exit(failed ? 1 : 0)
  }
}
