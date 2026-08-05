/// Shared geometry for the portion ruler.
///
/// **Deliberate divergence from web.** The web picker is a plain Radix slider —
/// a bar and a round thumb — which is the right control for a pointer and a
/// keyboard. On touch there is no hover, no arrow key and no focus ring, so the
/// bar carries none of that affordance and leaves the amount entirely to the
/// number. A graduated tape states the amount in the control itself. Recorded
/// in `apps/docs/mobile/architecture.md`; web keeps its slider.
library;

/// Clearance between the silhouettes and the needle's pointer cap, so the mark
/// points AT the art rather than touching it.
const double portionNeedleGap = 6;

/// Height of the ruler band.
const double portionRulerHeight = 22;

/// Minor graduations per anchor, setting the scale's density.
const int _minorsPerMajor = 8;

/// Total graduations across the whole scale, for [majorCount] anchors.
int portionGraduationCount(int majorCount) => _minorsPerMajor * majorCount;
