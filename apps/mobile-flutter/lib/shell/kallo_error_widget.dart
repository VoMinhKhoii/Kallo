import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// What the app shows when a widget throws while building.
///
/// Flutter's default is [RenderErrorBox], and in a RELEASE build that is a
/// flat `Color(0xF0C0C0C0)` rectangle with no text, no hit testing and no way
/// out — the "grey screen" a user can only escape by force-quitting. It is
/// also silent: the exception goes to the console, which nobody holding a
/// phone has. One build error near the root therefore bricks the app and tells
/// nobody anything.
///
/// This replaces it with a surface that says what happened, and — behind one
/// tap — what threw, with a Copy button.
///
/// **The details are reachable in RELEASE too, on purpose.** This app has no
/// crash reporter and its analytics client is a no-op stub, so a production
/// build has nowhere else to put an exception; the screen is the only channel
/// there is. A grey screen hit on TestFlight was otherwise unreportable except
/// as a photograph of a blank rectangle. They stay one tap down rather than on
/// the face of it, so an ordinary user meets a sentence and not a stack trace
/// — and the day a reporter is wired in, this is the affordance to drop.
///
/// **It is deliberately dependency-free.** No theme, no localization, no
/// providers, no assets, no `Scaffold`: it renders precisely when the tree is
/// already broken, and anything it reached for could be the thing that threw.
/// Its colours are inlined rather than imported from the theme layer it may be
/// reporting the failure of.
class KalloErrorWidget extends StatefulWidget {
  const KalloErrorWidget({required this.details, super.key});

  final FlutterErrorDetails details;

  static const Color surface = Color(0xFFF8F7F4);
  static const Color ink = Color(0xFF141413);
  static const Color muted = Color(0xFF7A7870);

  @override
  State<KalloErrorWidget> createState() => _KalloErrorWidgetState();
}

class _KalloErrorWidgetState extends State<KalloErrorWidget> {
  /// Open from the start anywhere but release, where whoever is looking at it
  /// is already a developer.
  late bool _revealed = !kReleaseMode;
  bool _copied = false;
  bool _copyFailed = false;

  /// Exception, library and stack — everything a report needs, which is more
  /// than the screen can legibly show.
  String get _report => [
    widget.details.exceptionAsString(),
    if (widget.details.library != null) 'library: ${widget.details.library}',
    if (widget.details.stack != null) '\n${widget.details.stack}',
  ].join('\n');

  /// Caught, not propagated. `_tap` takes a [VoidCallback] and therefore
  /// DISCARDS this future, so a rejected `Clipboard.setData` — a platform with
  /// no clipboard implementation, a `MissingPluginException` — would surface
  /// as an unhandled async error raised BY the screen that exists to report
  /// errors. It says so on the button instead.
  Future<void> _copy() async {
    try {
      await Clipboard.setData(ClipboardData(text: _report));
      if (mounted) setState(() => _copied = true);
    } catch (_) {
      if (mounted) setState(() => _copyFailed = true);
    }
  }

  String get _copyLabel => _copyFailed
      ? 'Copy failed'
      : _copied
      ? 'Copied'
      : 'Copy details';

  @override
  Widget build(BuildContext context) {
    // The incoming height decides the layout, because this widget replaces
    // whatever threw — INCLUDING a child of a ListView or another Column,
    // where the height is unbounded. A `Flexible` there is a non-zero flex
    // under infinite space, which is a layout assertion: the error surface
    // would then throw on its own account, from inside the error path, which
    // is the one thing it must never do.
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, constraints) => _body(constraints.hasBoundedHeight),
      ),
    );
  }

  Widget _body(bool bounded) => ColoredBox(
    color: KalloErrorWidget.surface,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 64),
      child: Column(
        // `max` would ask for infinite height when there is none to be had.
        mainAxisSize: bounded ? MainAxisSize.max : MainAxisSize.min,
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
              color: KalloErrorWidget.ink,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Close Kallo and open it again. Your data is safe — nothing '
            'was lost.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              height: 1.4,
              color: KalloErrorWidget.muted,
            ),
          ),
          const SizedBox(height: 20),
          if (!_revealed)
            _tap('Show details', () => setState(() => _revealed = true))
          else ...[
            // Scrolls within the space it has when there IS space; otherwise
            // it simply takes its own height and whatever contains it scrolls.
            if (bounded)
              Flexible(child: SingleChildScrollView(child: _reportText))
            else
              _reportText,
            const SizedBox(height: 16),
            _tap(_copyLabel, _copy),
          ],
        ],
      ),
    ),
  );

  Widget get _reportText => Text(
    _report,
    style: const TextStyle(
      fontSize: 11,
      height: 1.35,
      color: KalloErrorWidget.ink,
      fontFamily: 'monospace',
    ),
  );

  /// A tap target built from primitives — no `TextButton`, which would want a
  /// Material ancestor this screen cannot assume it still has.
  Widget _tap(String label, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: SizedBox(
      height: 44,
      child: Center(
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            height: 1.3,
            color: KalloErrorWidget.muted,
            decoration: TextDecoration.underline,
            decorationColor: KalloErrorWidget.muted,
          ),
        ),
      ),
    ),
  );
}

/// Installs [KalloErrorWidget] as the framework's build-failure surface.
///
/// `ErrorWidget.builder` is what the framework calls to BUILD the replacement
/// subtree; it reports nothing. `FlutterError.onError` is the report, and its
/// default already forwards to the console — left alone here, so a crash
/// reporter attached later still sees every error exactly once.
void installKalloErrorWidget() {
  ErrorWidget.builder = (details) => KalloErrorWidget(details: details);
}
