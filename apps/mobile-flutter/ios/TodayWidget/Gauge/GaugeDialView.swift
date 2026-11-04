import SwiftUI
import UIKit

/// Be Vietnam Pro, bundled into the extension (the same TTFs the app ships,
/// referenced from `assets/google_fonts/`). Fixed sizes: every line box below
/// is measured from the font size before it is laid out, so the type must not
/// grow underneath the arithmetic.
enum WidgetFont {
  static func regular(_ size: Double) -> Font { .custom("BeVietnamPro-Regular", fixedSize: size) }
  static func medium(_ size: Double) -> Font { .custom("BeVietnamPro-Medium", fixedSize: size) }
  static func semibold(_ size: Double) -> Font { .custom("BeVietnamPro-SemiBold", fixedSize: size) }

  /// How wide `text` sets in the regular weight — the measure the unit line's
  /// fit test needs before anything is laid out.
  static func width(_ text: String, regular size: Double) -> Double {
    let font = UIFont(name: "BeVietnamPro-Regular", size: size) ?? .systemFont(ofSize: size)
    return Double((text as NSString).size(withAttributes: [.font: font]).width)
  }
}

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

/// A dial: the 240° arc with its readout nested in the mouth, the second line
/// sitting on the arc's tips (`GaugeDial` in Dart, `GaugeDial` on the web).
///
/// The READOUT sizes the box and the arc is painted behind it: a line is never
/// narrower for being cramped, only the box can give.
struct GaugeDialView: View {
  struct Line {
    let text: String
    let metrics: GaugeReadout.Line
    let font: Font
    let color: Color
    var tracking: Double = 0
  }

  let radius: Double
  let progress: Double
  let fill: Color
  let track: Color
  let overFill: Color
  let lines: [Line]

  var body: some View {
    let layout = GaugeReadout.layout(radius, lines.map(\.metrics))
    ZStack(alignment: .top) {
      GaugeArc(
        radius: radius, progress: progress, fill: fill, track: track, overFill: overFill
      )
      .padding(.top, layout.arcTop)
      VStack(spacing: GaugeReadout.lineGap) {
        ForEach(lines.indices, id: \.self) { i in
          let line = lines[i]
          ReadoutText(
            text: line.text, font: line.font, color: line.color,
            height: line.metrics.height, tracking: line.tracking)
        }
      }
      .padding(.top, layout.readoutTop)
    }
    .frame(minWidth: radius * 2, minHeight: layout.height, alignment: .top)
  }
}

/// The arc alone: the track, the fill over it, and past target the
/// off-target cap on its tail.
struct GaugeArc: View {
  let radius: Double
  let progress: Double
  let fill: Color
  let track: Color
  let overFill: Color

  var body: some View {
    Canvas { context, _ in
      // The arc's top touches the top of the box — no dead space above it.
      let center = CGPoint(x: radius, y: radius)
      let paths = GaugeGeometry.paths(center: center, outerRadius: radius, progress: progress)
      context.fill(paths.remainder, with: .color(track))
      context.fill(paths.filled, with: .color(fill))
      context.fill(
        GaugeGeometry.overCap(center: center, outerRadius: radius, progress: progress),
        with: .color(overFill))
    }
    .frame(width: radius * 2, height: GaugeGeometry.height(radius))
  }
}
