import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_sheet.dart';
import 'sheet_circle_button.dart';

/// The unified sheet header, iOS 26 anatomy: a centred grabber, a grey circle
/// close (or back) on the LEFT, the 17/600 title centred, and an optional
/// [trailing] action — a `SheetCapsuleButton` such as "Edit".
///
/// **Geometry is exact, not approximate** (owner review, 2026-09-28): both
/// controls are 36pt tall and sit 16pt from the sheet's top and 16pt in from
/// its side, TOP-aligned, so a control's centre is (34, 34) — the centre of
/// the sheet's 34pt corner ([kSheetRadius]). The gap between control and
/// corner is then even all the way round the curve. Centring the controls in
/// a taller row pushed them 4pt down and broke that, visibly.
///
/// The grabber stays: it is the standard iOS cue that a surface drags, and
/// `showNhamSheet` sheets drag to dismiss.
///
/// The header inherits the surface's content inset ([SheetContentInset]) so
/// the circle starts on exactly the line the sheet's body starts on.
class KalloSheetHeader extends StatelessWidget {
  const KalloSheetHeader({
    super.key,
    this.title,
    this.titleWidget,
    this.subtitle,
    this.onClose,
    this.onBack,
    this.closeEnabled = true,
    this.trailing,
  });

  final String? title;

  /// Overrides [title] for the one dynamic case (group name with inline edit).
  final Widget? titleWidget;

  /// Optional centred caption under the title.
  final String? subtitle;

  /// Close action; defaults to popping the route. Ignored when [onBack] is set.
  final VoidCallback? onClose;

  /// Turns the leading control into a back chevron — a sheet's second level.
  final VoidCallback? onBack;

  /// When false the leading control is dimmed and inert (a sheet mid-save).
  final bool closeEnabled;

  /// The right-hand action, usually a `SheetCapsuleButton`.
  final Widget? trailing;

  /// Controls start this far below the sheet's top edge; the 44pt targets
  /// reach 4pt above the 36pt circles.
  static const double _controlsTop = 16;
  static const double _targetOverhang =
      (KalloIcons.hit - SheetCircleButton.size) / 2;

  /// Grabber, controls row, and the same 16pt below the controls as above
  /// them (the approved canvas: 68) — the height of a one-line header; a
  /// subtitle or a taller title widget adds to it.
  static const double height = _controlsTop + SheetCircleButton.size + 16;

  static double _ownInset(BuildContext context) =>
      math.max(0, kSheetContentInset - SheetContentInset.of(context));

  @override
  Widget build(BuildContext context) {
    final inset = _ownInset(context);
    final back = onBack != null;
    final leading = SheetCircleButton(
      icon: back ? LucideIcons.chevronLeft300 : LucideIcons.x300,
      label: back ? 'common.back'.tr() : 'common.close'.tr(),
      onTap:
          closeEnabled
              ? () {
                HapticFeedback.lightImpact();
                (onBack ?? onClose ?? () => Navigator.of(context).pop())();
              }
              : null,
    );
    final heading =
        titleWidget ??
        (title == null
            ? null
            : Text(
              title!,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: kSheetTitle(),
            ));
    final middle =
        heading == null
            ? null
            : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                heading,
                if (subtitle != null)
                  Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    style: dashMeta(),
                  ),
              ],
            );

    return Stack(
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
            inset,
            _controlsTop - _targetOverhang,
            inset,
            height - _controlsTop - SheetCircleButton.size - _targetOverhang,
          ),
          child:
              trailing == null
                  ? _GrowingBar(leading: leading, middle: middle)
                  : SizedBox(
                    height: KalloIcons.hit,
                    // The platform navigation bar's own layout: the title
                    // centres on the SHEET and gives way to a wide capsule
                    // rather than colliding with it. Its height is fixed, so
                    // a trailing header takes a one-line title only.
                    child: NavigationToolbar(
                      leading: leading,
                      middle: middle,
                      trailing: trailing,
                      middleSpacing: KalloSpacing.sp2,
                    ),
                  ),
        ),
        // The grabber, 8pt off the sheet's top edge.
        Positioned(
          top: KalloSpacing.sp2,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              width: 36,
              height: 5,
              decoration: BoxDecoration(
                color: KalloColors.border,
                borderRadius: BorderRadius.circular(2.5),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The header row without a trailing action: the leading control, and the
/// title centred between it and a mirror of it. It grows with its title, which
/// a subtitle ("3 members") or an inline rename field makes taller than the
/// 44pt row; the controls stay pinned to the row's top.
class _GrowingBar extends StatelessWidget {
  const _GrowingBar({required this.leading, required this.middle});

  final Widget leading;
  final Widget? middle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: KalloIcons.hit, height: KalloIcons.hit, child: leading),
        Expanded(
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: KalloIcons.hit),
            child: Align(child: middle),
          ),
        ),
        const SizedBox(width: KalloIcons.hit),
      ],
    );
  }
}
