import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// What the app shows when a widget throws while building.
///
/// Flutter's default is [RenderErrorBox], and in a RELEASE build that is a
/// flat `Color(0xF0C0C0C0)` rectangle with no text, no hit testing and no way
/// out — the "grey screen" a user can only escape by force-quitting. It is
/// also silent: the exception goes to the console, which nobody on a phone
/// has. One build error anywhere near the root therefore bricks the app and
/// tells its user nothing.
///
/// This replaces it with a surface that says something, in the app's own
/// colours, and — crucially — SHOWS THE EXCEPTION on a non-release build, so
/// a grey screen reproduced on a device reports its own cause instead of
/// needing an attached console.
///
/// **It is deliberately dependency-free.** No theme, no localization, no
/// providers, no assets, no `Scaffold`: it renders precisely when the tree is
/// already broken, and anything it reached for could be the thing that threw.
/// Raw [Directionality] + [ColoredBox] + [Text] only, with an explicit
/// [TextStyle] so it does not need an inherited one.
class KalloErrorWidget extends StatelessWidget {
  const KalloErrorWidget({required this.details, super.key});

  final FlutterErrorDetails details;

  /// `KalloColors.surface` and `text`, INLINED. Importing the token file would
  /// make the error surface depend on the theme layer it may be reporting the
  /// failure of.
  static const Color _surface = Color(0xFFF8F7F4);
  static const Color _ink = Color(0xFF141413);
  static const Color _muted = Color(0xFF7A7870);

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: _surface,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 64),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Something broke on this screen.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                  color: _ink,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Close Kallo and open it again. Your data is safe — nothing '
                'was lost.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, height: 1.4, color: _muted),
              ),
              // Release keeps the reassurance and drops the stack trace; every
              // other build prints the exception HERE, on the device, which is
              // the whole point — a tester reproducing this can read the cause
              // off the screen they are already looking at.
              if (!kReleaseMode) ...[
                const SizedBox(height: 24),
                Flexible(
                  child: SingleChildScrollView(
                    child: Text(
                      details.exceptionAsString(),
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: _ink,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Installs [KalloErrorWidget] and makes sure the exception behind it is
/// reported rather than only drawn.
///
/// `ErrorWidget.builder` is what the framework calls to BUILD the replacement
/// subtree; it does not report anything. `FlutterError.onError` is the report,
/// and the default already forwards to the console — this keeps that and adds
/// nothing, so a crash reporter attached later still sees every error exactly
/// once.
void installKalloErrorWidget() {
  ErrorWidget.builder = (details) => KalloErrorWidget(details: details);
}
