import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/nham_colors.dart';
import '../../theme/nham_theme.dart';

/// Shared chrome for every modal bottom sheet in the app.
///
/// One header pattern (grab handle top-center · bold centered title · X close
/// top-LEFT) and one surface (solid white, top-rounded at [kCardRadius]) so the
/// eleven hand-rolled sheets stop diverging. Callers keep their own body and
/// height mechanics; they only adopt [NhamSheetHeader] + [NhamSheetSurface]
/// (and, where the call site is simple, [showNhamSheet]).

/// Opens a modal sheet with the standard transparent-background chrome — the
/// surface itself is painted by [NhamSheetSurface], which the [builder] returns.
Future<T?> showNhamSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool isScrollControlled = false,
  Color? barrierColor,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: Colors.transparent,
    barrierColor: barrierColor,
    builder: builder,
  );
}

/// The standard sheet surface: solid white, top corners rounded at the calm
/// card radius. Callers pass their own [constraints] (max-height slice) and,
/// optionally, [padding] for content-hugging sheets.
class NhamSheetSurface extends StatelessWidget {
  const NhamSheetSurface({
    super.key,
    required this.child,
    this.constraints,
    this.padding,
    this.clipBehavior = Clip.none,
  });

  final Widget child;
  final BoxConstraints? constraints;
  final EdgeInsetsGeometry? padding;
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: constraints,
      padding: padding,
      clipBehavior: clipBehavior,
      decoration: const BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(kCardRadius)),
      ),
      child: child,
    );
  }
}

/// The unified sheet header: a centered grab handle, then a row with the X
/// close button on the LEFT, a bold centered title (with an optional
/// [subtitle]), and a 48×48 right-hand mirror so the title stays optically
/// centered against the close button.
///
/// Pass [title] for the common case, or [titleWidget] to supply a dynamic
/// header (e.g. an inline-editable name). [onClose] defaults to popping the
/// route; [closeEnabled] gates the button while a sheet is mid-save.
class NhamSheetHeader extends StatelessWidget {
  const NhamSheetHeader({
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
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp2),
          child: Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: NhamColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            NhamSpacing.sp2,
            0,
            NhamSpacing.sp2,
            NhamSpacing.sp1,
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: closeEnabled
                    ? (onClose ?? () => Navigator.of(context).pop())
                    : null,
                icon: const Icon(LucideIcons.x, size: 22),
                color: NhamColors.textMuted,
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
