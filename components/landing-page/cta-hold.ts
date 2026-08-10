/**
 * Whether the landing page's auth call-to-actions actually do anything.
 *
 * Set to `false` while sign-up is held back. Every CTA on the page still
 * renders — the header's "Sign in" and "Get started", and each plan's button —
 * but they are `disabled` rather than merely inert. That distinction is the
 * point: a button that looks live and swallows the click reads as a broken
 * page, and it is invisible to a screen reader and to the keyboard, which would
 * still tab to it and still get nothing. `disabled` says "not yet" in every
 * mode at once.
 *
 * One switch, deliberately, so turning the page back on is a single edit rather
 * than a hunt through the header, the hero and three plan cards.
 */
export const AUTH_CTAS_LIVE = false;
