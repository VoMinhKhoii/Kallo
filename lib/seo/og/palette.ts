/**
 * Colour vocabulary for the Satori-rendered share cards.
 *
 * These are the Kallo warm palette from `app/globals.css :root`, copied out as
 * literal hex. Satori is not a browser: it never resolves `var(--kallo-*)`, so
 * a token referenced by name renders as nothing. Keeping the literals in one
 * named module is the compromise — the duplication stays visible and reviewable
 * in a single place instead of being scattered through a route handler.
 *
 * When a brand colour changes in `globals.css`, change it here in the same PR.
 */
export const OG_COLORS = {
  surface: '#fcfcfc',
  text: '#141413',
  textMuted: '#6e6d66',
  accent: '#c9a87c',
  border: '#e8e6dc',
  track: '#ecece9',
  stone: '#a8a29e',
  macroProtein: '#c9a87c',
  macroCarbs: '#8b7355',
  macroFat: '#a8a29e',
} as const;

/**
 * Deterministic warm dish-color swatch seeded from the same avatar_seed that
 * feeds the initials avatar — gives each card a distinct appetite-toned accent
 * with zero photography. Hue is constrained to the warm 20–55° band so it
 * always reads on-brand against the cream surface.
 */
export function dishColorFromSeed(seed: string | null): string {
  const source = seed && seed.length > 0 ? seed : 'nham';
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  const hue = 20 + (Math.abs(hash) % 36); // 20°–55° (amber → terracotta)
  return `hsl(${hue}, 46%, 58%)`;
}
