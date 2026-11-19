import SwiftUI

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
