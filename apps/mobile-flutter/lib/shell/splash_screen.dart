import 'package:flutter/material.dart';

import '../shared/widgets/brand/kallo_wordmark.dart';
import '../theme/kallo_colors.dart';

/// Cream splash shown on the index route while the redirect resolves. The
/// first frame of brand: the [KalloWordmark] breathing gently on the cream
/// surface, instead of a generic Material spinner. The cream background matches
/// the native LaunchScreen so the native→Flutter handoff is seamless.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  // Built once with the controller, not in build: a CurvedAnimation is a
  // listener on its parent and owes a dispose of its own.
  late final CurvedAnimation _curve = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeInOut,
  );
  late final Animation<double> _opacity = Tween<double>(
    begin: 0.5,
    end: 1,
  ).animate(_curve);

  @override
  void initState() {
    super.initState();
    // Gentle breathing pulse, paused under reduced-motion.
    if (!WidgetsBinding
        .instance
        .platformDispatcher
        .accessibilityFeatures
        .disableAnimations) {
      _controller.repeat(reverse: true);
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _curve.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The drawn mark, not a serif setting of the word — the wordmark IS the
    // brand's one typographic voice and Lora no longer speaks for it.
    const wordmark = KalloWordmark(height: 26);
    return ColoredBox(
      color: KalloColors.surface,
      child: Center(child: FadeTransition(opacity: _opacity, child: wordmark)),
    );
  }
}
