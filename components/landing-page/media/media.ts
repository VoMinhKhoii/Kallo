export interface LandingClip {
  src: string;
  /** A lighter encode for phones, where the full one would be wasted. */
  mobileSrc?: string;
  poster: string;
}

const clipLocale = (locale: string) => (locale === 'vi' ? 'vi' : 'en');

/** Clips cut from the launch film, one set per language. */
export function landingClip(
  locale: string,
  name: 'log' | 'diff' | 'barcode' | 'relog' | 'label' | 'micro',
  { mobile = name === 'log' || name === 'diff' } = {}
): LandingClip {
  const base = `/landing/video/${clipLocale(locale)}/${name}`;
  return {
    src: `${base}.mp4`,
    mobileSrc: mobile ? `${base}-sm.mp4` : undefined,
    poster: `${base}.webp`,
  };
}

/** The log clip's opening frame, one crop per screen shape. */
export function heroStill(locale: string) {
  const base = `/landing/video/${clipLocale(locale)}/log`;
  return { phone: `${base}-sm.webp`, wide: `${base}.webp` };
}

/** A real capture of the iPhone app in the visitor's language. */
export const appScreen = (
  locale: string,
  screen: 'circle' | 'home' | 'nutrition'
) => `/landing/app/${clipLocale(locale)}-${screen}.webp`;
