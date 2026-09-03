/// The dashboard day-pager's page ↔ date mapping.
///
/// The browsable window is unbounded into the past and clamped at today, so
/// there is no finite list of days to index: page [kDayPageBase] is today and
/// every lower page is one day earlier. Pages above [kDayPageBase] do not
/// exist — the pager's `itemCount` is `kDayPageBase + 1`.
library;

import '../../logging/logic/timeline_utils.dart';

/// A large midpoint so the pager can page far into the past while today sits
/// at a known index. Mirrors [kWeekPageBase] for the week strip.
const int kDayPageBase = 5000;

/// The YYYY-MM-DD date shown at [page], counting days back from [today].
String dateForDayPage(String today, int page) =>
    addDays(today, page - kDayPageBase);

/// The inverse of [dateForDayPage]: the page index showing [date].
int dayPageForDate(String today, String date) =>
    kDayPageBase + calendarDaysBetween(today, date);
