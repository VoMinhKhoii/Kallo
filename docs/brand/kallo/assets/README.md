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

## Rasters

The SVGs above are the only sources kept here; the platform rasters generated
from them live directly at their wired locations (regenerate from the SVGs —
render `app-icon.svg` at the target size, with rounded corners baked for the
splash tiles):

| Wired location | Contents |
| --- | --- |
| `app/favicon.ico` | 16/32/48 multi-size ICO from the app-icon tile |
| `public/apple-icon.png`, `public/icon-{192,512}.png`, `public/icon-maskable-512.png` | Web manifest + touch icons |
| `public/og-image.png` | 1200×630 Open Graph / Twitter card |
| `apps/mobile-flutter/ios/Runner/Assets.xcassets/AppIcon.appiconset/` | Full iOS icon set (15 sizes, no alpha) |
| `apps/mobile-flutter/ios/Runner/Assets.xcassets/LaunchImage.imageset/` | Splash tile 1x/2x/3x (rounded corners baked) |
| `apps/mobile-flutter/android/.../mipmap-*/ic_launcher.png` | Launcher icons, 5 densities |
| `apps/mobile-flutter/android/.../drawable-*/launch_image.png` | Splash tiles, 5 densities |
| `apps/mobile-flutter/web/icons/`, `apps/mobile-flutter/web/favicon.png` | Flutter web icons |

The lockup rule: the mark is never placed next to the wordmark (the wordmark's
capital *is* the mark). Use the mark alone for icons and tight spaces, the
wordmark everywhere the name appears.
