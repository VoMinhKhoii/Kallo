# The iOS home-screen "Today" widget

Small, medium and large, in English and Vietnamese. Design: direction "I · Dial row", approved
2026-11-04. The app writes the day; a WidgetKit extension draws it. There is no network call,
no l10n and no business rule in the extension.

## Data flow

```
loggingDayProvider(today) ─┐                                  App Group group.com.khoivo.nham
profileProvider ───────────┼─► TodayWidgetSync ─► home_widget ─► UserDefaults "today.snapshot" (JSON)
signed-in user, locale ────┘   (lib/features/today_widget)       + WidgetCenter.reloadTimelines
                                                                       │
                                     ios/TodayWidget  ◄── reads ───────┘
```

- **What triggers a write.** `TodayWidgetSync` (mounted in `MaterialApp.builder`, `app.dart`)
  *watches* the day's saved meals and the profile's targets, the same providers the Today and Log
  screens read. Logging, editing, deleting, a refetch and a target edit all change one of them, so
  there is no list of call sites to keep. An identical snapshot is not re-sent
  (`TodayWidgetStore` remembers the last one), so rebuilds cost nothing and WidgetKit's reload
  budget is spent only on real changes.
- **Below the localizations, on purpose.** easy_localization's `tr()` returns the bare key above
  `MaterialApp`'s Localizations. Mounted in `main.dart`, the widget would print `dashboard.protein`.
- **The snapshot** (`logic/today_widget_snapshot.dart` ↔ `TodayWidget/TodaySnapshot.swift`): the
  local date, the locale the user chose in Kallo, targets, totals (rounded once, as the dials
  round), `floors` for totals that left out a meal's unknown value (drawn `≥`), today's saved meals
  oldest first (time already in the locale's `jm`, text capitalised as `MealBlock` does, kcal
  through `fmtKcal`), and the dial wording with its `{placeholders}` still in place. Staged,
  unconfirmed analyses are left out, as the dials leave them out.
- **A new day.** The widget compares the snapshot's date with its own entry's date. A snapshot
  from an earlier day renders as an empty day with the same targets, never yesterday's meals.
  The app writes the new day the next time it is resumed.
- **Sign-out** writes the signed-out card: no targets, no totals, no meals, only the app's
  "Not signed in." in the last language used.
- **Tap.** `widgetURL("nham://today")`. `TodayWidgetSync` listens with `app_links` and routes
  to `/dashboard`; signed out, the router's redirect takes it to sign-in.

**The bridge is `home_widget`** (0.10.0; owner ruling, 2026-11-04). `TodayWidgetStore` calls
`HomeWidget.saveWidgetData<String>('today.snapshot', json, appGroupId: 'group.com.khoivo.nham')`,
which the plugin stores with `UserDefaults(suiteName:)`, then `HomeWidget.updateWidget(iOSName:
'TodayWidget')`, which is `WidgetCenter.reloadTimelines(ofKind:)`. The widget UI is native SwiftUI;
the extension links nothing from the plugin and reads the suite directly. The plugin only claims
URLs carrying a `homeWidget` query item, so the plain `nham://today` tap still reaches `app_links`.

## The drawing

The dial is a port, not a redraw. `test/ios/today_widget_test.dart` holds each Swift constant to
its source, so a change on one side fails the suite until the other side follows:

| Swift | Ported from |
|---|---|
| `Gauge/GaugeGeometry.swift` | `lib/shared/widgets/gauge/rounded_sector_path.dart`, `gauge_arc_geometry.dart` (sector, corner fit, min sweep, the over-target cap) |
| `Gauge/GaugeReadout.swift` | web `lib/core/ui/gauge-figure-size.ts`, `components/shared/gauge/gauge-lines.ts`, `lib/core/ui/gauge-readout-layout.ts`, `gauge-strip-metrics.ts` (type sizes from the radius, the second line on the tips, `alignCentres`) |
| `WidgetTheme.swift` | `lib/theme/palette/kallo_palette_values.dart` (`_light`, `_aurora`) |

Two rules differ from the app's, and why:

- **Radius.** The calorie dial is the largest whole radius, up to 57, whose readout fits the
  small widget's height under the 16 margin and the date. That is 57 on a 170pt widget
  (Pro Max) and 53 on the iPhone 17 Pro's 164pt. The large widget draws the medium's row, so
  it sizes from the small/medium height, not its own: WidgetKit reports only the family it asks
  about, so a small or medium request remembers its height for the large one (an estimate from
  the shared width until then). Macro dials sit at the web's floor, 26.
- **"Kcal eaten" or "Eaten".** The web keeps the long unit only if a worst-case string
  ("kcal remaining", 6.876em) fits 90% of the tip opening. The widget asks the same question of
  the words it will draw, so the 53pt dial keeps "Kcal eaten" and "{left}/{target} left".

**More meals than fit** (owner ruling, 2026-11-04): WidgetKit cannot scroll, so the large widget
reads as if its list were scrolled to the bottom: the newest meals that fit, oldest first, newest
last, the oldest dropped, with no "+N more" and no count. A tap opens Today, which has the whole
day. The rule is `MealFit.firstShown` (`ios/TodayWidget/Meals/MealFit.swift`), run for real by
`test/ios/meal_fit_test.dart`.

Themes follow the hour, not the app's Appearance (owner ruling, 2026-11-04): the light card 06:00–18:00, Aurora (with the
board's two corner lights) otherwise. The timeline schedules entries at 06:00, 18:00 and
midnight, so the theme, the date and the empty new day all change with the app closed. On iOS 26
the system lifts the top of a dark widget a little on its own (measured +23 on #131114). That
lift is not ours.

## Testing it on the Simulator

Build and run the app as usual (`tool/run_dev.sh`), go home, long-press → Edit → Add Widget →
search "Kallo". In this repo's automation, `idb ui button HOME` and the swipe-home gesture are not
reliable on iOS 26; the Simulator menu works:
`osascript -e 'tell application "System Events" to tell process "Simulator" to click menu item "Home" of menu "Device" of menu bar 1'`.

To render a crafted day without the app overwriting it, terminate the app, write the snapshot, and
reinstall the same build (an install reloads every timeline):

```bash
G=$(xcrun simctl get_app_container booted com.khoivo.nham groups | awk '/group.com.khoivo.nham/{print $2}')
P="$G/Library/Preferences/group.com.khoivo.nham.plist"
xcrun simctl spawn booted defaults write "$P" today.snapshot -string "$(cat day.json)"
# Debug builds only: force a theme, since the Simulator runs on the Mac's clock.
xcrun simctl spawn booted defaults write "$P" today.debugTheme -string aurora   # or light
xcrun simctl install booted build/ios/iphonesimulator/Runner.app
```

Delete `today.debugTheme` afterwards. The override is compiled out of release builds.

## Not in this widget

Push updates (iOS 26 `WidgetPushHandler`), interactive buttons, lock-screen and StandBy families,
Android.
