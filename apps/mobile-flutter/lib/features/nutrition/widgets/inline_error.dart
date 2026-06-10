import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';

/// RN port of `apps/mobile/src/components/nutrition/states/inline-error.tsx`.
class InlineError extends StatefulWidget {
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
  State<InlineError> createState() => _InlineErrorState();
}

class _InlineErrorState extends State<InlineError> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: NhamColors.borderSoft),
        color: NhamColors.elev,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NhamText(widget.message, variant: NhamTextVariant.body),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: widget.isRetrying
                  ? null
                  : (_) => setState(() => _pressed = true),
              onTapUp: widget.isRetrying
                  ? null
                  : (_) => setState(() => _pressed = false),
              onTapCancel: widget.isRetrying
                  ? null
                  : () => setState(() => _pressed = false),
              onTap: widget.isRetrying ? null : widget.onRetry,
              child: Opacity(
                opacity: widget.isRetrying ? 0.5 : 1,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: NhamColors.borderSoft),
                    color: (_pressed && !widget.isRetrying)
                        ? NhamColors.hover
                        : null,
                  ),
                  child: NhamText(
                    widget.retryLabel,
                    variant: NhamTextVariant.small,
                    style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                        .copyWith(color: NhamColors.text),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
