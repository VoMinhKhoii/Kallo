import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The unified sheet header: a centered grabber, then the X close button on
/// the LEFT, a bold centered 17/600 title (with an optional [subtitle]), and a
/// right-hand mirror so the title stays optically centered against the close
/// button.
///
/// The grabber came back after the native pass retired it: it is the standard
/// iOS cue that a surface is draggable, and `showNhamSheet` sheets ARE
/// drag-to-dismiss. Without it the drag affordance was invisible. Every sheet
/// surface in the app renders this header, so putting it here gives all of
/// them the same chrome.
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

  /// The close button's tap target — the app's 44pt minimum.
  static const double _closeTarget = 44;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // The grabber, 8pt off the sheet's top edge.
        const SizedBox(height: KalloSpacing.sp2),
        Container(
          width: 36,
          height: 5,
          decoration: BoxDecoration(
            color: KalloColors.border,
            borderRadius: BorderRadius.circular(2.5),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Padding(
          // The content inset, so the X's GLYPH starts on the same 16pt line
          // the sheet's body does. It used to sit at 8pt of padding plus
          // IconButton's own 48pt centring — 32pt in, level with nothing.
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            0,
            KalloSpacing.sp4,
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
                // The 44pt target keeps its size by extending INWARD from the
                // glyph rather than centring the glyph inside itself.
                padding: EdgeInsets.zero,
                alignment: Alignment.centerLeft,
                constraints: const BoxConstraints.tightFor(
                  width: _closeTarget,
                  height: _closeTarget,
                ),
                // Material's default padded tap target wraps the button in a
                // 48pt box and CENTRES it, which pushed the glyph 2pt off the
                // inset. The 44pt constraints above already meet the minimum.
                style: IconButton.styleFrom(
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
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
              // Mirror the close target so the title stays centered.
              const SizedBox(width: _closeTarget, height: _closeTarget),
            ],
          ),
        ),
      ],
    );
  }
}
