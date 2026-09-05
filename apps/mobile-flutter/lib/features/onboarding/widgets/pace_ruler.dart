import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/logic/display_format.dart' show formatOneDecimal, localeOf;
import '../../../shared/widgets/gauge/ruler/ruler_marks.dart';
import '../../../shared/widgets/gauge/ruler/ruler_painter.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';

/// The weekly-pace picker: a tape measure for "how fast" — the scale drags
/// under a fixed needle rather than a thumb travelling a track. Deliberately
/// NOT `RulerScale`, whose grams↔position curve is piecewise through vessel
/// anchors: pace is one even step, so `offset = (value - min) / step * pitch`.
class PaceRuler extends StatefulWidget {
  const PaceRuler({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
    required this.readout,
    required this.lowLabel,
    required this.highLabel,
    this.min = 0.1,
    this.max = 0.8,
    this.step = 0.1,
  });

  final double value;
  final ValueChanged<double> onChanged;

  /// The quiet left half of the readout line ("Pace") and the ink right half
  /// ("0.5 kg a week · 500 kcal deficit") — both formatted by the caller.
  final String label, readout;
  final String lowLabel, highLabel;
  final double min, max, step;

  /// 40pt per 0.1 — a deliberate drag per step, ~one viewport for 0.1–0.8.
  static const double pitchPerTenth = 40, stripHeight = 44;

  @override
  State<PaceRuler> createState() => _PaceRulerState();
}

class _PaceRulerState extends State<PaceRuler> {
  late final ScrollController _controller;
  late int _index;
  bool _selfDriven = false;

  int get _count => ((widget.max - widget.min) / widget.step).round() + 1;
  double get _pitch => widget.step / 0.1 * PaceRuler.pitchPerTenth;
  double get _contentWidth => _pitch * (_count - 1);
  List<double> get _majors => [for (var i = 0; i < _count; i++) i / (_count - 1)];

  int _indexOf(double v) =>
      ((v - widget.min) / widget.step).round().clamp(0, _count - 1);
  double _valueAt(int i) => widget.min + i * widget.step;
  String _stepLabel(int i) =>
      formatOneDecimal(_valueAt(i.clamp(0, _count - 1)), localeOf(context));

  @override
  void initState() {
    super.initState();
    _index = _indexOf(widget.value);
    _controller = ScrollController(initialScrollOffset: _index * _pitch)
      ..addListener(_onScroll);
  }

  // Chase an OUTSIDE change only; our own scroll would fight the drag.
  @override
  void didUpdateWidget(PaceRuler old) {
    super.didUpdateWidget(old);
    final int i = _indexOf(widget.value);
    if (i == _index || !_controller.hasClients) return;
    if (_controller.position.isScrollingNotifier.value) return;
    setState(() => _index = i);
    _settle();
  }

  @override
  void dispose() {
    _controller.dispose(); // Drops the listener with it.
    super.dispose();
  }

  /// The value is always a STEP: the strip slides on, the caller hears detents.
  void _onScroll() {
    if (_selfDriven || !_controller.hasClients) return;
    _moveTo((_controller.offset / _pitch).round(), settle: false);
  }

  void _nudge(int delta) => _moveTo(_index + delta, settle: true);

  void _moveTo(int raw, {required bool settle}) {
    final int i = raw.clamp(0, _count - 1);
    if (i == _index) return;
    // build reads _index (the slider's neighbours), so it is state.
    setState(() => _index = i);
    HapticFeedback.selectionClick();
    widget.onChanged(_valueAt(i));
    if (settle) _settle();
  }

  void _settle() {
    if (!mounted || !_controller.hasClients) return;
    final double target = _index * _pitch;
    if ((_controller.offset - target).abs() < 0.5) return;
    _selfDriven = true;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _controller.jumpTo(target);
      _selfDriven = false;
    } else {
      _controller
          .animateTo(target,
              duration: KalloMotion.quick, curve: KalloEase.decelerate)
          .whenComplete(() => _selfDriven = false);
    }
  }

  @override
  Widget build(BuildContext context) => Semantics(
        slider: true,
        label: widget.label,
        // Neighbours announce the bare step the graduation shows.
        value: widget.readout,
        increasedValue: _stepLabel(_index + 1),
        decreasedValue: _stepLabel(_index - 1),
        onIncrease: () => _nudge(1),
        onDecrease: () => _nudge(-1),
        child: ExcludeSemantics(
          child: Column(
            // Min: a greedy Column strands the strip at the top of the page.
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _line(widget.label, Text(widget.readout,
                  textAlign: TextAlign.end, style: dashBody(tabular: true))),
              const SizedBox(height: KalloSpacing.sp2),
              _strip(),
              const SizedBox(height: KalloSpacing.sp1),
              _line(widget.lowLabel, Text(widget.highLabel, style: dashMeta())),
            ],
          ),
        ),
      );

  Widget _line(String left, Widget right) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(left, style: dashMeta()), Flexible(child: right)],
      );

  Widget _strip() => LayoutBuilder(
        builder: (context, box) => Stack(
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none, // The needle's cap rides above the hairline.
          children: [
            NotificationListener<ScrollEndNotification>(
              // Deferred to a microtask: beginning an activity from inside
              // the notification that ENDED the last one re-enters the position.
              onNotification: (_) {
                if (!_selfDriven) Future.microtask(_settle);
                return false;
              },
              child: SingleChildScrollView(
                controller: _controller,
                scrollDirection: Axis.horizontal,
                // Half a viewport of lead-in, so the ends reach the needle.
                padding: EdgeInsets.symmetric(horizontal: box.maxWidth / 2),
                child: SizedBox(width: _contentWidth, child: _face(context)),
              ),
            ),
            Transform.translate(offset: Offset(0, -rulerNeedleCap.height),
                child: const IgnorePointer(child: RulerNeedle(bar: PaceRuler.stripHeight))),
          ],
        ),
      );

  Widget _face(BuildContext context) => Column(
        children: [
          CustomPaint(
            size: Size(_contentWidth, PaceRuler.stripHeight),
            // Minors halfway between the steps.
            painter: RulerPainter(
                majors: _majors, graduations: 2 * (_count - 1)),
          ),
          const SizedBox(height: KalloSpacing.sp1),
          SizedBox(
            // Scaled: a flat height clips the digits at the 1.3x type ceiling.
            height: MediaQuery.textScalerOf(context).scale(18),
            child: RulerBand(
              majors: _majors,
              width: _contentWidth,
              slotWidth: _pitch,
              child: (i) => Text(_stepLabel(i),
                  maxLines: 1, style: dashMeta(tabular: true)),
            ),
          ),
        ],
      );
}
