/// What ONE onboarding screen contributes to the wizard's persistent chrome.
///
/// The wizard keeps the header, the bun and the pinned CTA mounted across all
/// six screens and slides only the region between them, so a screen no longer
/// renders any chrome of its own. It hands back the two things that travel —
/// the page title and the body under it — plus the contract the pinned button
/// wears while that screen is showing.
library;

import 'package:flutter/widgets.dart';

typedef OnboardingStepSpec = ({
  // The page title: the first thing in the sliding region.
  String title,
  // Everything under the title, inside the region's own scroll view.
  Widget body,
  // The label the CTA wears; it cross-fades when this changes.
  String ctaLabel,
  // False holds the CTA — screen 3 with an out-of-range metric.
  bool ctaEnabled,
});
