import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// Retryable error state for the Circle read surfaces (wall, circle list,
/// invite preview). A failed fetch must not masquerade as an empty state — a
/// user with a circle should see "try again", not "your circle is quiet".
/// Mirrors `components/groups/circle-error.tsx`: a warm danger-tinted card
/// with a rounded retry pill.
class CircleErrorCard extends StatelessWidget {
  const CircleErrorCard({
    required this.onRetry,
    this.isRetrying = false,
    super.key,
  });

  final VoidCallback onRetry;
  final bool isRetrying;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp10),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448),
          padding: const EdgeInsets.all(NhamSpacing.sp4),
          decoration: BoxDecoration(
            color: NhamColors.danger06,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: NhamColors.danger30),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: NhamSpacing.sp0_5),
                child: Icon(
                  LucideIcons.circleAlert300,
                  size: 20,
                  color: NhamColors.danger,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('groups.error.title'),
                      style: NhamTextStyles.sansSemiBold(
                        fontSize: NhamFontSize.detail,
                      ).copyWith(color: NhamColors.text),
                    ),
                    const SizedBox(height: NhamSpacing.sp1),
                    Text(
                      tr('groups.error.body'),
                      style: NhamTextStyles.sansRegular(
                        fontSize: NhamFontSize.detail,
                        height: NhamLeading.normal,
                      ).copyWith(color: NhamColors.textMuted),
                    ),
                    const SizedBox(height: NhamSpacing.sp3),
                    _RetryPill(onRetry: onRetry, isRetrying: isRetrying),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rounded-full danger pill with a RefreshCw that spins while retrying.
class _RetryPill extends StatefulWidget {
  const _RetryPill({required this.onRetry, required this.isRetrying});

  final VoidCallback onRetry;
  final bool isRetrying;

  @override
  State<_RetryPill> createState() => _RetryPillState();
}

class _RetryPillState extends State<_RetryPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void initState() {
    super.initState();
    if (widget.isRetrying) _spin.repeat();
  }

  @override
  void didUpdateWidget(covariant _RetryPill old) {
    super.didUpdateWidget(old);
    if (widget.isRetrying && !old.isRetrying) {
      _spin.repeat();
    } else if (!widget.isRetrying && old.isRetrying) {
      _spin.stop();
      _spin.value = 0;
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: widget.isRetrying ? 0.6 : 1,
      child: GestureDetector(
        onTap: widget.isRetrying ? null : widget.onRetry,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3_5,
            vertical: NhamSpacing.sp2,
          ),
          decoration: BoxDecoration(
            color: NhamColors.danger10,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              RotationTransition(
                turns: _spin,
                child: const Icon(
                  LucideIcons.refreshCw300,
                  size: 16,
                  color: NhamColors.danger,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                tr('groups.error.retry'),
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.detail)
                    .copyWith(color: NhamColors.danger),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
