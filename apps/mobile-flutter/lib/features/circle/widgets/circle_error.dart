import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';

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
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp10),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448),
          padding: const EdgeInsets.all(KalloSpacing.sp4),
          decoration: BoxDecoration(
            color: KalloColors.danger06,
            borderRadius: BorderRadius.circular(KalloRadii.containerLg),
            border: Border.all(color: KalloColors.danger30),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: KalloSpacing.sp0_5),
                child: Icon(
                  LucideIcons.circleAlert300,
                  size: 20,
                  color: KalloColors.danger,
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('groups.error.title'),
                      style: KalloTextStyles.sansSemiBold(
                        fontSize: KalloFontSize.detail,
                      ).copyWith(color: KalloColors.text),
                    ),
                    const SizedBox(height: KalloSpacing.sp1),
                    Text(
                      tr('groups.error.body'),
                      style: KalloTextStyles.sansRegular(
                        fontSize: KalloFontSize.detail,
                        height: KalloLeading.normal,
                      ).copyWith(color: KalloColors.textMuted),
                    ),
                    const SizedBox(height: KalloSpacing.sp3),
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
            horizontal: KalloSpacing.sp3_5,
            vertical: KalloSpacing.sp2,
          ),
          decoration: BoxDecoration(
            color: KalloColors.danger10,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              RotationTransition(
                turns: _spin,
                child: const Icon(
                  LucideIcons.refreshCw300,
                  size: 16,
                  color: KalloColors.danger,
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              Text(
                tr('groups.error.retry'),
                style: KalloTextStyles.sansMedium(fontSize: KalloFontSize.detail)
                    .copyWith(color: KalloColors.danger),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
