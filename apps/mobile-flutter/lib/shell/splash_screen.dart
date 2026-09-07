import 'package:flutter/material.dart';

import '../theme/kallo_colors.dart';
import '../theme/kallo_typography.dart';

/// Cream splash shown on the index route while the redirect resolves. The
/// first frame of brand: the Lora "Kallo" wordmark breathing gently on the cream
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
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wordmark = Text(
      'Kallo',
      style: KalloTextStyles.serifRegular(
        fontSize: 32,
      ).copyWith(color: KalloColors.text),
    );
    return ColoredBox(
      color: KalloColors.surface,
      child: Center(
        child: FadeTransition(
          opacity: Tween<double>(begin: 0.5, end: 1.0).animate(
            CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
          ),
          child: wordmark,
        ),
      ),
    );
  }
}
