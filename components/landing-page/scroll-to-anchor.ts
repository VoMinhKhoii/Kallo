// Smooth-scroll to an in-page landing anchor, honoring reduced-motion
// (instant jump for users who opt out). Same pattern as the header nav
// anchors; sections offset the fixed header via scroll-margin.
export function scrollToAnchorId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  target.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
    block: 'start',
  });
}
