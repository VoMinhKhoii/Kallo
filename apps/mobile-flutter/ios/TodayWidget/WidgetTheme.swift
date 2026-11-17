import SwiftUI

/// The widget's two looks, picked by the hour rather than by the app's
/// Appearance setting: a white card through the day, Aurora after dark.
///
/// Every value is the app's own, from
/// `lib/theme/palette/kallo_palette_values.dart` (`_light` and `_aurora`);
/// `test/ios/today_widget_test.dart` holds the two files to each other.
struct WidgetTheme {
  let card: Color
  let ink: Color
  let muted: Color
  let track: Color
  let accent: Color
  let offTarget: Color
  let protein: Color
  let carbs: Color
  let fat: Color
  /// Aurora's two corner lights; nil on the light card.
  let glows: (apricot: Color, lilac: Color)?

  static let light = WidgetTheme(
    card: rgb(0xFFFFFF),  // elev
    ink: rgb(0x141413),  // text
    muted: rgb(0x7A7870),  // textMuted
    track: rgb(0xEDECE7),  // track
    accent: rgb(0xC9A87C),  // accent
    offTarget: rgb(0xD37B69),  // offTarget
    protein: rgb(0xD46A86),  // macroProtein
    carbs: rgb(0xE09C84),  // macroCarbs
    fat: rgb(0xE8C55C),  // macroFat
    glows: nil
  )

  static let aurora = WidgetTheme(
    card: rgb(0x131114),  // surface
    ink: rgb(0xF4F0EC),  // text
    muted: rgb(0x9C959C),  // textMuted
    track: rgb(0x2C282D),  // track
    accent: rgb(0xC9A87C),  // accent
    offTarget: rgb(0xE08878),  // offTarget
    protein: rgb(0xE07C96),  // macroProtein
    carbs: rgb(0xE7A68D),  // macroCarbs
    fat: rgb(0xEACB66),  // macroFat
    // brandApricot / brandLilac at the approved board's 22% and 20%.
    glows: (rgb(0xFFD2B0).opacity(0.22), rgb(0xDCC4FF).opacity(0.20))
  )

  /// The light card runs from `lightFrom` to `lightUntil` (local hours);
  /// Aurora the rest of the night. Owner decision in the PR.
  static let lightFrom = 6
  static let lightUntil = 18

  static func at(_ date: Date, calendar: Calendar = .gregorian) -> WidgetTheme {
    #if DEBUG
      // Simulator evidence only: the Simulator runs on the Mac's clock, so
      // Aurora could not be captured in daylight. Compiled out of release.
      switch UserDefaults(suiteName: TodaySnapshotStore.appGroup)?.string(forKey: "today.debugTheme") {
      case "light": return .light
      case "aurora": return .aurora
      default: break
      }
    #endif
    let hour = calendar.component(.hour, from: date)
    return (lightFrom..<lightUntil).contains(hour) ? .light : .aurora
  }

  private static func rgb(_ hex: UInt32) -> Color {
    Color(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// The card behind every size: the flat colour, and in Aurora the two lights
/// in its top corners — each an ellipse 80% of the card across and 60% down,
/// gone by 70% of its radius (the board's `radial-gradient(80% 60% at …)`).
struct WidgetBackground: View {
  let theme: WidgetTheme

  var body: some View {
    GeometryReader { geo in
      ZStack {
        theme.card
        if let glows = theme.glows {
          glow(glows.apricot, x: 0, in: geo.size)
          glow(glows.lilac, x: geo.size.width, in: geo.size)
        }
      }
    }
  }

  private func glow(_ color: Color, x: Double, in size: CGSize) -> some View {
    let rx = size.width * 0.8
    let ry = size.height * 0.6
    // A circle of `ry`, stretched sideways into the ellipse.
    return RadialGradient(
      gradient: Gradient(stops: [
        .init(color: color, location: 0),
        .init(color: color.opacity(0), location: 0.7),
      ]),
      center: .center, startRadius: 0, endRadius: ry
    )
    .frame(width: ry * 2, height: ry * 2)
    .scaleEffect(x: rx / ry, y: 1)
    .position(x: x, y: 0)
  }
}
