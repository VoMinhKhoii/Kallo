import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_theme.dart';

/// The unified sheet header: a centered grab handle, then a row with the X
/// close button on the LEFT, a bold centered title (with an optional
/// [subtitle]), and a 48×48 right-hand mirror so the title stays optically
/// centered against the close button.
///
/// Pass [title] for the common case, or [titleWidget] to supply a dynamic
/// header (e.g. an inline-editable name). [onClose] defaults to popping the
/// route; [closeEnabled] gates the button while a sheet is mid-save.
class KalloSheetHeader extends StatelessWidget {
  const KalloSheetHeader({
    super.key,
    this.title,
    this.titleWidget,
    this.subtitle,
    this.onClose,
    this.closeEnabled = true,
  }) : assert(
          title != null || titleWidget != null,
          'Provide either a title or a titleWidget',
        );

  final String? title;

  /// Overrides [title] for the one dynamic case (group name with inline edit).
  final Widget? titleWidget;

  /// Optional centered caption under the title.
  final String? subtitle;

  final VoidCallback? onClose;

  /// When false the X is dimmed and inert (barcode disables it while saving).
  final bool closeEnabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Grab handle, top-center.
        Padding(
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
          child: Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: KalloColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp2,
            0,
            KalloSpacing.sp2,
            KalloSpacing.sp1,
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: closeEnabled
                    ? (onClose ?? () => Navigator.of(context).pop())
                    : null,
                icon: const Icon(LucideIcons.x300, size: KalloIcons.size),
                color: KalloColors.textMuted,
                tooltip: 'common.cancel'.tr(),
              ),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    titleWidget ??
                        Text(
                          title!,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: dashValue().copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        textAlign: TextAlign.center,
                        style: dashMeta(),
                      ),
                    ],
                  ],
                ),
              ),
              // Mirror the 48×48 close target so the title stays centered.
              const SizedBox(width: 48, height: 48),
            ],
          ),
        ),
      ],
    );
  }
}
