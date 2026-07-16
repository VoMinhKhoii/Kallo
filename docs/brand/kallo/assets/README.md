# Kallo brand assets

Production assets generated from the approved segmented K
(see `../exploration/README.md` for the geometry and its rationale).
Palette: cream `#FEFBF6`, espresso `#2C2416`, tan `#C9A87C`, umber `#695E4E`.

## Sources (SVG)

| File | What |
| --- | --- |
| `kallo-mark.svg` | The K symbol, 656×708, `currentColor` |
| `kallo-mark-{espresso,cream,black,white}.svg` | Baked-fill variants |
| `kallo-wordmark.svg` | Full wordmark with the segmented K as its capital, 2180×812, `currentColor` |
| `kallo-wordmark-{espresso,cream,black,white}.svg` | Baked-fill variants |
| `app-icon.svg` | 1024 full-bleed espresso tile, cream mark at 50% height (iOS master — Apple applies the corner mask) |
| `app-icon-maskable.svg` | Same tile, mark at 40% height (PWA maskable / Android adaptive safe zone) |
| `android-adaptive-foreground.svg` | Cream mark at 40% on transparency; pair with solid `#2C2416` background layer |
| `favicon.svg` | Mark alone; espresso by default, cream under `prefers-color-scheme: dark` |
| `og-image.svg` | 1200×630 social card, wordmark on cream |

## Rasters (`png/`)

| File | Target |
| --- | --- |
| `app-icon-1024.png` | iOS app icon master |
| `icon-512.png`, `icon-192.png` | Web manifest icons (replaces `public/icon-*.png`) |
| `icon-maskable-512.png` | Web manifest maskable icon |
| `apple-touch-icon-180.png` | `public/apple-icon.png` |
| `favicon.ico` (16/32/48), `favicon-{16,32,48}.png` | `app/favicon.ico` |
| `android-adaptive-foreground-512.png` | Flutter/Android adaptive foreground layer |
| `og-image-1200x630.png` | Open Graph / Twitter card |

The lockup rule: the mark is never placed next to the wordmark (the wordmark's
capital *is* the mark). Use the mark alone for icons and tight spaces, the
wordmark everywhere the name appears.
