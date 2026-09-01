import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// The dark stage both scan branches shoot into (native pass, 2026-08-31): a
/// `#1C1C1E` panel at the sheet radius, the live view (or the held photo)
/// filling it, a 12pt hint at 75% white, and the controls sitting INSIDE the
/// frame the way the iPhone camera puts them — not in a bar underneath it.
///
/// [onShutter] is what retired the umber "Take photo" bar and the beige
/// library pill: the branch that captures a photo renders the shutter here and
/// hands its library picker to [leading]. The barcode branch decodes
/// continuously, so it passes no shutter and puts the torch in that slot.
typedef ScanStageBuilder = Widget Function(BuildContext context, Size size);

class ScanCameraStage extends StatelessWidget {
  const ScanCameraStage({
    super.key,
    required this.builder,
    this.hint,
    this.notice,
    this.leading,
    this.onShutter,
    this.shutterLabel,
  });

  /// The stage's content layer, given the stage's own size so a caller can
  /// derive a scan window from it.
  final ScanStageBuilder builder;

  /// One quiet line of guidance over the view.
  final String? hint;

  /// What the frame says BACK, in the hint's slot: the barcode branch's lookup
  /// spinner and its misses. A status the scanner reports belongs over the
  /// live view — replacing the stage with a panel throws the camera away at
  /// the moment it is still the answer. Takes the slot from [hint]; the two
  /// are never up at once.
  final Widget? notice;

  /// A 44pt control at the stage's bottom-left (torch, photo library).
  final Widget? leading;

  /// Renders the iPhone-style shutter when non-null.
  final VoidCallback? onShutter;
  final String? shutterLabel;

  static const Color _stage = Color(0xFF1C1C1E);

  @override
  Widget build(BuildContext context) {
    final hasControls = onShutter != null || leading != null;
    return ClipRRect(
      borderRadius: BorderRadius.circular(KalloRadii.sheet),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: LayoutBuilder(
          builder: (context, constraints) => Stack(
            fit: StackFit.expand,
            children: [
              const ColoredBox(color: _stage),
              builder(context, constraints.biggest),
              if (notice != null || hint != null)
                Positioned(
                  left: KalloSpacing.sp4,
                  right: KalloSpacing.sp4,
                  bottom: hasControls ? 100 : KalloSpacing.sp4,
                  child:
                      notice ??
                      Text(
                        hint!,
                        textAlign: TextAlign.center,
                        // Meta in the app's own family — a bare TextStyle here
                        // would inherit Material's default face on the one
                        // surface where nothing else sets it.
                        style: dashMeta(color: const Color(0xBFFFFFFF)),
                      ),
                ),
              if (onShutter != null)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: KalloSpacing.sp4,
                  child: Center(
                    child: _Shutter(
                      onTap: onShutter!,
                      semanticsLabel: shutterLabel,
                    ),
                  ),
                ),
              if (leading != null)
                Positioned(
                  left: KalloSpacing.sp5,
                  bottom: onShutter != null ? 27 : KalloSpacing.sp4,
                  child: SizedBox(width: 44, height: 44, child: leading),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The iPhone camera shutter: a 66pt white ring at stroke 4 around a 54pt
/// solid disc, dipping on press.
class _Shutter extends StatefulWidget {
  const _Shutter({required this.onTap, this.semanticsLabel});

  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  State<_Shutter> createState() => _ShutterState();
}

class _ShutterState extends State<_Shutter> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.semanticsLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.mediumImpact();
          widget.onTap();
        },
        child: Container(
          width: 66,
          height: 66,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 4),
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeInOut,
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _pressed ? const Color(0xB3FFFFFF) : Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
