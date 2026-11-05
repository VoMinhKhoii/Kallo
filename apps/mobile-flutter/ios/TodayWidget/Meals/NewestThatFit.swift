import SwiftUI

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
