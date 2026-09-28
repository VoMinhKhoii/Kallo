import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'scan_glass_button.dart';
import 'scan_mode_chip.dart';
import 'scan_tool_button.dart';

/// Everything that floats over the live camera: close and the light on top;
/// the mode chip, then the tools, at the bottom where the thumb is.
///
/// Barcode mode: "Type barcode" · (nothing to shoot — codes decode live) ·
/// "Enter manually". Label mode: "Library" · the shutter · "Enter manually".
/// "Enter manually" sits in the same corner in both, so the way to type a food
/// from scratch is always in one place.
class ScanCameraControls extends StatelessWidget {
  const ScanCameraControls({
    super.key,
    required this.mode,
    required this.onMode,
    required this.onClose,
    required this.onLight,
    required this.lightOn,
    required this.onTypeBarcode,
    required this.onLibrary,
    required this.onShutter,
    required this.onEnterManually,
  });

  final ScanType mode;
  final ValueChanged<ScanType> onMode;
  final VoidCallback onClose;

  final VoidCallback onLight;
  final bool lightOn;
  final VoidCallback onTypeBarcode;
  final VoidCallback onLibrary;
  final VoidCallback onShutter;
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        // A soft floor under the bottom controls so white words stay legible
        // over a white carton — the picture above stays untouched.
        const Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 260,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00000000), Color(0x80000000)],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          top: padding.top + 8,
          left: 12,
          right: 12,
          child: Row(
            children: [
              ScanGlassButton(
                icon: LucideIcons.x300,
                label: 'common.close'.tr(),
                onTap: onClose,
              ),
              const Spacer(),
              ScanGlassButton(
                icon: LucideIcons.flashlight300,
                label: 'logging.scan.light'.tr(),
                onTap: onLight,
                active: lightOn,
              ),
            ],
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: padding.bottom + 12,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ScanModeChip(value: mode, onChange: onMode),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (mode == ScanType.barcode)
                    ScanToolButton(
                      icon: LucideIcons.keyboard300,
                      label: 'logging.scan.typeBarcode'.tr(),
                      onTap: onTypeBarcode,
                    )
                  else
                    ScanToolButton(
                      icon: LucideIcons.images300,
                      label: 'logging.scan.library'.tr(),
                      onTap: onLibrary,
                    ),
                  if (mode == ScanType.label)
                    _Shutter(onTap: onShutter)
                  else
                    const SizedBox(width: 74),
                  ScanToolButton(
                    icon: LucideIcons.pencilLine300,
                    label: 'logging.scan.enterManually'.tr(),
                    onTap: onEnterManually,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The shutter: a white disc in a white ring, the iOS Camera shape.
class _Shutter extends StatelessWidget {
  const _Shutter({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.labelScan.takePhoto'.tr(),
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed: onTap,
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(74),
        child: Container(
          width: 74,
          height: 74,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFFFFFFF), width: 4),
          ),
          alignment: Alignment.center,
          child: const DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFFFFFFF),
            ),
            child: SizedBox.square(dimension: 60),
          ),
        ),
      ),
    );
  }
}
