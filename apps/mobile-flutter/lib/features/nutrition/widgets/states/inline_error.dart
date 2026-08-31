import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The nutrition page when the overview will not load: what went wrong, in
/// muted copy, and the one way out.
///
/// Red lives on the affordance, never on the copy — and here the affordance is
/// a retry, not a destruction, so it takes the app's in-app primary (beige +
/// ink, fully rounded) rather than anything alarming. The card itself is the
/// page's own card: white, radius 22, no border.
class InlineError extends StatelessWidget {
  const InlineError({
    super.key,
    required this.isRetrying,
    required this.message,
    required this.onRetry,
    required this.retryLabel,
  });

  final bool isRetrying;
  final String message;
  final VoidCallback onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp4,
        vertical: KalloSpacing.sp3,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(kCardRadius),
        color: kCardSurface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(message, style: dashBody(color: kInkMuted)),
          const SizedBox(height: KalloSpacing.sp3),
          KalloButton(
            title: retryLabel,
            loading: isRetrying,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}
