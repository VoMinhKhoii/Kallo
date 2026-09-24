import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../dashboard/data/dashboard_providers.dart';
import '../../logging/data/logging_providers.dart';
import 'onboarding_providers.dart';

/// Drops every cached reader of the profile after a write that changes it.
///
/// [SaveScreenController] only refreshes the profile itself; the dashboard
/// bundle and the logging profile carry the computed target and the cooking
/// habits, so without these they keep yesterday's calorie goal. Shared by the
/// first-run finish and the Settings step save — one list, not two copies.
void refreshProfileReaders(Ref ref) {
  ref.invalidate(profileProvider);
  ref.invalidate(dashboardBundleProvider);
  ref.invalidate(loggingProfileProvider);
}
