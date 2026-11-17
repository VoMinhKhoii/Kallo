import SwiftUI

/// One line of a readout: a single line of text centred in its own line box,
/// as CSS sets it — the box is the height the layout measured, and the glyphs
/// sit in its middle whether they are taller or shorter than it.
struct ReadoutText: View {
  let text: String
  let font: Font
  let color: Color
  let height: Double
  var tracking: Double = 0

  var body: some View {
    Text(text)
      .font(font)
      .tracking(tracking)
      .foregroundStyle(color)
      .lineLimit(1)
      .fixedSize()
      .frame(height: height)
  }
}
