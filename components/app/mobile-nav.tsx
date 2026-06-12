'use client';

/**
 * Mobile header row — reserves the top strip on narrow screens and hosts the
 * right-slot that logging's date-chip / timeline picker portals into.
 *
 * Primary navigation moved to the bottom tab bar (`bottom-tab-bar.tsx`); the
 * old hamburger drawer was retired. This component now only preserves the
 * header-slot contract (and its strip-mode width handoff) so the logging
 * date-chip morph keeps working.
 */
export function MobileNav() {
  return (
    <header className="group/mobileheader mb-1 flex items-center gap-2 md:hidden">
      {/* Mobile header right-slot. Filled by MobileTimelinePicker via React
          portal — see mobile-timeline-picker.tsx. Strip-mode contract: when the
          picker enters strip mode it sets `data-strip-mode="true"` on its
          portaled root and the spacers below drop out so the strip can use the
          full row width. */}
      <div
        id="app-mobile-header-slot"
        className="flex min-w-0 flex-1 items-center justify-center"
      />
    </header>
  );
}
