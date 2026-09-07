import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/logic/resume_screen.dart';

/// The wizard shows six screens over three server steps, so "where was I" has
/// to be translated in both directions — and getting it wrong silently skips
/// questions the server never received.
void main() {
  group('server step → first screen of that step', () {
    test('each step maps to the screen that OPENS it', () {
      expect(onboardingScreenForServerStep(1), 1);
      expect(onboardingScreenForServerStep(2), 3);
      expect(onboardingScreenForServerStep(3), 5);
    });

    test('a step outside 1–3 still lands somewhere sane', () {
      // 0 is what a profile with no `onboardingStep` reports.
      expect(onboardingScreenForServerStep(0), 1);
      expect(onboardingScreenForServerStep(-4), 1);
      expect(onboardingScreenForServerStep(9), 5);
    });
  });

  group('draft screenReached → next screen', () {
    test('resumes on the screen AFTER the furthest one answered', () {
      expect(onboardingScreenForDraft(0), 1);
      expect(onboardingScreenForDraft(3), 4);
      expect(onboardingScreenForDraft(5), 6);
    });

    test('a completed draft clamps to the last screen, never past it', () {
      expect(onboardingScreenForDraft(6), 6);
      expect(onboardingScreenForDraft(60), 6);
    });
  });
}
