import 'package:flutter/widgets.dart';

import '../../../../../../theme/calm_tokens.dart';

/// A camera that would not start, or a photo that could not be used: the
/// reason in words on the dark stage. The tools below stay live, so the user
/// can still type the barcode, pick from the library or enter the food.
class ScanCameraProblem extends StatelessWidget {
  const ScanCameraProblem({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: dashBody(color: const Color(0xFFFFFFFF)),
        ),
      ),
    );
  }
}
