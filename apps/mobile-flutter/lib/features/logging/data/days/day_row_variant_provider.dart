import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../logic/days/this_week.dart';

/// Which row the days pane of a two-pane Log draws under its calendar.
///
/// The app ships [LogDayRowVariant.plain]. A provider rather than a constant
/// only so the pose gallery can render the other one for the owner beside it;
/// once one is chosen, this and the variant that lost go.
final logDayRowVariantProvider = Provider<LogDayRowVariant>(
  (ref) => LogDayRowVariant.plain,
);
