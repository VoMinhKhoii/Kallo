import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../services/env/env.dart';
import '../providers/turnstile_controller.dart';

/// Whether an HTTP error response ends the check: one for our own page (or
/// one WebKit cannot attribute) means the page will never post a token; one
/// from Cloudflare's challenge iframe is the widget's own business.
@visibleForTesting
bool httpErrorEndsTurnstileCheck(Uri? failed, Uri page) =>
    failed == null || _isPage(failed, page);

bool _isPage(Uri uri, Uri page) =>
    uri.host == page.host && uri.path == page.path;

/// Cloudflare Turnstile for the email forms, in a web view.
///
/// Cloudflare: "For native mobile applications, Turnstile does not run
/// natively" — it runs in a web view, on a hostname the widget allows. So this
/// loads `<API_BASE_URL>/auth/turnstile` (kallo.fit in every release build) and
/// relays the page's messages to [controller].
///
/// It is 1pt tall — invisible, but laid out, so the check runs — until
/// Cloudflare asks for a click; then it opens to the widget's own height.
/// Nothing is drawn when the check is off ([TurnstileController.required]).
class TurnstileView extends StatefulWidget {
  const TurnstileView({super.key, required this.controller});

  final TurnstileController controller;

  /// Turnstile's interactive widget is 65pt tall; this leaves it a margin.
  static const double interactiveHeight = 72;

  @override
  State<TurnstileView> createState() => _TurnstileViewState();
}

class _TurnstileViewState extends State<TurnstileView> {
  WebViewController? _web;

  /// Hosts the page may load: its own (main frame) and Cloudflare's challenge
  /// iframe. Everything else is refused, so the view can never wander off.
  static const _challengeHost = 'challenges.cloudflare.com';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_web != null || !widget.controller.required) return;

    final page = Uri.parse('${Env.apiBaseUrl}/auth/turnstile').replace(
      queryParameters: {
        'lang': context.locale.languageCode,
        'theme':
            Theme.of(context).brightness == Brightness.dark ? 'dark' : 'light',
      },
    );

    final web =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.transparent)
          ..addJavaScriptChannel(
            'KalloTurnstile',
            onMessageReceived:
                (m) => widget.controller.handleMessage(m.message),
          )
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest:
                  (request) =>
                      _allowed(request, page)
                          ? NavigationDecision.navigate
                          : NavigationDecision.prevent,
              onWebResourceError: (error) {
                if (error.isForMainFrame ?? true) {
                  widget.controller.markFailed();
                }
              },
              // A 403/503 from our own page is a loaded error document, not a
              // resource error: it never posts a token, so without this the
              // forms would wait on it forever.
              onHttpError: (error) {
                if (httpErrorEndsTurnstileCheck(error.request?.uri, page)) {
                  widget.controller.markFailed();
                }
              },
            ),
          )
          ..loadRequest(page);
    widget.controller.attach(
      () => web.runJavaScript(
        'window.kalloTurnstileReset && window.kalloTurnstileReset()',
      ),
    );
    _web = web;
  }

  static bool _allowed(NavigationRequest request, Uri page) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) return false;
    if (request.isMainFrame) return _isPage(uri, page);
    return uri.host == _challengeHost || uri.scheme == 'about';
  }

  @override
  void dispose() {
    widget.controller.detach();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final web = _web;
        if (web == null || !widget.controller.required) {
          return const SizedBox.shrink();
        }
        return AnimatedSize(
          duration: const Duration(milliseconds: 200),
          child: SizedBox(
            height:
                widget.controller.interactive
                    ? TurnstileView.interactiveHeight
                    : 1,
            child: WebViewWidget(controller: web),
          ),
        );
      },
    );
  }
}
