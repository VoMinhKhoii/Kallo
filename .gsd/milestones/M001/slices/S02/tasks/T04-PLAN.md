# T04: 02-onboarding 04

**Slice:** S02 — **Milestone:** M001

## Description

Build the settings profile editor (edit all onboarding fields post-wizard) and the onboarding nudge system (home card for incomplete onboarding + time-based nudge dialog).

Purpose: ONB-07 requires the profile to be "editable from settings at any time." The nudge system gently prompts users who haven't completed onboarding without blocking app access.
Output: Working settings page + dismissible home card + nudge dialog.

## Must-Haves

- [ ] "User can access settings page from sidebar and edit all profile fields"
- [ ] "Settings editor loads existing profile data and saves updates via server action"
- [ ] "Settings shows per-protein fat-trim controls (3 separate fields)"
- [ ] "Changing goal/aggression/carbSplit recomputes calorieTarget from TDEE (overwrites manual edits)"
- [ ] "Incomplete-onboarding card appears on home page, dismissible with 7-day expiry"
- [ ] "Nudge dialog triggers after 7 days with cap of 2 dismissals (SSR-safe)"

## Files

- `app/(app)/settings/page.tsx`
- `components/onboarding/profile-editor.tsx`
- `components/onboarding/onboarding-card.tsx`
- `components/onboarding/nudge-dialog.tsx`
- `components/onboarding/onboarding-prompt.tsx`
- `app/(app)/logging/page.tsx`
- `lib/onboarding/actions.ts`
- `components/app/main-sidebar.tsx`
