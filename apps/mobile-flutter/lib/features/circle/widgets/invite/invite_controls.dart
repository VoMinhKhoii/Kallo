/// The three small controls the invite sheet's rows are assembled from: the
/// icon+eyebrow field label, the Copy pill, and the square icon button.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

/// A row's title: a small muted glyph beside an eyebrow label.
class InviteFieldLabel extends StatelessWidget {
  const InviteFieldLabel({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: KalloColors.textMuted),
        const SizedBox(width: KalloSpacing.sp1_5),
        KalloText(label, variant: KalloTextVariant.eyebrow),
      ],
    );
  }
}

/// The read-only face of an editable field: one line of text in a track-filled
/// hairline pill. Both identity rows park their current value in one.
class InviteValuePill extends StatelessWidget {
  const InviteValuePill({
    super.key,
    required this.text,
    required this.fontSize,
    required this.color,
  });

  final String text;
  final double fontSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp3,
        vertical: KalloSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: KalloColors.track,
        borderRadius: BorderRadius.circular(KalloRadii.lg),
        border: Border.all(color: KalloColors.borderSoft),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: KalloTextStyles.sansRegular(
          fontSize: fontSize,
        ).copyWith(color: color),
      ),
    );
  }
}

/// Copies the invite link. Its own haptic, because the link leaves the app.
class InviteCopyButton extends StatelessWidget {
  const InviteCopyButton({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp2_5,
        ),
        decoration: BoxDecoration(
          color: KalloColors.track,
          borderRadius: BorderRadius.circular(KalloRadii.lg),
          border: Border.all(color: KalloColors.borderSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.copy300, size: 14, color: KalloColors.text),
            const SizedBox(width: KalloSpacing.sp1_5),
            Text(
              tr('groups.invite.copy'),
              style: KalloTextStyles.sansMedium(
                fontSize: KalloFontSize.xs,
              ).copyWith(color: KalloColors.text),
            ),
          ],
        ),
      ),
    );
  }
}

/// A square icon button — filled (umber) for the primary confirm, or a hairline
/// outline for secondary actions (cancel / edit). Dims + ignores taps when
/// [disabled].
class InviteIconAction extends StatelessWidget {
  const InviteIconAction({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.filled = false,
    this.loading = false,
    this.disabled = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;
  final bool loading;
  final bool disabled;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final inert = loading || disabled;
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: Opacity(
        opacity: disabled ? 0.55 : 1,
        child: GestureDetector(
          onTap: inert ? null : onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: filled ? KalloColors.btn : KalloColors.track,
              borderRadius: BorderRadius.circular(KalloRadii.lg),
              border: filled ? null : Border.all(color: KalloColors.borderSoft),
            ),
            child:
                loading
                    ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Icon(
                      icon,
                      size: 18,
                      color: filled ? Colors.white : KalloColors.textMuted,
                    ),
          ),
        ),
      ),
    );
  }
}
