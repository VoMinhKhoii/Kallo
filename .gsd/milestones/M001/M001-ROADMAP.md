# M001: v1 MVP

**Vision:** Nhẩm is a web application where Vietnamese users describe their meals in natural language — exactly as they'd explain to a friend — and receive structured macro and micronutrient estimates powered by an AI pipeline grounded in verified Vietnamese nutritional data.

## Success Criteria


## Slices

- [x] **S01: Database Schema Infrastructure** `risk:medium` `depends:[]`
  > After this: All data structures and search infrastructure are in place for the app's features.
- [x] **S02: Onboarding** `risk:medium` `depends:[S01]`
  > After this: New users can set up their nutritional profile so the AI pipeline has the personal context it needs for accurate estimates.
- [ ] **S03: Ai Pipeline** `risk:medium` `depends:[S02]`
  > After this: The system can analyze a Vietnamese meal description and produce a grounded, bounded nutrition estimate with transparent assumptions.
- [ ] **S04: Meal Logging** `risk:medium` `depends:[S03]`
  > After this: Users can log meals via natural language, review the AI's analysis, and correct mistakes.
- [ ] **S05: Daily Log View** `risk:medium` `depends:[S04]`
  > After this: Users can see their day's nutrition at a glance and navigate between days.
- [ ] **S06: Body Weight Tracking** `risk:medium` `depends:[S05]`
  > After this: Users can track body weight over time and see meaningful trends.
- [ ] **S07: Dashboard & Analytics** `risk:medium` `depends:[S06]`
  > After this: Users can assess whether their nutrition and weight trends are on track over time.
- [ ] **S08: Meal Templates** `risk:medium` `depends:[S07]`
  > After this: Users can save and reuse frequent meals without re-running AI analysis.
