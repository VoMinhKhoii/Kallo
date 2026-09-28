import 'package:flutter/cupertino.dart';

import 'scan_glass_button.dart';

/// A bottom tool on the camera — "Type barcode", "Library", "Enter manually":
/// a 52pt glass disc with its name under it, so the icon never has to explain
/// itself (the owner's rule for these actions: icons AND words).
class ScanToolButton extends StatelessWidget {
  const ScanToolButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 96,
    child: ScanGlassButton(
      icon: icon,
      label: label,
      onTap: onTap,
      size: 52,
      captioned: true,
    ),
  );
}
