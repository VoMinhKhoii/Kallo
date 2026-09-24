import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/providers/onboarding_providers.dart';
import '../../onboarding/providers/profile_refresh.dart';
import '../logic/step_session.dart';

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
class SettingsStepSaver {
  const SettingsStepSaver(this._ref);

  final Ref _ref;

  /// Returns false (and leaves the session dirty) when there was nothing
  /// postable. Throws when the request fails.
  Future<bool> save(StepSession session) async {
    final data = session.payload;
    if (data == null) return false;
    await _ref
        .read(saveScreenControllerProvider)
        .save(step: session.step.serverStep, data: data);
    session.markSaved(data);
    refreshProfileReaders(_ref);
    return true;
  }
}

/// Imperative handle for the widget layer. Same shape as
/// [saveScreenControllerProvider].
final settingsStepSaverProvider = Provider<SettingsStepSaver>(
  (ref) => SettingsStepSaver(ref),
);
