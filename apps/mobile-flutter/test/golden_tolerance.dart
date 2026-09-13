import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_fonts.dart';
import 'l10n_test_loader.dart';

/// Differing pixels a golden may drift by before it fails.
///
/// Deliberately an ABSOLUTE count, not a percentage. The unit of change that
/// matters is a feature — a 12pt legend swatch is 144px whatever canvas it sits
/// on — while a percentage scales with the canvas, so the same real regression
/// reads as 0.51% of the legend strip and 0.12% of the whole card. A 0.5%
/// budget was measured letting a whole-card golden pass a legend swatch that
/// had lost its gradient entirely.
///
/// Sized against the SMALLEST regression these goldens must catch: a 1px ring
/// appearing or vanishing on a 12pt swatch moves ~44px. 32 keeps a margin under
/// that while still absorbing a few antialiased edge pixels. It is headroom for
/// noise, not an allowance for change — and it only has to cover noise at all
/// because these images are compared on the platform they were generated on
/// (see the `onLinuxOnly` note below).
const int _pixelBudget = 32;

/// Why a golden may only be compared where it was generated.
///
/// A golden is a byte comparison against one rasteriser's output. Flutter's
/// version and the OS both feed that, and CI runs `flutter test` on
/// ubuntu-latest — so these images are generated on Linux and are authoritative
/// there. Run them on a macOS checkout and text rasterises differently enough
/// to move thousands of pixels, which no budget can or should absorb: the
/// result is a red suite on a change that altered nothing, and a team that
/// learns to ignore goldens. Skipping is the honest outcome — CI still gates
/// every one of them.
///
/// Regenerate with `flutter test --update-goldens` on Linux, never from a mac.
///
/// A `bool`, not a reason string: `testWidgets` types `skip` as `bool?` (unlike
/// `test`, which takes either), so the explanation has to live here.
final bool skipOffGoldenPlatform = !Platform.isLinux;

/// The whole golden setup in one call: the l10n binding, both font families and
/// the budgeted comparator.
///
/// Bundled deliberately. Three of the four are silently-wrong-if-forgotten —
/// missing text weights render as the nearest face, missing icon fonts render
/// as tofu, and a missing comparator compares exactly — so each one omitted
/// bakes a WRONG PICTURE into the golden, which is the precise failure these
/// tests exist to prevent. A checklist in a doc is not a mechanism.
void setUpGoldens() {
  setUpL10nBinding();
  setUpAll(() async {
    await loadAppFonts();
    await loadIconFonts();
    useTolerantGoldens();
  });
}

/// Installs the budgeted comparator. Prefer [setUpGoldens].
void useTolerantGoldens() {
  final local = goldenFileComparator;
  if (local is! LocalFileComparator) {
    throw StateError(
      'Expected the default LocalFileComparator, got ${local.runtimeType}. '
      'Golden paths are resolved from its basedir, so this helper cannot wrap '
      'a comparator that does not expose one.',
    );
  }
  goldenFileComparator = _BudgetedComparator(
    Uri.parse('${local.basedir}placeholder_test.dart'),
  );
}

class _BudgetedComparator extends LocalFileComparator {
  _BudgetedComparator(super.testFile);

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    try {
      if (result.passed) return true;

      // `ComparisonResult` exposes only the fraction, so scale it back up by
      // the master's pixel count — which `compareLists` already decoded and
      // handed back, on both of its failing paths.
      final master = result.diffs!['masterImage']!;
      final differing =
          (result.diffPercent * master.width * master.height).round();
      if (differing <= _pixelBudget) return true;

      // Writes the isolated diff PNGs beside the golden so a failure is
      // inspectable rather than just a number.
      throw FlutterError(
        '${await generateFailureOutput(result, golden, basedir)}\n'
        '$differing px differ, budget $_pixelBudget px.',
      );
    } finally {
      // The framework's own LocalFileComparator disposes before it throws; the
      // failure path holds four ui.Images (~2MB at card size), so skipping it
      // leaks on exactly the runs that go on to render more diffs.
      result.dispose();
    }
  }
}
