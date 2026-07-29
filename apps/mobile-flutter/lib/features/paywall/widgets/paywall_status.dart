import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class PaywallSpinner extends StatelessWidget {
  const PaywallSpinner({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 22,
    height: 22,
    child: CircularProgressIndicator(
      strokeWidth: 2,
      valueColor: AlwaysStoppedAnimation(NhamColors.accent),
    ),
  );
}

class PaywallCenteredNote extends StatelessWidget {
  const PaywallCenteredNote({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp6),
    child: Center(child: child),
  );
}

class PaywallNote extends StatelessWidget {
  const PaywallNote({
    required this.title,
    required this.body,
    this.leading,
    super.key,
  });

  final String title;
  final String body;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.track,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (leading != null) ...[
            leading!,
            const SizedBox(height: NhamSpacing.sp3),
          ],
          Text(title, style: dashBody(weight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(body, style: dashMeta()),
        ],
      ),
    );
  }
}

class PaywallRetryNote extends StatelessWidget {
  const PaywallRetryNote({
    required this.message,
    required this.onRetry,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PaywallNote(title: message, body: tr('common.retry')),
        const SizedBox(height: NhamSpacing.sp3),
        NhamButton(
          title: tr('common.retry'),
          variant: NhamButtonVariant.secondary,
          onPressed: onRetry,
        ),
      ],
    );
  }
}
