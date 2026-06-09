/// FloatingMealTrigger — Flutter port of the web mobile FAB
/// (`components/dashboard/today/meal-trigger.tsx` `FloatingMealTrigger`,
/// rendered under `md:hidden`).
///
/// A fixed bottom-right FAB (44x44, radius 16, btn color, soft shadow,
/// UtensilsCrossed icon) that expands into a compact meal-input bar above it
/// (slide+fade in, 160ms). Submitting navigates to `/logging?meal=…`.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

class FloatingMealTrigger extends StatefulWidget {
  const FloatingMealTrigger({super.key});

  @override
  State<FloatingMealTrigger> createState() => _FloatingMealTriggerState();
}

class _FloatingMealTriggerState extends State<FloatingMealTrigger> {
  bool _expanded = false;
  bool _fabPressed = false;
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _open() {
    setState(() => _expanded = true);
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  void _close() {
    _focus.unfocus();
    setState(() => _expanded = false);
  }

  void _submit() {
    final meal = _controller.text.trim();
    if (meal.isEmpty) return;
    _controller.clear();
    _close();
    context.go('/logging?meal=${Uri.encodeComponent(meal)}');
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Expanding meal-input bar: fixed right-4 bottom-20 left-4.
        Positioned(
          left: NhamSpacing.sp4, // left-4
          right: NhamSpacing.sp4, // right-4
          bottom: 80, // bottom-20
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 160),
            transitionBuilder:
                (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(
                    // y 8 → 0.
                    position: Tween<Offset>(
                      begin: const Offset(0, 8 / 44),
                      end: Offset.zero,
                    ).animate(anim),
                    child: child,
                  ),
                ),
            child:
                _expanded
                    ? _MealInputBar(
                      key: const ValueKey('meal-input'),
                      controller: _controller,
                      focusNode: _focus,
                      onSubmit: _submit,
                    )
                    : const SizedBox.shrink(key: ValueKey('hidden')),
          ),
        ),

        // The FAB: fixed right-4 bottom-5, 44x44 rounded-2xl.
        Positioned(
          right: NhamSpacing.sp4, // right-4
          bottom: NhamSpacing.sp5, // bottom-5
          child: Semantics(
            button: true,
            label:
                _expanded
                    ? tr('dashboard.mealTrigger.close')
                    : tr('dashboard.logMeal'),
            child: GestureDetector(
              onTapDown: (_) => setState(() => _fabPressed = true),
              onTapUp: (_) => setState(() => _fabPressed = false),
              onTapCancel: () => setState(() => _fabPressed = false),
              onTap: _expanded ? _close : _open,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 44, // h-11 w-11
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _fabPressed ? NhamColors.btnHover : NhamColors.btn,
                  borderRadius: BorderRadius.circular(
                    NhamRadii.containerLg,
                  ), // 16
                  boxShadow: const [
                    // shadow-[0_4px_16px_rgba(44,36,22,0.18)].
                    BoxShadow(
                      color: Color(0x2E2C2416), // #2C2416 @ 18%
                      blurRadius: 16,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(
                  _expanded ? Icons.close : Icons.restaurant_outlined,
                  size: 20, // h-5 w-5
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Compact meal-input row (web `compact` → h-11): rounded-2xl, hairline border,
/// card bg, focus-within accent border, with an ArrowUp submit button.
class _MealInputBar extends StatefulWidget {
  const _MealInputBar({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSubmit;

  @override
  State<_MealInputBar> createState() => _MealInputBarState();
}

class _MealInputBarState extends State<_MealInputBar> {
  bool _sendPressed = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onText);
    widget.focusNode.addListener(_onFocus);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    widget.focusNode.removeListener(_onFocus);
    super.dispose();
  }

  void _onText() => setState(() {});
  void _onFocus() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final hasText = widget.controller.text.trim().isNotEmpty;
    final focused = widget.focusNode.hasFocus;

    return Container(
      height: 44, // compact h-11
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3), // px-3
      decoration: BoxDecoration(
        color: NhamColors.elev, // bg-card
        borderRadius: BorderRadius.circular(
          NhamRadii.containerLg,
        ), // rounded-2xl
        border: Border.all(
          // border-nham-border/70 → focus-within:border-nham-accent/50.
          color: focused ? NhamColors.accent50 : const Color(0xB3E8D5B5),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: widget.focusNode,
              maxLength: 300,
              cursorColor: NhamColors.accent,
              onSubmitted: (_) => widget.onSubmit(),
              style: NhamTextStyles.sansRegular(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: NhamColors.text),
              decoration: InputDecoration(
                counterText: '',
                isCollapsed: true,
                border: InputBorder.none,
                hintText: tr('logging.placeholder'),
                hintStyle: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.stone),
              ),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2), // gap-2
          // Submit: h-8 w-8 rounded-xl btn → hover btn-hover; disabled track.
          GestureDetector(
            onTapDown:
                hasText ? (_) => setState(() => _sendPressed = true) : null,
            onTapUp:
                hasText ? (_) => setState(() => _sendPressed = false) : null,
            onTapCancel: () => setState(() => _sendPressed = false),
            onTap: hasText ? widget.onSubmit : null,
            child: Container(
              width: 32, // h-8 w-8
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color:
                    !hasText
                        ? NhamColors.track
                        : (_sendPressed ? NhamColors.btnHover : NhamColors.btn),
                borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // 12
              ),
              child: Icon(
                Icons.arrow_upward,
                size: 16, // h-4 w-4
                color: hasText ? Colors.white : NhamColors.stone,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
