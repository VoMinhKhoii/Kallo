import 'package:flutter/cupertino.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';

/// A round dark-glass control over the camera: close, the light, and the
/// bottom tools. [size] is the disc; the tap target never drops below 44pt.
class ScanGlassButton extends StatelessWidget {
  const ScanGlassButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.size = 44,
    this.active = false,
    this.captioned = false,
  });

  final IconData icon;

  /// Spoken name ("Close", "Light").
  final String label;
  final VoidCallback? onTap;
  final double size;

  /// The light while it is on: the disc turns white and the glyph ink.
  final bool active;

  /// [label] also written under the disc — the bottom tools, whose words are
  /// part of the target: people tap "Type barcode", not just its icon.
  final bool captioned;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      toggled: active ? true : null,
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed: onTap,
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(KalloIcons.hit),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: active ? const Color(0xFFFFFFFF) : kGlass,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 20,
                color:
                    active ? const Color(0xFF141413) : const Color(0xFFFFFFFF),
              ),
            ),
            if (captioned) ...[
              const SizedBox(height: 6),
              // Caption 12: a fixed-width label under a disc on the camera —
              // Meta wraps "Enter manually" in Vietnamese at 96pt.
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashCaption(color: const Color(0xFFFFFFFF)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
