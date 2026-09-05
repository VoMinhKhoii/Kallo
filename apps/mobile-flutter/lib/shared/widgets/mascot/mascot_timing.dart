/// The bun mascot's frames and its one set of timing constants.
///
/// Ported from the motion study (`motion2/bun-motion.html`). Tune these
/// **together**: the gesture rhythm lives in the ratios, not in any single
/// number — a longer lid close with the same hold reads as a slow eye, a
/// shorter viseme hold with the same char rate reads as a stutter.
library;

// ── Frames ────────────────────────────────────────────────────────────────
// Three 360x332 transparent WebPs of the SAME body. Only the face differs, so
// the base frame stays fully opaque and the other two are composited on top —
// cross-fading two frames would dip the body's alpha and read as a flicker.
const String kBunBaseFrame = 'assets/mascot/bun_base.webp'; // eyes open, smile
const String kBunBlinkFrame = 'assets/mascot/bun_blink.webp'; // eyes closed
const String kBunWideFrame = 'assets/mascot/bun_wide.webp'; // mouth open, "ah"

/// The frames' aspect ratio — `size` is a WIDTH, the height follows from this.
const double kBunFrameAspect = 360 / 332;

// ── Speech ────────────────────────────────────────────────────────────────

/// One character every 30 ms — the typewriter's rate.
const Duration kBunChar = Duration(milliseconds: 30);

/// The caret's full on/off period. A hard step, never a fade.
const Duration kBunCaret = Duration(milliseconds: 800);

/// A mouth shape holds at least this long. Below it the mouth flickers faster
/// than the eye resolves and the bun reads as buzzing rather than talking.
const Duration kBunViseme = Duration(milliseconds: 70);

/// Punctuation closes the mouth and rests the type loop for this long, on top
/// of [kBunChar]. It is what gives a sentence its clauses.
const Duration kBunPunctuation = Duration(milliseconds: 120);

// ── Blink ─────────────────────────────────────────────────────────────────

/// A blink is scheduled randomly in this window after the previous one.
const Duration kBunBlinkMin = Duration(milliseconds: 2500);
const Duration kBunBlinkMax = Duration(milliseconds: 5000);

/// The lid is asymmetric: it drops faster than it lifts.
const Duration kBunLidClose = Duration(milliseconds: 55);
const Duration kBunLidHoldMin = Duration(milliseconds: 80);
const Duration kBunLidHoldMax = Duration(milliseconds: 100);
const Duration kBunLidOpen = Duration(milliseconds: 95);

/// One blink in five is a double.
const double kBunDoubleChance = 0.2;
const Duration kBunDoubleGap = Duration(milliseconds: 140);

/// A blink never STARTS within this of a mouth change (and a pending blink
/// closes the mouth first, then waits it out). An eyelid landing on the same
/// frame as a viseme swap reads as a glitch, not as a face.
const Duration kBunGuard = Duration(milliseconds: 200);

/// The settling blink, this long after the widget mounts — it is also the one
/// that lands just before speech gets going.
const Duration kBunMountBlink = Duration(milliseconds: 300);

// ── Idle ──────────────────────────────────────────────────────────────────

/// One breath: scale 1.00 → 1.03 → 1.00 over 4 s, origin bottom centre.
const Duration kBunBreath = Duration(milliseconds: 4000);

/// `1 + a * (1 - cos t)` peaks at `1 + 2a`, so 0.015 gives the 1.03 top.
const double kBunBreathAmplitude = 0.015;
