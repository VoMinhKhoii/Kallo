import { GLOBE_COUNTRIES, type GlobeCountry } from './globe-dishes';

/**
 * The continent tour: each stop steers the globe to face a continent
 * while its most cuisine-diverse countries fan out as flag cards on both
 * sides of the sphere. Focus centroids are eyeballed "camera-worthy"
 * facings, not geographic centroids — they frame the member countries.
 */

export interface TourStop {
  id: string;
  continent: string;
  /** Serif-worthy line about that continent's food. */
  tagline: string;
  /** Facing the globe steers to while this stop is active. */
  focus: { lat: number; lng: number };
  /** Member countries, in card order (even index → left column). */
  isos: readonly string[];
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: 'asia',
    continent: 'Asia',
    tagline: 'Where every street corner simmers.',
    focus: { lat: 22, lng: 95 },
    isos: ['VNM', 'JPN', 'CHN', 'IND', 'THA', 'KOR'],
  },
  {
    id: 'europe',
    continent: 'Europe',
    tagline: 'Centuries of craft, plated one region at a time.',
    focus: { lat: 45, lng: 12 },
    isos: ['ITA', 'FRA', 'ESP', 'GRC', 'TUR'],
  },
  {
    id: 'africa',
    continent: 'Africa',
    tagline: 'Spice routes, slow fires and food built for sharing.',
    focus: { lat: 6, lng: 16 },
    isos: ['MAR', 'ETH', 'NGA', 'SEN'],
  },
  {
    id: 'americas',
    continent: 'The Americas',
    tagline: 'From street carts to open fires, a hemisphere of flavor.',
    focus: { lat: 8, lng: -78 },
    isos: ['MEX', 'PER', 'BRA', 'USA', 'ARG'],
  },
  {
    id: 'oceania',
    continent: 'Oceania',
    tagline: 'Smoke from the earth, salt from the sea.',
    focus: { lat: -26, lng: 140 },
    isos: ['AUS', 'NZL'],
  },
];

export function tourCountries(stop: TourStop): GlobeCountry[] {
  return stop.isos
    .map((iso) => GLOBE_COUNTRIES[iso])
    .filter((country): country is GlobeCountry => Boolean(country));
}

export const TOUR_ISO_SETS: readonly ReadonlySet<string>[] = TOUR_STOPS.map(
  (stop) => new Set(stop.isos)
);

/**
 * Approximate visual centers per country — where the card's leader line
 * lands on the globe. Eyeballed toward each country's mass, not capitals.
 */
export const COUNTRY_PINS: Record<string, { lat: number; lng: number }> = {
  VNM: { lat: 16.5, lng: 106.5 },
  JPN: { lat: 36.5, lng: 138.5 },
  CHN: { lat: 34, lng: 104 },
  IND: { lat: 21.5, lng: 78.5 },
  THA: { lat: 15.5, lng: 101 },
  KOR: { lat: 36.4, lng: 127.9 },
  ITA: { lat: 42.8, lng: 12.5 },
  FRA: { lat: 46.6, lng: 2.4 },
  ESP: { lat: 40.2, lng: -3.7 },
  GRC: { lat: 39.2, lng: 22.3 },
  TUR: { lat: 39.1, lng: 35.2 },
  MAR: { lat: 31.6, lng: -6.9 },
  ETH: { lat: 8.9, lng: 39.7 },
  NGA: { lat: 9.2, lng: 8.4 },
  SEN: { lat: 14.4, lng: -14.5 },
  MEX: { lat: 23.8, lng: -102.4 },
  PER: { lat: -9.4, lng: -75 },
  BRA: { lat: -10.5, lng: -52.5 },
  USA: { lat: 39.5, lng: -98.6 },
  ARG: { lat: -34.5, lng: -64.5 },
  AUS: { lat: -25.4, lng: 134.2 },
  NZL: { lat: -42.5, lng: 172 },
};

export interface TourMarker {
  iso: string;
  lat: number;
  lng: number;
}

/**
 * Column assignment that keeps leader lines from crossing: the western
 * half of a stop's countries goes to the left column, eastern to the
 * right, and each column is ordered north→south — so card order matches
 * the countries' on-screen order and every elbow connector stays in its
 * own lane.
 */
