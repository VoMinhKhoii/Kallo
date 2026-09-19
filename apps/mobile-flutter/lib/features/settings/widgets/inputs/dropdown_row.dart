import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'custom_select.dart';

/// One option in the [CustomSelect] popover list.
///
/// Its own file because `custom_select.dart` sat at 345 lines against the
/// repo's 400 hard ceiling, and this was its one self-contained seam.
///
/// Owns the selection haptic rather than leaving it to the caller: the row is
/// what knows whether a tap is a CHANGE, and re-tapping the option already
/// selected should not tick.
class DropdownRow extends StatefulWidget {
  const DropdownRow({
    super.key,
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final CustomSelectOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<DropdownRow> createState() => DropdownRowState();
}

class DropdownRowState extends State<DropdownRow> {
  bool _pressed = false;

  void _handleTap() {
    if (!widget.selected) HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: widget.selected,
      excludeSemantics: true,
      label: widget.option.label,
      onTap: _handleTap,
      child: GestureDetector(
        onTap: _handleTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150), // transition-colors
          color: _pressed ? KalloColors.track : Colors.transparent,
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2 + 2, // py-2.5 = 10
          ),
          child: Row(
            children: [
              Expanded(child: Text(widget.option.label, style: dashBody())),
              if (widget.selected)
                const Icon(
                  LucideIcons.check300,
                  size: 16,
                  color: KalloColors.text,
                )
              else
                const SizedBox(width: 16, height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
