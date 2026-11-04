import SwiftUI
import WidgetKit

/// Direction "I · Dial row", approved 2026-11-04. Every size: a 16 margin,
/// the date top-left in the app's section-header style, 8 below it. Small is
/// the calorie dial alone; medium adds the three macro dials on the same
/// line; large hangs the day's meals 24 under that row.
struct TodayWidgetView: View {
  static let margin: Double = 16
  static let dateSize: Double = 16
  static let dateLineBox: Double = 19  // 16 × 1.2, as the board rounds it
  static let dateGap: Double = 8
  static let mealsGap: Double = 24
  static let calorieRadiusCap: Double = 57

  let entry: TodayEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let theme = entry.theme
    GeometryReader { geo in
      VStack(alignment: .leading, spacing: 0) {
        ReadoutText(
          text: WidgetFormat(entry.day?.locale ?? Locale.preferredLanguages.first ?? "en")
            .dateHeader(entry.date),
          font: WidgetFont.semibold(Self.dateSize), color: theme.ink,
          height: Self.dateLineBox, tracking: -0.3)
        content(theme: theme, room: rowRoom(geo.size.height))
          .padding(.top, Self.dateGap)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(Self.margin)
    .clipped()
  }

  /// The height the dial row may take: the box under the date, or — on the
  /// large widget — the same box the medium widget has, so both draw one row.
  private func rowRoom(_ height: Double) -> Double {
    let box = family == .systemLarge ? entry.rowHeight - 2 * Self.margin : height
    return box - Self.dateLineBox - Self.dateGap
  }

  @ViewBuilder
  private func content(theme: WidgetTheme, room: Double) -> some View {
    if let day = entry.day, day.signedIn {
      let radius = GaugeReadout.calorieRadius(fitting: room, cap: Self.calorieRadiusCap)
      switch family {
      case .systemSmall:
        CalorieDialView(radius: radius, day: day, theme: theme)
          .frame(maxWidth: .infinity)
      case .systemLarge:
        VStack(alignment: .leading, spacing: Self.mealsGap) {
          DialRow(calorieRadius: radius, day: day, theme: theme)
          MealList(meals: day.meals, theme: theme)
        }
      default:
        DialRow(calorieRadius: radius, day: day, theme: theme)
      }
    } else if let day = entry.day {
      // Signed out: the app cleared the day and left only its own words.
      ReadoutText(
        text: day.copy.signedOut, font: WidgetFont.regular(14), color: theme.muted,
        height: 18)
    }
  }
}

/// The card, filling the widget edge to edge (the margins are our own 16).
struct TodayWidgetContainer: View {
  let entry: TodayEntry

  var body: some View {
    TodayWidgetView(entry: entry)
      .containerBackground(for: .widget) {
        WidgetBackground(theme: entry.theme)
      }
      // Tap anywhere: open the app on Today (`TodayWidgetSync` routes it).
      .widgetURL(URL(string: "nham://today"))
  }
}
