import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/logic/display_format.dart' show todayDateString;
import '../../../shell/nav/nav_actions.dart' show goToLogging;
import '../data/logging_providers.dart' show pendingLoggingDayProvider;

/// Open the logging feed on the day [instantIso] falls on, in the viewer's zone.
///
/// Plain [goToLogging] is not enough for this. [LoggingScreen] keeps its
/// selected date in State so paging back survives a tab switch, and
/// `pushOverShell` early-returns when the route is already open — so a user
/// parked on last Tuesday would never see a card staged for another day.
/// Parking the day first lets the screen claim it on its next build, which is
/// the same handshake `pendingMealProvider` uses.
///
/// An unparseable or empty timestamp falls back to today rather than throwing:
/// landing on the wrong day is recoverable with one tap, a crash on the way
/// back from a successful mutation is not.
void goToLoggingDay(BuildContext context, WidgetRef ref, String instantIso) {
  final instant = DateTime.tryParse(instantIso);
  ref.read(pendingLoggingDayProvider.notifier).state =
      instant == null ? todayDateString() : todayDateString(instant.toLocal());
  goToLogging(context);
}