export function arrangeStop(stop: TourStop): {
  left: GlobeCountry[];
  right: GlobeCountry[];
} {
  const byLng = [...stop.isos].sort(
    (a, b) => (COUNTRY_PINS[a]?.lng ?? 0) - (COUNTRY_PINS[b]?.lng ?? 0)
  );
  const split = Math.ceil(byLng.length / 2);
  const byLatDesc = (a: string, b: string) =>
    (COUNTRY_PINS[b]?.lat ?? 0) - (COUNTRY_PINS[a]?.lat ?? 0);
  const toCountries = (isos: string[]) =>
    isos
      .map((iso) => GLOBE_COUNTRIES[iso])
      .filter((country): country is GlobeCountry => Boolean(country));
  return {
    left: toCountries(byLng.slice(0, split).sort(byLatDesc)),
    right: toCountries(byLng.slice(split).sort(byLatDesc)),
  };
}

export function tourMarkers(stop: TourStop): TourMarker[] {
  return stop.isos
    .map((iso) => {
      const pin = COUNTRY_PINS[iso];
      return pin ? { iso, lat: pin.lat, lng: pin.lng } : null;
    })
    .filter((marker): marker is TourMarker => marker !== null);
}

/**
 * Story geometry shared by the hero layout and the globe scene: hero
 * screen + one screen per stop + the free-explore screen, scrolled over
 * STORY_SCROLL viewport-heights. scrollYProgress × STORY_SCROLL is the
 * "screens scrolled" axis every scroll-linked effect works in.
 */
export const STORY_SCREENS = TOUR_STOPS.length + 2;
export const STORY_SCROLL = STORY_SCREENS - 1;

/** Progress (0..1) at which stop `index` is centered in the viewport. */
export function stopCenter(index: number): number {
  return (index + 1) / STORY_SCROLL;
}

/**
 * How deep into night a longitude currently is: 0 at local solar noon,
 * 1 at local midnight, easing smoothly through dawn and dusk (cosine of
 * the solar hour — no hard transitions anywhere on the curve).
 */
export function solarDarkness(lng: number, utcHours: number): number {
  const solarHour = (((utcHours + lng / 15) % 24) + 24) % 24;
  return (1 - Math.cos((2 * Math.PI * (solarHour - 12)) / 24)) / 2;
}

/**
 * Scroll → darkness curve for the whole story: cream daylight in the
 * hero, each continent's REAL current day/night while it is faced
 * (interpolated between stops exactly like the globe's facing), and the
 * viewer's own local darkness on the free-explore stage. Built once per
 * mount from the actual clock.
 */
export function makeDarknessCurve(now: Date): (progress: number) => number {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const stopDarkness = TOUR_STOPS.map((stop) =>
    solarDarkness(stop.focus.lng, utcHours)
  );
  // Viewer longitude approximated from the timezone offset.
  const viewerLng = (-now.getTimezoneOffset() / 60) * 15;
  const exploreDarkness = solarDarkness(viewerLng, utcHours);
  const lastStop = TOUR_STOPS.length;

  return (progress: number) => {
    const s = progress * STORY_SCROLL;
    if (s <= 0.5) {
      return 0;
    }
    if (s < 1) {
      return stopDarkness[0] * ((s - 0.5) / 0.5);
    }
    if (s <= lastStop) {
      const f = Math.min(s - 1, TOUR_STOPS.length - 1);
      const i = Math.min(Math.floor(f), TOUR_STOPS.length - 2);
      const t = f - i;
      return stopDarkness[i] + (stopDarkness[i + 1] - stopDarkness[i]) * t;
    }
    const g = Math.min((s - lastStop) / 0.6, 1);
    const from = stopDarkness[TOUR_STOPS.length - 1];
    return from + (exploreDarkness - from) * g;
  };
}

/**
 * Continuous tour facing: as scroll moves between stops the target
 * lat/lng interpolates between their centroids (longitude via the
 * shortest arc), so the globe morphs continent to continent instead of
 * re-aiming at each screen boundary. Null outside the tour range (hero
 * and explore free-spin).
 */
export function tourFocusAt(
  progress: number
): { lat: number; lng: number } | null {
  const s = progress * STORY_SCROLL;
  if (s < 0.55 || s > TOUR_STOPS.length + 0.45) {
    return null;
  }
  const f = Math.min(Math.max(s - 1, 0), TOUR_STOPS.length - 1);
  const i = Math.min(Math.floor(f), TOUR_STOPS.length - 2);
  const t = f - i;
  const a = TOUR_STOPS[i].focus;
  const b = TOUR_STOPS[i + 1].focus;
  const lngDelta = ((b.lng - a.lng + 540) % 360) - 180;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + lngDelta * t,
  };
}
