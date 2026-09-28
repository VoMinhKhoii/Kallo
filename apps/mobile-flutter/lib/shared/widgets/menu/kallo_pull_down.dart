import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_anchored_menu.dart';

/// One choice in a [KalloPullDown].
class KalloPullDownOption<T> {
  const KalloPullDownOption({
    required this.value,
    required this.label,
    this.detail,
  });

  final T value;
  final String label;

  /// What the choice amounts to, muted at the row's end ("100 ml").
  final String? detail;
}

/// The iOS pull-down button: the current value and a chevrons-up-down glyph,
/// which open a menu of [options] hanging off the button, the chosen one
/// ticked.
///
/// **Why not `CupertinoContextMenu` / a Material dropdown.** The app's popup
/// is [showKalloAnchoredMenu] (its own documented exception: the context menu
/// relocates and scales the pressed widget). This is that menu in its
/// pull-down form, so a value row reads and behaves the same everywhere it
/// appears — the scan sheet's Portion and the editor's Values per first.
class KalloPullDown<T> extends StatelessWidget {
  const KalloPullDown({
    super.key,
    required this.value,
    required this.display,
    required this.options,
    required this.onChanged,
    this.semanticLabel,
  });

  /// The current choice; its option is ticked in the menu.
  final T value;

  /// What the button shows — may differ from the option label (the Portion
  /// row reads "100 ml / serving" for the Serving option).
  final String display;

  final List<KalloPullDownOption<T>> options;

  /// Called with a DIFFERENT value only; re-picking the current one is a no-op.
  final ValueChanged<T>? onChanged;

  /// Spoken name of the control ("Portion").
  final String? semanticLabel;

  Future<void> _open(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || overlay == null || !box.attached) return;
    final anchor = box.localToGlobal(Offset.zero, ancestor: overlay) & box.size;
    final picked = await showKalloAnchoredMenu<T>(
      context,
      anchor: anchor,
      actions: [
        for (final option in options)
          KalloMenuAction<T>(
            label: option.label,
            value: option.value,
            detail: option.detail,
            checked: option.value == value,
          ),
      ],
    );
    if (picked != null && picked != value) onChanged?.call(picked);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = onChanged != null && options.length > 1;
    return Semantics(
      button: true,
      label: semanticLabel,
      value: display,
      excludeSemantics: true,
      child: Builder(
        builder:
            (context) => CupertinoButton(
              onPressed: enabled ? () => _open(context) : null,
              padding: EdgeInsets.zero,
              minimumSize: const Size.square(KalloIcons.hit),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      display,
                      style: dashBody(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (enabled) ...[
                    const SizedBox(width: KalloSpacing.sp1),
                    const Icon(
                      LucideIcons.chevronsUpDown300,
                      size: 16,
                      color: KalloColors.textMuted,
                    ),
                  ],
                ],
              ),
            ),
      ),
    );
  }
}
