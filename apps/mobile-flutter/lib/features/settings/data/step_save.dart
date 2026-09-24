import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../dashboard/data/dashboard_providers.dart';
import '../../logging/data/logging_providers.dart';
import '../../onboarding/providers/onboarding_providers.dart';
import '../logic/step_session.dart';
import 'profile_providers.dart' as settings;

/// Saves one Settings step page through the SAME per-step endpoint the
/// onboarding wizard posts to (`POST /api/v1/onboarding/screen`).
///
/// Not `PUT /api/v1/profile`: that contract wants every field with the body
/// metrics non-null, so a user who skipped onboarding could not save their
/// cooking habits or region from Settings until they had filled in their
/// body — the exact journey Settings has to serve. The step endpoint takes
/// one step's fields, with identical wire keys, and only ever raises
/// `onboardingStep` / sets completion (`lib/domain/onboarding/actions.ts`),
/// so re-posting a step for a finished profile changes nothing else.
///
/// Returns false (and leaves the session dirty) when there was nothing
/// postable. Throws when the request fails.
Future<bool> saveSettingsStep(WidgetRef ref, StepSession session) async {
  final data = session.payload;
  if (data == null) return false;
  await ref
      .read(saveScreenControllerProvider)
      .save(step: session.step.serverStep, data: data);
  session.markSaved();
  // The controller refreshes the onboarding profile; everything else that
  // reads a target or a habit has to refetch too, or the dashboard keeps
  // yesterday's calorie goal (`first_run_finish.dart` does the same).
  ref.invalidate(settings.profileProvider);
  ref.invalidate(dashboardBundleProvider);
  ref.invalidate(loggingProfileProvider);
  return true;
}
