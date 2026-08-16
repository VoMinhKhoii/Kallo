# Kallo App — UI Kit

A click-through React recreation of the three primary surfaces of the Kallo product, faithful to the source codebase at https://github.com/VoMinhKhoii/Nham.

Open `index.html` directly in a browser. The kit ships as plain JSX loaded by Babel-standalone, so there is no build step.

## Surfaces

The kit boots into the **Landing** surface. Use the top-right segmented control to jump between:

1. **Landing** — fixed header, hero with typing-animation phone demo, CTA section, footer. Click *Get Started* to enter the authenticated app shell.
2. **Logging** — the natural-language meal composer. Type a meal and press Enter (or click ↑) to "analyze" it; the kit fakes the streaming stages and renders a `PersistedMealCard` into the timeline. The empty state's suggestion chips are wired up.
3. **Dashboard** — *Today's* calorie ring + macro bars + meal list, *Progress* weight chart (mocked SVG), and *Consistency* adherence heatmap (mocked grid). The floating mobile meal trigger is omitted; the inline trigger on dashboard is wired to navigate into Logging.

The left rail (`Sidebar`) is shown inside the app shell with working `Dashboard / Nutrition / Logging` route swapping. *Nutrition* shows a one-line "Coming soon in this kit" placeholder — the real screen exists in the repo but is deeper than this kit's scope.

## Components

Everything is split into small focused files. Names mirror the source:

- `tokens.js` — exported color/type/radius/shadow tokens. Just so the JSX never hard-codes a hex.
- `AppShell.jsx` — sidebar + main column layout
- `Sidebar.jsx` — expanded/collapsed rail + user menu footer
- `MealInput.jsx` — the rounded textarea + 32×32 umber submit button
- `MealCard.jsx` — collapsed/expanded persisted meal card with timeline dot
- `MealTrigger.jsx` — inline + floating meal trigger
- `TodayDock.jsx` — remaining-calories panel + calorie ring + macro bars + meal list
- `Heatmap.jsx` — 30-day adherence grid
- `WeightChart.jsx` — SVG sparkline placeholder
- `Landing.jsx` — header + hero + CTA + footer all in one file
- `LoggingScreen.jsx` — timeline sidebar + feed area
- `DashboardScreen.jsx` — composes Today / Progress / Consistency
- `NutritionScreen.jsx` — placeholder

## Faithfulness notes

- Tokens, font choice, spacing, radii, and shadows are pulled verbatim from `app/globals.css` of the source repo.
- Copy is from `messages/en.json`; sample data is from the hero's literal example string (`2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua`).
- Icons are `lucide@latest` loaded from CDN. The kit uses a `<i data-lucide="..."></i>` pattern after each render — the real product uses `lucide-react` components, but the resulting glyphs are identical.
- Animations are simplified (CSS transitions only). The real product uses `motion.dev` for spring entries; flag this as a known divergence.
- No real auth, no real persistence, no real Vietnamese meal database. Submitting a meal generates one of three canned responses and adds it to the timeline.

## What's NOT here

- The full streaming pipeline (`feed-area.tsx` is 17KB; we recreate the *post-saved* state, not the intermediate phases).
- Onboarding wizard (3 screens in the source: Origin / Body metrics / Cooking). Out of scope.
- Settings, admin, and the auth dialog.
- The Nutrition screen's full pattern analysis (macro pattern, micronutrient grid, food-idea drawer).
- Mobile mobile-timeline-picker / mobile bottom-nav. The kit is desktop-first.

Want any of these built out? Tell us which.
