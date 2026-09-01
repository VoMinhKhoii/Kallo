import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

/// The pre-auth typing demo: a Vietnamese meal string types itself in, then a
/// small result chip springs in with a point calorie value.
///
/// Mirrors the landing hero's real typing animation (50ms/char, then an 800ms
/// pause before the AI response springs in) — the one decorative flourish on the
/// welcome screen, and the product's pitch in a single glance. Per the founder
/// direction the result is a single point value (no range, no confidence label).
/// Respects reduced-motion by showing the resolved end-state immediately.
class WelcomeDemo extends StatefulWidget {
  const WelcomeDemo({super.key});

  @override
  State<WelcomeDemo> createState() => _WelcomeDemoState();
}

class _WelcomeDemoState extends State<WelcomeDemo>
    with SingleTickerProviderStateMixin {
  String _full = '';
  int _typed = 0;
  bool _resolved = false;
  Timer? _timer;

  late final AnimationController _chip;

  bool get _reducedMotion =>
      WidgetsBinding
          .instance
          .platformDispatcher
          .accessibilityFeatures
          .disableAnimations;

  @override
  void initState() {
    super.initState();
    _chip = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final full = tr('auth.welcome.demoMeal');
    if (full == _full) return;

    _timer?.cancel();
    _full = full;
    if (_reducedMotion) {
      _typed = _full.length;
      _resolved = true;
      _chip.value = 1;
      return;
    }
    _typed = 0;
    _resolved = false;
    _chip.reset();
    _startTyping();
  }

  void _startTyping() {
    _timer = Timer.periodic(const Duration(milliseconds: 50), (t) {
      if (!mounted) return;
      if (_typed >= _full.length) {
        t.cancel();
        // 800ms pause, then the result springs in.
        _timer = Timer(const Duration(milliseconds: 800), () {
          if (!mounted) return;
          setState(() => _resolved = true);
          _chip.forward();
        });
        return;
      }
      setState(() => _typed++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _chip.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      // A card, so it wears the card anatomy: white, radius 22, no border and
      // no shadow — on the #F8F7F4 canvas the surface alone separates it.
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The user's words, in Lora — the loudest thing on the screen.
          Text(
            _full.substring(0, _typed),
            style: KalloTextStyles.serifRegular(
              fontSize: KalloFontSize.lg,
              height: KalloLeading.snug,
            ).copyWith(color: KalloColors.text),
          ),
          const SizedBox(height: 14),
          // The point result chip springs in once typing resolves.
          AnimatedSize(
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOut,
            alignment: Alignment.centerLeft,
            child:
                _resolved
                    ? FadeTransition(
                      opacity: _chip,
                      child: ScaleTransition(
                        scale: Tween<double>(begin: 0.92, end: 1).animate(
                          CurvedAnimation(parent: _chip, curve: Curves.easeOut),
                        ),
                        alignment: Alignment.centerLeft,
                        child: _resultChip(),
                      ),
                    )
                    : const SizedBox(height: 0, width: double.infinity),
          ),
        ],
      ),
    );
  }

  Widget _resultChip() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp3,
        vertical: KalloSpacing.sp1_5,
      ),
      // Beige, the warm "this is the answer" family the button system uses for
      // every selected state — not the tan accent wash, which the native pass
      // reserves for rings, chart strokes and focus.
      decoration: BoxDecoration(
        color: KalloColors.btnPrimarySoft,
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
      child: Text(
        tr('auth.welcome.demoResult', namedArgs: {'kcal': '620'}),
        style: dashBody(weight: FontWeight.w500),
      ),
    );
  }
}
