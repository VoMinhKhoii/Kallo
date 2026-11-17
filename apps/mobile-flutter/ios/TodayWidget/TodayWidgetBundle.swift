import SwiftUI
import WidgetKit

/// Kallo's home-screen "Today" widget — small, medium and large.
///
/// The app writes the day (`lib/features/today_widget/`); this extension only
/// reads it and draws. Docs: `apps/docs/mobile/today-widget.md`.
@main
struct TodayWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodayWidget()
  }
}

struct TodayWidget: Widget {
  /// Must match `kTodayWidgetKind` in Dart: the app reloads this timeline by
  /// name (`HomeWidget.updateWidget`) after every write.
  static let kind = "TodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: TodayTimeline()) { entry in
      TodayWidgetContainer(entry: entry)
    }
    // The gallery is the system's, so it follows the phone's language.
    .configurationDisplayName(Text("widget.name"))
    .description(Text("widget.description"))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
