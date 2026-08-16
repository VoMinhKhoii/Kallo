# i18n + Onboarding Reorder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up full i18n (EN/VI) with next-intl, reorder onboarding screens (Origin → Body Metrics → Cooking), add language picker with flag icons, and clean up stale worktrees.

**Architecture:** next-intl with always-prefix locale routing (`/en/...`, `/vi/...`). Route restructuring moves `app/` contents under `app/[locale]/`. Middleware composes next-intl locale resolution with existing Supabase auth. DB gets a `preferred_locale` column.

**Tech Stack:** next-intl, country-flag-icons, Drizzle ORM, Next.js 16 App Router, Supabase

**Spec:** `docs/superpowers/specs/2026-04-17-i18n-onboarding-reorder-design.md`

---

## File Map

### New Files
- `i18n/config.ts` — locale constants (locales list, defaultLocale)
- `i18n/request.ts` — next-intl server config (`getRequestConfig`)
- `i18n/navigation.ts` — locale-aware navigation exports (`Link`, `useRouter`, `redirect`, `usePathname`)
- `messages/en.json` — English translations (~270 keys)
- `messages/vi.json` — Vietnamese translations (~270 keys)
- `app/[locale]/layout.tsx` — new root layout with `NextIntlClientProvider`
- `app/[locale]/page.tsx` — landing page (moved from `app/page.tsx`)
- `app/[locale]/(app)/layout.tsx` — auth layout (moved from `app/(app)/layout.tsx`)
- `app/[locale]/(app)/logging/page.tsx` — (moved)
- `app/[locale]/(app)/onboarding/page.tsx` — (moved)
- `app/[locale]/(app)/dashboard/page.tsx` — (moved)
- `app/[locale]/(app)/settings/layout.tsx` — (moved)
- `app/[locale]/(app)/settings/page.tsx` — (moved)
- `app/[locale]/(app)/settings/profile/page.tsx` — (moved)
- `components/onboarding/language-toggle.tsx` — language picker with flag icons
- `app/[locale]/not-found.tsx` — styled 404 page for invalid locale paths

### Modified Files
- `next.config.ts` — wrap with `createNextIntlPlugin`
- `middleware.ts` — compose next-intl + Supabase auth middleware
- `lib/db/schema.ts` — add `preferredLocale` column + CHECK constraint
- `lib/onboarding/actions.ts` — swap step 1↔2 field mappings, add `preferredLocale`
- `lib/onboarding/constants.ts` — update step comments
- `lib/supabase/middleware.ts` — adjust redirect paths for locale prefix
- `components/onboarding/wizard-shell.tsx` — swap screen order, locale-aware routing
- `components/onboarding/screen-origin.tsx` — add language toggle, use translations
- `components/onboarding/screen-body-metrics.tsx` — use translations
- `components/onboarding/screen-cooking.tsx` — use translations
- `components/onboarding/step-indicator.tsx` — use translations (if applicable)
- `components/landing-page/hero.tsx` — use translations
- `components/landing-page/header.tsx` — use translations
- `components/landing-page/problem-section.tsx` — use translations
- `components/landing-page/solution-section.tsx` — use translations
- `components/landing-page/cta-section.tsx` — use translations
- `components/landing-page/footer.tsx` — use translations
- `components/auth/sign-in-form.tsx` — use translations
- `components/auth/sign-up-form.tsx` — use translations
- `components/auth/auth-dialog.tsx` — use translations
- `components/auth/form-input.tsx` — use translations
- `components/app/app-shell.tsx` — use translations
- `components/app/main-sidebar.tsx` — use translations, locale-aware links
- `components/dashboard/dashboard-shell.tsx` — use translations
- `components/logging/logging-shell.tsx` — use translations
- `components/settings/shell.tsx` — use translations
- `components/settings/sidebar.tsx` — use translations, `next/link` → `@/i18n/navigation`
- `components/onboarding/nudge-dialog.tsx` — use translations, `next/navigation` → `@/i18n/navigation`
- `components/onboarding/onboarding-card.tsx` — use translations, `next/link` → `@/i18n/navigation`
- `components/dashboard/today/meal-trigger.tsx` — `next/navigation` → `@/i18n/navigation`

### Deleted Files
- `app/layout.tsx` — replaced by `app/[locale]/layout.tsx`
- `app/page.tsx` — replaced by `app/[locale]/page.tsx`
- `app/(app)/layout.tsx` — replaced by `app/[locale]/(app)/layout.tsx`
- `app/(app)/logging/page.tsx` — moved
- `app/(app)/onboarding/page.tsx` — moved
- `app/(app)/dashboard/page.tsx` — moved
- `app/(app)/settings/layout.tsx` — moved
- `app/(app)/settings/page.tsx` — moved
- `app/(app)/settings/profile/page.tsx` — moved (check if exists)

---

## Chunk 1: Worktree Cleanup

### Task 1: Remove stale git worktrees and branches

**Files:** None (git operations only)

- [ ] **Step 1: Remove all 6 worktrees**

```bash
git worktree remove ../kallo-stream-a --force 2>/dev/null || true
git worktree remove ../kallo-stream-b --force 2>/dev/null || true
git worktree remove ../kallo-stream-c --force 2>/dev/null || true
git worktree remove ../kallo-stream-d --force 2>/dev/null || true
git worktree remove ../kallo-stream-e --force 2>/dev/null || true
git worktree remove ../kallo-usda-enrichment --force 2>/dev/null || true
```

- [ ] **Step 2: Delete local branches**

```bash
git branch -D opt/streaming-perceived-perf 2>/dev/null || true
git branch -D opt/pipeline-performance 2>/dev/null || true
git branch -D opt/meal-persistence-data-layer 2>/dev/null || true
git branch -D opt/hardening-error-resilience 2>/dev/null || true
git branch -D opt/devex-polish 2>/dev/null || true
git branch -D fix/real-meal-nutrition-value 2>/dev/null || true
```

- [ ] **Step 3: Verify cleanup**

```bash
git worktree list
git branch -v
```

Expected: Only `main` worktree and branch remain.

- [ ] **Step 4: Commit (no code changes — skip)**

No commit needed for worktree cleanup.

---

## Chunk 2: i18n Infrastructure

### Task 2: Install dependencies

**Files:**
- Modify: `package.json` (via `bun add`)

- [ ] **Step 1: Install next-intl and country-flag-icons**

```bash
bun add next-intl country-flag-icons
```

- [ ] **Step 2: Verify installation**

```bash
cat node_modules/next-intl/package.json | head -5
cat node_modules/country-flag-icons/package.json | head -5
```

Expected: Both packages installed with recent versions.

### Task 3: Create i18n config files

**Files:**
- Create: `i18n/config.ts`
- Create: `i18n/request.ts`
- Create: `i18n/navigation.ts`

- [ ] **Step 1: Create `i18n/config.ts`**

```ts
export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
```

- [ ] **Step 2: Create `i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './navigation';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create `i18n/navigation.ts`**

```ts
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Commit**

```bash
git add i18n/
git commit -m "feat(i18n): add next-intl config, routing, and navigation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Update next.config.ts

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Wrap config with createNextIntlPlugin**

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  /* config options here */
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat(i18n): wrap next.config with createNextIntlPlugin

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Create initial translation files

**Files:**
- Create: `messages/en.json`
- Create: `messages/vi.json`

> **Note:** These initial translation files are a baseline. Tasks 13-17 (Chunk 5) will add keys as each component is translated. Expect the final key count to reach ~350-400 keys.

- [ ] **Step 1: Create `messages/en.json`** with all namespaces (initially with common + onboarding + auth + nav keys — other namespaces added in Chunk 5)

```json
{
  "common": {
    "back": "Back",
    "next": "Next Step",
    "skip": "Skip",
    "finish": "Finish",
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Try again",
    "search": "Search",
    "noResults": "No results found",
    "confirm": "Confirm",
    "close": "Close",
    "or": "or",
    "optional": "Optional"
  },
  "nav": {
    "logging": "Logging",
    "dashboard": "Dashboard",
    "settings": "Settings",
    "signOut": "Sign Out"
  },
  "onboarding": {
    "stepOf": "Step {current} of {total}",
    "origin": {
      "title": "Where are you from?",
      "subtitle": "Origin helps the AI lean toward the food culture you identify with. Current residence helps it bias toward ingredients that are easier to find around you.",
      "countryOfOrigin": "Country of origin",
      "countryOfOriginHint": "Where you grew up or identify with culinarily",
      "countryOfResidence": "Country of residence",
      "countryOfResidenceHint": "Where you currently live — affects available ingredients",
      "selectCountry": "Select a country…",
      "searchCountry": "Search country…",
      "noCountries": "No countries found",
      "fallbackNote": "Leave one or both empty if you want. The AI will fall back to your photo and meal text only.",
      "preferredLanguage": "Preferred language",
      "preferredLanguageHint": "Choose your language for the app interface"
    },
    "bodyMetrics": {
      "title": "Your body metrics",
      "subtitle": "We use these to calculate your daily calorie and macro targets.",
      "biologicalSex": "Biological sex",
      "male": "Male",
      "female": "Female",
      "weight": "Weight",
      "weightUnit": "kg",
      "height": "Height",
      "heightUnit": "cm",
      "age": "Age",
      "activityLevel": "Activity level",
      "sedentary": "Sedentary (Office job, little to no exercise)",
      "light": "Lightly active (Light exercise 1-3 days/week)",
      "moderate": "Moderately active (Moderate exercise 3-5 days/week)",
      "veryActive": "Very active (Heavy exercise 6-7 days/week)",
      "goal": "Goal",
      "cutting": "Cutting",
      "maintaining": "Maintaining",
      "bulking": "Bulking",
      "aggression": "Aggression",
      "aggressionHint": "How aggressively to cut/bulk (kg/week)",
      "carbSplit": "Carb split",
      "moderateCarb": "Moderate carb",
      "lowerCarb": "Lower carb",
      "higherCarb": "Higher carb",
      "tdee": "Estimated TDEE",
      "calorieTarget": "Daily calorie target",
      "protein": "Protein",
      "carbs": "Carbs",
      "fat": "Fat",
      "macroSummary": "Daily targets",
      "kcal": "kcal",
      "grams": "g"
    },
    "cooking": {
      "title": "Your cooking habits",
      "subtitle": "Help the AI understand how you typically cook so it can give more accurate calorie estimates.",
      "oilUsage": "Oil usage",
      "oilMinimal": "Minimal",
      "oilNormal": "Normal",
      "oilHeavy": "Heavy",
      "oilHint": "How much oil/fat you typically use when cooking",
      "ricePortion": "Default rice portion",
      "riceSmall": "Small",
      "riceMedium": "Medium",
      "riceLarge": "Large",
      "riceHint": "Your typical serving of rice per meal",
      "sugar": "Sugar in braised dishes",
      "sugarLow": "Low",
      "sugarMedium": "Medium",
      "sugarHigh": "High",
      "sugarHint": "How much sugar you use for caramelizing/braising",
      "proteinPortion": "Default protein portion",
      "proteinSmall": "Small",
      "proteinMedium": "Medium",
      "proteinLarge": "Large",
      "proteinHint": "Typical amount of meat/fish per meal",
      "broth": "Broth consumption",
      "brothLeave": "Leave it",
      "brothSome": "Drink some",
      "brothFinish": "Finish it",
      "brothHint": "How much broth you typically drink from soups/stews"
    }
  },
  "auth": {
    "signIn": {
      "title": "Welcome back",
      "email": "Email",
      "password": "Password",
      "submit": "Sign In",
      "noAccount": "Don't have an account?",
      "signUpLink": "Sign up",
      "forgotPassword": "Forgot password?",
      "error": "Invalid email or password"
    },
    "signUp": {
      "title": "Create your account",
      "email": "Email",
      "password": "Password",
      "confirmPassword": "Confirm password",
      "submit": "Create Account",
      "hasAccount": "Already have an account?",
      "signInLink": "Sign in",
      "success": "Check your email to confirm your account",
      "error": "Could not create account"
    },
    "otp": {
      "title": "Check your email",
      "subtitle": "We sent a verification code to {email}",
      "submit": "Verify",
      "resend": "Resend code",
      "error": "Invalid code"
    }
  },
  "landing": {
    "hero": {
      "title": "Track Vietnamese meals without the guesswork",
      "subtitle": "Snap a photo or describe your meal in Vietnamese. Our AI knows phở, bánh mì, and 500+ Vietnamese dishes — and calculates real nutrition from lab-verified data.",
      "cta": "Get Started",
      "ctaSecondary": "See How It Works"
    },
    "problem": {
      "title": "The problem with existing trackers",
      "subtitle": "Built for Western diets. MyFitnessPal doesn't know the difference between phở bò and phở gà, or that your bún bò Huế has more chili oil than usual.",
      "card1Title": "Generic databases",
      "card1Text": "Western-centric food databases with wrong portions and missing Vietnamese dishes",
      "card2Title": "Manual entry is painful",
      "card2Text": "Searching ingredient by ingredient, guessing portions, giving up after 3 days",
      "card3Title": "No cooking context",
      "card3Text": "A stir-fry with minimal oil vs. deep-fried — same ingredient, very different calories"
    },
    "solution": {
      "title": "How Kallo works",
      "subtitle": "Describe what you ate in your own words. Our AI handles the rest.",
      "step1Title": "Tell us what you ate",
      "step1Text": "Type in Vietnamese or English — \"cơm tấm sườn bì chả\" or \"broken rice with pork\"",
      "step2Title": "AI analyzes your meal",
      "step2Text": "Matches against 500+ lab-verified Vietnamese ingredients with cooking-method awareness",
      "step3Title": "Get accurate nutrition",
      "step3Text": "Bounded estimates (low/mid/high) that account for your personal cooking habits"
    },
    "cta": {
      "title": "Ready to track smarter?",
      "subtitle": "Join the beta and start tracking Vietnamese meals with real accuracy.",
      "button": "Get Started Free"
    },
    "footer": {
      "tagline": "Vietnamese meal tracking, powered by AI",
      "copyright": "© {year} Kallo. All rights reserved."
    }
  },
  "dashboard": {
    "title": "Dashboard",
    "today": "Today",
    "thisWeek": "This Week",
    "caloriesConsumed": "Calories consumed",
    "caloriesRemaining": "Calories remaining",
    "protein": "Protein",
    "carbs": "Carbs",
    "fat": "Fat",
    "noMealsToday": "No meals logged today",
    "logMeal": "Log a meal",
    "recentMeals": "Recent meals",
    "viewAll": "View all",
    "progress": "Progress",
    "weeklyAverage": "Weekly average",
    "target": "Target"
  },
  "logging": {
    "title": "What did you eat?",
    "placeholder": "Describe your meal in Vietnamese or English...",
    "submit": "Analyze",
    "analyzing": "Analyzing your meal...",
    "breakfast": "Breakfast",
    "brunch": "Brunch",
    "lunch": "Lunch",
    "dinner": "Dinner",
    "snack": "Snack",
    "mealSlot": "Meal type",
    "confirm": "Save meal",
    "discard": "Discard",
    "edit": "Edit",
    "nutritionSummary": "Nutrition summary",
    "ingredients": "Ingredients",
    "calories": "Calories",
    "confidence": "Confidence",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "portion": "Portion",
    "cookingMethod": "Cooking method",
    "matched": "Matched",
    "estimated": "Estimated",
    "feedEmpty": "No meals yet today. What did you eat?",
    "todaysMeals": "Today's meals"
  },
  "settings": {
    "title": "Settings",
    "profile": "Profile",
    "preferences": "Preferences",
    "bodyMetrics": "Body Metrics",
    "goals": "Goals & Targets",
    "cooking": "Cooking Habits",
    "regional": "Regional",
    "save": "Save changes",
    "saved": "Changes saved",
    "language": "Language",
    "languageHint": "Change the app language"
  }
}
```

- [ ] **Step 2: Create `messages/vi.json`** with all Vietnamese translations

```json
{
  "common": {
    "back": "Quay lại",
    "next": "Tiếp theo",
    "skip": "Bỏ qua",
    "finish": "Hoàn tất",
    "save": "Lưu",
    "cancel": "Hủy",
    "loading": "Đang tải...",
    "error": "Đã xảy ra lỗi",
    "retry": "Thử lại",
    "search": "Tìm kiếm",
    "noResults": "Không tìm thấy kết quả",
    "confirm": "Xác nhận",
    "close": "Đóng",
    "or": "hoặc",
    "optional": "Tùy chọn"
  },
  "nav": {
    "logging": "Ghi nhận",
    "dashboard": "Tổng quan",
    "settings": "Cài đặt",
    "signOut": "Đăng xuất"
  },
  "onboarding": {
    "stepOf": "Bước {current} / {total}",
    "origin": {
      "title": "Bạn đến từ đâu?",
      "subtitle": "Quê quán giúp AI hiểu văn hóa ẩm thực bạn gắn bó. Nơi ở hiện tại giúp AI gợi ý nguyên liệu dễ tìm quanh bạn.",
      "countryOfOrigin": "Quê quán",
      "countryOfOriginHint": "Nơi bạn lớn lên hoặc gắn bó về ẩm thực",
      "countryOfResidence": "Nơi ở hiện tại",
      "countryOfResidenceHint": "Nơi bạn đang sống — ảnh hưởng đến nguyên liệu có sẵn",
      "selectCountry": "Chọn quốc gia…",
      "searchCountry": "Tìm quốc gia…",
      "noCountries": "Không tìm thấy quốc gia",
      "fallbackNote": "Bỏ trống nếu muốn. AI sẽ chỉ dựa vào ảnh và mô tả bữa ăn của bạn.",
      "preferredLanguage": "Ngôn ngữ ưa thích",
      "preferredLanguageHint": "Chọn ngôn ngữ hiển thị cho ứng dụng"
    },
    "bodyMetrics": {
      "title": "Chỉ số cơ thể",
      "subtitle": "Chúng tôi dùng thông tin này để tính mục tiêu calo và dinh dưỡng hàng ngày.",
      "biologicalSex": "Giới tính sinh học",
      "male": "Nam",
      "female": "Nữ",
      "weight": "Cân nặng",
      "weightUnit": "kg",
      "height": "Chiều cao",
      "heightUnit": "cm",
      "age": "Tuổi",
      "activityLevel": "Mức hoạt động",
      "sedentary": "Ít vận động (Công việc văn phòng, ít tập thể dục)",
      "light": "Hoạt động nhẹ (Tập nhẹ 1-3 ngày/tuần)",
      "moderate": "Hoạt động vừa (Tập vừa 3-5 ngày/tuần)",
      "veryActive": "Hoạt động nhiều (Tập nặng 6-7 ngày/tuần)",
      "goal": "Mục tiêu",
      "cutting": "Giảm cân",
      "maintaining": "Duy trì",
      "bulking": "Tăng cân",
      "aggression": "Mức độ",
      "aggressionHint": "Tốc độ giảm/tăng cân (kg/tuần)",
      "carbSplit": "Tỉ lệ carb",
      "moderateCarb": "Carb vừa",
      "lowerCarb": "Ít carb",
      "higherCarb": "Nhiều carb",
      "tdee": "TDEE ước tính",
      "calorieTarget": "Mục tiêu calo hàng ngày",
      "protein": "Đạm",
      "carbs": "Carb",
      "fat": "Chất béo",
      "macroSummary": "Mục tiêu hàng ngày",
      "kcal": "kcal",
      "grams": "g"
    },
    "cooking": {
      "title": "Thói quen nấu ăn",
      "subtitle": "Giúp AI hiểu cách bạn thường nấu để ước tính calo chính xác hơn.",
      "oilUsage": "Lượng dầu mỡ",
      "oilMinimal": "Ít",
      "oilNormal": "Vừa",
      "oilHeavy": "Nhiều",
      "oilHint": "Lượng dầu/mỡ bạn thường dùng khi nấu",
      "ricePortion": "Phần cơm mặc định",
      "riceSmall": "Ít",
      "riceMedium": "Vừa",
      "riceLarge": "Nhiều",
      "riceHint": "Lượng cơm bạn thường ăn mỗi bữa",
      "sugar": "Đường trong món kho",
      "sugarLow": "Ít",
      "sugarMedium": "Vừa",
      "sugarHigh": "Nhiều",
      "sugarHint": "Lượng đường bạn dùng để kho/rim",
      "proteinPortion": "Phần thịt/cá mặc định",
      "proteinSmall": "Ít",
      "proteinMedium": "Vừa",
      "proteinLarge": "Nhiều",
      "proteinHint": "Lượng thịt/cá bạn thường ăn mỗi bữa",
      "broth": "Uống nước canh",
      "brothLeave": "Để lại",
      "brothSome": "Uống một ít",
      "brothFinish": "Uống hết",
      "brothHint": "Lượng nước canh/lẩu bạn thường uống"
    }
  },
  "auth": {
    "signIn": {
      "title": "Chào mừng trở lại",
      "email": "Email",
      "password": "Mật khẩu",
      "submit": "Đăng nhập",
      "noAccount": "Chưa có tài khoản?",
      "signUpLink": "Đăng ký",
      "forgotPassword": "Quên mật khẩu?",
      "error": "Email hoặc mật khẩu không đúng"
    },
    "signUp": {
      "title": "Tạo tài khoản",
      "email": "Email",
      "password": "Mật khẩu",
      "confirmPassword": "Xác nhận mật khẩu",
      "submit": "Tạo tài khoản",
      "hasAccount": "Đã có tài khoản?",
      "signInLink": "Đăng nhập",
      "success": "Kiểm tra email để xác nhận tài khoản",
      "error": "Không thể tạo tài khoản"
    },
    "otp": {
      "title": "Kiểm tra email",
      "subtitle": "Chúng tôi đã gửi mã xác nhận đến {email}",
      "submit": "Xác nhận",
      "resend": "Gửi lại mã",
      "error": "Mã không hợp lệ"
    }
  },
  "landing": {
    "hero": {
      "title": "Theo dõi bữa ăn Việt mà không cần đoán mò",
      "subtitle": "Chụp ảnh hoặc mô tả bữa ăn bằng tiếng Việt. AI của chúng tôi nhận biết phở, bánh mì, và hơn 500 món Việt — tính toán dinh dưỡng từ dữ liệu phòng thí nghiệm.",
      "cta": "Bắt đầu ngay",
      "ctaSecondary": "Xem cách hoạt động"
    },
    "problem": {
      "title": "Vấn đề với các ứng dụng hiện tại",
      "subtitle": "Được xây dựng cho chế độ ăn phương Tây. MyFitnessPal không phân biệt được phở bò và phở gà, hay bún bò Huế của bạn có nhiều dầu ớt hơn bình thường.",
      "card1Title": "Cơ sở dữ liệu chung chung",
      "card1Text": "Dữ liệu thực phẩm thiên về phương Tây với phần ăn sai và thiếu các món Việt",
      "card2Title": "Nhập tay rất mệt",
      "card2Text": "Tìm từng nguyên liệu, đoán phần ăn, bỏ cuộc sau 3 ngày",
      "card3Title": "Thiếu ngữ cảnh nấu nướng",
      "card3Text": "Xào ít dầu và chiên ngập dầu — cùng nguyên liệu, calo rất khác nhau"
    },
    "solution": {
      "title": "Kallo hoạt động thế nào",
      "subtitle": "Mô tả bạn đã ăn gì bằng lời. AI lo phần còn lại.",
      "step1Title": "Cho chúng tôi biết bạn ăn gì",
      "step1Text": "Nhập tiếng Việt hoặc tiếng Anh — \"cơm tấm sườn bì chả\" hoặc \"broken rice with pork\"",
      "step2Title": "AI phân tích bữa ăn",
      "step2Text": "Đối chiếu với hơn 500 nguyên liệu Việt đã kiểm chứng, hiểu cách chế biến",
      "step3Title": "Nhận kết quả dinh dưỡng chính xác",
      "step3Text": "Ước tính có biên độ (thấp/trung bình/cao) tính đến thói quen nấu ăn của bạn"
    },
    "cta": {
      "title": "Sẵn sàng theo dõi thông minh hơn?",
      "subtitle": "Tham gia beta và bắt đầu theo dõi bữa ăn Việt với độ chính xác thực sự.",
      "button": "Bắt đầu miễn phí"
    },
    "footer": {
      "tagline": "Theo dõi bữa ăn Việt, được hỗ trợ bởi AI",
      "copyright": "© {year} Kallo. Mọi quyền được bảo lưu."
    }
  },
  "dashboard": {
    "title": "Tổng quan",
    "today": "Hôm nay",
    "thisWeek": "Tuần này",
    "caloriesConsumed": "Calo đã nạp",
    "caloriesRemaining": "Calo còn lại",
    "protein": "Đạm",
    "carbs": "Carb",
    "fat": "Chất béo",
    "noMealsToday": "Chưa ghi nhận bữa ăn nào hôm nay",
    "logMeal": "Ghi nhận bữa ăn",
    "recentMeals": "Bữa ăn gần đây",
    "viewAll": "Xem tất cả",
    "progress": "Tiến trình",
    "weeklyAverage": "Trung bình tuần",
    "target": "Mục tiêu"
  },
  "logging": {
    "title": "Bạn đã ăn gì?",
    "placeholder": "Mô tả bữa ăn bằng tiếng Việt hoặc tiếng Anh...",
    "submit": "Phân tích",
    "analyzing": "Đang phân tích bữa ăn...",
    "breakfast": "Sáng",
    "brunch": "Sáng muộn",
    "lunch": "Trưa",
    "dinner": "Tối",
    "snack": "Ăn vặt",
    "mealSlot": "Bữa ăn",
    "confirm": "Lưu bữa ăn",
    "discard": "Bỏ",
    "edit": "Sửa",
    "nutritionSummary": "Tóm tắt dinh dưỡng",
    "ingredients": "Nguyên liệu",
    "calories": "Calo",
    "confidence": "Độ tin cậy",
    "high": "Cao",
    "medium": "Trung bình",
    "low": "Thấp",
    "portion": "Phần ăn",
    "cookingMethod": "Cách chế biến",
    "matched": "Đã khớp",
    "estimated": "Ước tính",
    "feedEmpty": "Chưa có bữa ăn hôm nay. Bạn đã ăn gì?",
    "todaysMeals": "Bữa ăn hôm nay"
  },
  "settings": {
    "title": "Cài đặt",
    "profile": "Hồ sơ",
    "preferences": "Tùy chỉnh",
    "bodyMetrics": "Chỉ số cơ thể",
    "goals": "Mục tiêu",
    "cooking": "Thói quen nấu ăn",
    "regional": "Khu vực",
    "save": "Lưu thay đổi",
    "saved": "Đã lưu thay đổi",
    "language": "Ngôn ngữ",
    "languageHint": "Thay đổi ngôn ngữ ứng dụng"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add EN and VI translation files

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Rewrite middleware to compose next-intl + Supabase auth

**Files:**
- Modify: `middleware.ts`
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Update `middleware.ts`**

Replace the entire file with composed middleware:

```ts
import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/navigation';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Resolve locale from URL path (next-intl)
  const intlResponse = intlMiddleware(request);

  // 2. Run Supabase auth session refresh on the intl response
  const supabaseResponse = await updateSession(request, intlResponse);

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Update `lib/supabase/middleware.ts`** to accept an existing response and use locale-prefixed paths

```ts
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  let supabaseResponse = response ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = response
            ? response
            : NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Extract locale from URL path (e.g., /en/logging → en)
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|vi)(\/|$)/);
  const locale = localeMatch?.[1] ?? 'en';
  const pathWithoutLocale = pathname.replace(/^\/(en|vi)/, '') || '/';

  // Redirect authenticated users from landing page to app
  if (user && pathWithoutLocale === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/logging`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts
git commit -m "feat(i18n): compose next-intl and Supabase auth middleware

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 7: Move route files under `[locale]` segment

**Files:**
- Move: `app/layout.tsx` → `app/[locale]/layout.tsx` (rewritten)
- Move: `app/page.tsx` → `app/[locale]/page.tsx`
- Move: `app/(app)/layout.tsx` → `app/[locale]/(app)/layout.tsx`
- Move: `app/(app)/logging/page.tsx` → `app/[locale]/(app)/logging/page.tsx`
- Move: `app/(app)/onboarding/page.tsx` → `app/[locale]/(app)/onboarding/page.tsx`
- Move: `app/(app)/dashboard/page.tsx` → `app/[locale]/(app)/dashboard/page.tsx`
- Move: `app/(app)/settings/layout.tsx` → `app/[locale]/(app)/settings/layout.tsx`
- Move: `app/(app)/settings/page.tsx` → `app/[locale]/(app)/settings/page.tsx`
- Keep: `app/globals.css` at `app/globals.css`
- Keep: `app/api/` at `app/api/`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p app/\[locale\]/\(app\)/logging
mkdir -p app/\[locale\]/\(app\)/onboarding
mkdir -p app/\[locale\]/\(app\)/dashboard
mkdir -p app/\[locale\]/\(app\)/settings/profile
```

- [ ] **Step 2: Create `app/[locale]/layout.tsx`** — new root layout with NextIntlClientProvider

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DM_Sans, Fraunces, Geist, Geist_Mono, Lora } from 'next/font/google';
import { routing } from '@/i18n/navigation';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import '../globals.css';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['vietnamese', 'latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'optional',
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kallo — Vietnamese Meal Tracker',
  description: 'Track Vietnamese meals with AI-powered nutrition analysis',
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${dmSans.variable} ${fraunces.variable} antialiased`}
      >
        <div className="noise-bg pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 2.5: Add `generateStaticParams`** for static locale rendering

Add after the `metadata` export in `app/[locale]/layout.tsx`:

```ts
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

- [ ] **Step 3: Move page files** — copy each file, updating imports where needed

```bash
# Move the landing page
cp app/page.tsx app/\[locale\]/page.tsx

# Move authenticated app layout
cp app/\(app\)/layout.tsx app/\[locale\]/\(app\)/layout.tsx

# Move pages
cp app/\(app\)/logging/page.tsx app/\[locale\]/\(app\)/logging/page.tsx
cp app/\(app\)/onboarding/page.tsx app/\[locale\]/\(app\)/onboarding/page.tsx
cp app/\(app\)/dashboard/page.tsx app/\[locale\]/\(app\)/dashboard/page.tsx

# Move settings
cp app/\(app\)/settings/layout.tsx app/\[locale\]/\(app\)/settings/layout.tsx
cp app/\(app\)/settings/page.tsx app/\[locale\]/\(app\)/settings/page.tsx
```

Check if settings/profile exists:
```bash
ls app/\(app\)/settings/profile/ 2>/dev/null && cp app/\(app\)/settings/profile/page.tsx app/\[locale\]/\(app\)/settings/profile/page.tsx
```

- [ ] **Step 4: Update `app/[locale]/(app)/layout.tsx`** — use `redirect` from next-intl navigation

Replace `import { redirect } from 'next/navigation'` with `import { redirect } from '@/i18n/navigation'`. No path changes needed — next-intl's `redirect` automatically adds the locale prefix.

- [ ] **Step 5: Update `app/[locale]/(app)/settings/page.tsx`** — locale-aware redirect

```ts
import { redirect } from '@/i18n/navigation';

export default function SettingsPage() {
  redirect('/settings/profile');
}
```

- [ ] **Step 6: Update `app/[locale]/(app)/onboarding/page.tsx`** — locale-aware redirect

```ts
import { redirect } from '@/i18n/navigation';

export default function OnboardingPage() {
  redirect('/logging');
}
```

- [ ] **Step 6.5: Update `app/[locale]/(app)/logging/page.tsx`** — locale-aware redirect

Replace `import { redirect } from 'next/navigation'` with `import { redirect } from '@/i18n/navigation'`. The `redirect('/')` call in the catch block will then auto-add locale prefix.

- [ ] **Step 7: Delete old route files**

```bash
rm app/layout.tsx
rm app/page.tsx
rm -rf app/\(app\)
```

- [ ] **Step 8: Create `app/[locale]/not-found.tsx`** — styled 404 page for invalid locales

```tsx
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">{t('notFound')}</p>
      </div>
    </div>
  );
}
```

Add `"notFound": "Page not found"` to `common` namespace in `messages/en.json` and `"notFound": "Không tìm thấy trang"` in `messages/vi.json`.

- [ ] **Step 9: Commit**

```bash
git add app/
git commit -m "feat(i18n): restructure routes under [locale] segment

Move all pages from app/ to app/[locale]/ for next-intl
locale-prefixed routing. API routes stay at app/api/.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 3: Database Migration

### Task 8: Add preferred_locale column to user_profiles

**Files:**
- Modify: `lib/db/schema.ts`
- Generated: `supabase/migrations/XXXXXXXX_add_preferred_locale.sql`

- [ ] **Step 1: Add `preferredLocale` to schema**

In `lib/db/schema.ts`, inside `userProfiles` table definition, after the `countryOfResidence` field:

```ts
    // Preferred app language
    preferredLocale: text('preferred_locale').default('en'),
```

And add CHECK constraint to the table config array:

```ts
    check(
      'user_profiles_preferred_locale_check',
      sql`${table.preferredLocale} IN ('en', 'vi')`
    ),
```

- [ ] **Step 2: Update schema comments**

Update the column group comments:

```ts
    // Screen 1: Origin & Language
    countryOfOrigin: text('country_of_origin'),
    countryOfResidence: text('country_of_residence'),
    preferredLocale: text('preferred_locale').default('en'),

    // Screen 2: Body Metrics
    weightKg: decimal('weight_kg', { precision: 5, scale: 2 }),
```

- [ ] **Step 3: Generate migration**

```bash
bun db:generate
```

- [ ] **Step 4: Rename migration to meaningful name**

```bash
# Find the newly generated migration file
ls -t supabase/migrations/ | head -3
# Rename the SQL file from random name to meaningful name
# Also update the tag in meta/_journal.json
```

Rename pattern: `XXXXXXXX_random_name.sql` → `XXXXXXXX_add_preferred_locale.sql`

Update `supabase/migrations/meta/_journal.json` — change the `tag` field for the new entry from the random name to `add_preferred_locale`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts supabase/migrations/
git commit -m "feat(db): add preferred_locale column to user_profiles

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Note:** User must run `bun dbr:push` to apply migration to remote database.

---

## Chunk 4: Onboarding Reorder + Language Picker

### Task 9: Update onboarding server action field mappings

**Files:**
- Modify: `lib/onboarding/actions.ts:46-72`
- Modify: `lib/onboarding/constants.ts` (comments only)
- Modify: `lib/onboarding/progress.ts` (add preferredLocale to fields)

- [ ] **Step 1: Swap step 1 ↔ step 2 in `saveOnboardingScreen`**

In `lib/onboarding/actions.ts`, replace the step-specific field mapping block (lines 46-72):

```ts
  // Step-specific field mapping (skip when data is empty — e.g. "Skip" button)
  const hasData = Object.keys(data).length > 0;
  if (step === 1 && hasData) {
    updateObj.countryOfOrigin = data.countryOfOrigin;
    updateObj.countryOfResidence = data.countryOfResidence;
    updateObj.preferredLocale = data.preferredLocale;
  } else if (step === 2 && hasData) {
    updateObj.weightKg = data.weightKg;
    updateObj.heightCm = data.heightCm;
    updateObj.age = data.age;
    updateObj.biologicalSex = data.biologicalSex;
    updateObj.activityLevel = data.activityLevel;
    updateObj.tdeeKcal = data.tdeeKcal;
    updateObj.goal = data.goal;
    updateObj.aggression =
      data.aggression != null ? String(data.aggression) : null;
    updateObj.carbSplit = data.carbSplit;
    updateObj.calorieTarget = Math.max(Number(data.calorieTarget) || 0, 500);
    updateObj.proteinTargetG = data.proteinTargetG;
    updateObj.carbsTargetG = data.carbsTargetG;
    updateObj.fatTargetG = data.fatTargetG;
  } else if (step === 3 && hasData) {
    updateObj.oilUsage = data.oilUsage;
    updateObj.defaultRicePortion = data.defaultRicePortion;
    updateObj.sugarBraised = data.sugarBraised;
    updateObj.defaultProteinPortion = data.defaultProteinPortion;
    updateObj.brothConsumption = data.brothConsumption;
  }
```

- [ ] **Step 2: Update `saveProfileSettings`** to include `preferredLocale`

In the `updateObj` in `saveProfileSettings`, add:
```ts
    preferredLocale: (data.preferredLocale as string) ?? null,
```

- [ ] **Step 3: Update constants comments**

In `lib/onboarding/constants.ts`, update the onboarding_step comments:

```ts
// onboarding_step thresholds:
// 0 = not started
// 1 = Screen 1 complete (origin + language preference)
// 2 = Screen 2 complete (body metrics + goals)
// 3 = Screen 3 complete (cooking habits) — ALL SCREENS DONE
```

- [ ] **Step 4: Add `preferredLocale` to progress fields**

In `lib/onboarding/progress.ts`, add `'preferredLocale'` to the `PERSONALIZATION_FIELDS` array.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/
git commit -m "feat(onboarding): swap step 1/2 field mappings, add preferredLocale

Step 1 now saves origin + language, step 2 saves body metrics.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 10: Create language toggle component

**Files:**
- Create: `components/onboarding/language-toggle.tsx`

- [ ] **Step 1: Create the language toggle component**

```tsx
'use client';

import { GB, VN } from 'country-flag-icons/react/3x2';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/config';

interface LanguageToggleProps {
  onLocaleChange?: (locale: Locale) => void;
}

const LOCALE_OPTIONS: { value: Locale; label: string; Flag: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { value: 'en', label: 'English', Flag: GB },
  { value: 'vi', label: 'Tiếng Việt', Flag: VN },
];

export function LanguageToggle({ onLocaleChange }: LanguageToggleProps) {
  const t = useTranslations('onboarding.origin');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    onLocaleChange?.(newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-bold text-[#2C2416] text-[13px]">
        {t('preferredLanguage')}
      </label>
      <p className="mb-3 text-[#8B8682] text-[12px] leading-relaxed">
        {t('preferredLanguageHint')}
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5F4F0] p-1">
        {LOCALE_OPTIONS.map(({ value, label, Flag }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
              locale === value
                ? 'bg-white text-[#2C2416] shadow-sm'
                : 'text-[#8B8682] hover:text-[#2C2416]'
            }`}
          >
            <Flag className="h-4 w-6 rounded-sm" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/onboarding/language-toggle.tsx
git commit -m "feat(onboarding): create language toggle with flag icons

Uses country-flag-icons package (AGENTS.md exception).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 11: Reorder screens in wizard-shell.tsx

**Files:**
- Modify: `components/onboarding/wizard-shell.tsx`

- [ ] **Step 1: Update imports** — add `useLocale` and `useRouter` from next-intl

Replace:
```ts
import { useRouter } from 'next/navigation';
```
With:
```ts
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
```

- [ ] **Step 2: Swap screen defaults**

Replace `buildScreenOneDefaults` function with origin defaults, and rename:

The new order:
- `screenOneDefaults` → Origin + Language data (was `screenTwoDefaults`)
- `screenTwoDefaults` → Body Metrics data (was `screenOneDefaults`)
- `screenThreeDefaults` → Cooking data (unchanged)

Replace `buildScreenOneDefaults` with:

```ts
function buildScreenOneDefaults(profile: ProfileRow | null, locale: string) {
  return {
    countryOfOrigin: profile?.countryOfOrigin ?? null,
    countryOfResidence: profile?.countryOfResidence ?? null,
    preferredLocale: profile?.preferredLocale ?? locale,
  };
}

function buildScreenTwoDefaults(profile: ProfileRow | null) {
  return {
    biologicalSex: (profile?.biologicalSex as 'male' | 'female') ?? undefined,
    weightKg: profile?.weightKg ? Number(profile.weightKg) : undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: profile?.age ?? undefined,
    activityLevel:
      (profile?.activityLevel as
        | 'sedentary'
        | 'light'
        | 'moderate'
        | 'very_active') ?? WIZARD_DEFAULTS.activityLevel,
    goal:
      (profile?.goal as 'cutting' | 'bulking' | 'maintaining') ??
      WIZARD_DEFAULTS.goal,
    aggression: parseAggression(
      profile?.aggression,
      WIZARD_DEFAULTS.aggression
    ),
    carbSplit:
      (profile?.carbSplit as 'moderate_carb' | 'lower_carb' | 'higher_carb') ??
      WIZARD_DEFAULTS.carbSplit,
    deficitOverride: WIZARD_DEFAULTS.deficitOverride,
  };
}
```

- [ ] **Step 3: Update screen data merge logic**

In the `WizardShell` component, replace the screen defaults section with:

```ts
  const locale = useLocale();

  const screenOneDefaults = screenData[1]
    ? {
        countryOfOrigin: (screenData[1].countryOfOrigin as string | null) ?? null,
        countryOfResidence: (screenData[1].countryOfResidence as string | null) ?? null,
        preferredLocale: (screenData[1].preferredLocale as string) ?? locale,
      }
    : buildScreenOneDefaults(initialProfile, locale);

  const screenTwoDefaults = screenData[2]
    ? {
        ...buildScreenTwoDefaults(initialProfile),
        ...(screenData[2] as Partial<ScreenOneData>),
      }
    : buildScreenTwoDefaults(initialProfile);
```

(screenThreeDefaults stays the same but references `screenData[3]` — already correct)

- [ ] **Step 4: Update screen rendering order**

Replace the screen rendering block:

```tsx
              {currentStep === 1 && (
                <ScreenOrigin
                  defaultValues={screenOneDefaults}
                  onChange={(data) =>
                    handleScreenChange(
                      1,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
              {currentStep === 2 && (
                <ScreenBodyMetrics
                  defaultValues={screenTwoDefaults}
                  onChange={(data: ScreenOneData) =>
                    handleScreenChange(
                      2,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
              {currentStep === 3 && (
                <ScreenCooking
                  defaultValues={screenThreeDefaults}
                  onChange={(data) =>
                    handleScreenChange(
                      3,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
```

- [ ] **Step 5: Update modal width logic**

```ts
  const modalMaxWidthClass =
    currentStep === 1
      ? 'max-w-4xl'         // Origin screen (was max-w-6xl for body metrics)
      : currentStep === 2
        ? 'max-w-6xl'       // Body metrics (was max-w-4xl for origin)
        : 'max-w-[58rem]';  // Cooking (unchanged)
```

- [ ] **Step 6: Commit**

```bash
git add components/onboarding/wizard-shell.tsx
git commit -m "feat(onboarding): reorder screens — origin first, body metrics second

Screen 1: Origin + Language
Screen 2: Body Metrics + Goals
Screen 3: Cooking Habits

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 12: Add language toggle to screen-origin.tsx

**Files:**
- Modify: `components/onboarding/screen-origin.tsx`

- [ ] **Step 1: Add language toggle and translations to ScreenOrigin**

Add imports:
```ts
import { useTranslations } from 'next-intl';
import { LanguageToggle } from './language-toggle';
```

Update `ScreenOriginProps` to include `preferredLocale`:
```ts
interface ScreenOriginProps {
  defaultValues: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
    preferredLocale: string;
  };
  onChange: (data: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
    preferredLocale: string;
  }) => void;
}
```

In the `ScreenOrigin` component, add `preferredLocale` state and the `LanguageToggle` above the country pickers. Use `useTranslations('onboarding.origin')` for all text.

- [ ] **Step 2: Replace hardcoded strings with translation keys**

All strings in `ScreenOrigin` and `CountryPicker` use `t('key')` instead of hardcoded English. For example:
- `"Where are you from?"` → `t('title')`
- `"Country of origin"` → `t('countryOfOrigin')`
- `"Select a country…"` → `t('selectCountry')`

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/screen-origin.tsx
git commit -m "feat(onboarding): add language toggle and i18n to origin screen

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 5: Translate All Components

This chunk wires up `useTranslations` / `getTranslations` in every component with hardcoded strings.

### Task 13: Translate onboarding screens

**Files:**
- Modify: `components/onboarding/screen-body-metrics.tsx`
- Modify: `components/onboarding/screen-cooking.tsx`
- Modify: `components/onboarding/wizard-shell.tsx` (button labels)
- Modify: `components/onboarding/step-indicator.tsx`

- [ ] **Step 1: Add `useTranslations` to `screen-body-metrics.tsx`**

Add `import { useTranslations } from 'next-intl';`

At the start of the component:
```ts
const t = useTranslations('onboarding.bodyMetrics');
```

Replace all hardcoded labels with `t('key')` calls. For the activity options array:
```ts
const ACTIVITY_OPTIONS = [
  { value: 'sedentary' as ActivityLevel, key: 'sedentary' },
  { value: 'light' as ActivityLevel, key: 'light' },
  { value: 'moderate' as ActivityLevel, key: 'moderate' },
  { value: 'very_active' as ActivityLevel, key: 'veryActive' },
];
```
Then render as `t(option.key)` instead of the hardcoded label string.

Do the same for goals, carb splits, etc.

- [ ] **Step 2: Add `useTranslations` to `screen-cooking.tsx`**

```ts
const t = useTranslations('onboarding.cooking');
```

Replace all option labels and hints.

- [ ] **Step 3: Translate wizard-shell.tsx button labels**

```ts
const t = useTranslations('common');
```

Replace:
- `"Back"` → `t('back')`
- `"Skip"` → `t('skip')`
- `"Finish"` / `"Next Step"` → `currentStep >= TOTAL_STEPS ? t('finish') : t('next')`

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/
git commit -m "feat(i18n): translate all onboarding screens

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 14: Translate auth components

**Files:**
- Modify: `components/auth/sign-in-form.tsx`
- Modify: `components/auth/sign-up-form.tsx`
- Modify: `components/auth/auth-dialog.tsx`
- Modify: `components/auth/form-input.tsx`

- [ ] **Step 1: Add `useTranslations` to each auth component**

Each component gets `const t = useTranslations('auth.signIn')` or `'auth.signUp'` as appropriate. Replace all hardcoded strings.

- [ ] **Step 2: Commit**

```bash
git add components/auth/
git commit -m "feat(i18n): translate auth components

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 15: Translate landing page components

**Files:**
- Modify: `components/landing-page/hero.tsx`
- Modify: `components/landing-page/header.tsx`
- Modify: `components/landing-page/problem-section.tsx`
- Modify: `components/landing-page/solution-section.tsx`
- Modify: `components/landing-page/cta-section.tsx`
- Modify: `components/landing-page/footer.tsx`

- [ ] **Step 1: Add translations to each landing page component**

Each component uses `useTranslations('landing.hero')`, `'landing.problem'`, etc. Replace all hardcoded strings.

For `footer.tsx`, use `t('copyright', { year: new Date().getFullYear() })` for the year interpolation.

- [ ] **Step 2: Update header** to include locale-aware `Link` components and a language switcher

Replace `Link` from `next/link` with `Link` from `@/i18n/navigation`.

- [ ] **Step 3: Commit**

```bash
git add components/landing-page/
git commit -m "feat(i18n): translate landing page components

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 16: Translate app shell and navigation

**Files:**
- Modify: `components/app/app-shell.tsx`
- Modify: `components/app/main-sidebar.tsx`

- [ ] **Step 1: Add translations and locale-aware links**

```ts
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
```

Replace hardcoded nav labels and `next/link` imports.

- [ ] **Step 2: Commit**

```bash
git add components/app/
git commit -m "feat(i18n): translate app shell and sidebar navigation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 17: Translate dashboard, logging, and settings components

**Files:**
- Modify: `components/dashboard/dashboard-shell.tsx`
- Modify: `components/logging/logging-shell.tsx`
- Modify: `components/settings/shell.tsx`
- Modify: `components/settings/sidebar.tsx`
- Modify: Other settings/dashboard/logging sub-components as needed

- [ ] **Step 1: Add translations to dashboard components**

- [ ] **Step 2: Add translations to logging components**

- [ ] **Step 3: Add translations to settings components**

Add language picker to settings (settings/profile or a dedicated section) so users can change language post-onboarding.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ components/logging/ components/settings/
git commit -m "feat(i18n): translate dashboard, logging, and settings

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 18: Update all remaining `next/navigation` imports

**Files:**
- All files using `useRouter`, `Link`, `redirect`, `usePathname` from `next/navigation` or `next/link`

- [ ] **Step 1: Find all files using next/navigation or next/link**

```bash
rg "from 'next/navigation'" --files-with-matches
rg "from 'next/link'" --files-with-matches
```

- [ ] **Step 2: Replace imports in client components**

Change:
```ts
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
```
To:
```ts
import { useRouter, Link, usePathname } from '@/i18n/navigation';
```

**Exception:** Server Components should use `redirect` from `@/i18n/navigation` (which is the next-intl server redirect).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(i18n): migrate all navigation imports to next-intl

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 6: Testing & Verification

### Task 19: Run lint and build

- [ ] **Step 1: Run Biome lint**

```bash
bunx @biomejs/biome check --write .
```

Fix any issues introduced by our changes.

- [ ] **Step 2: Run build**

```bash
bun run build
```

Fix any TypeScript or build errors.

- [ ] **Step 3: Run existing tests**

```bash
bun run test
```

Ensure no regressions.

### Task 20: Verify translation key completeness

- [ ] **Step 1: Write a script or manually verify that every key in `messages/en.json` exists in `messages/vi.json`**

```bash
bun -e "
const en = require('./messages/en.json');
const vi = require('./messages/vi.json');
function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? prefix + '.' + k : k;
    return typeof v === 'object' && v !== null ? getKeys(v, key) : [key];
  });
}
const enKeys = getKeys(en);
const viKeys = getKeys(vi);
const missing = enKeys.filter(k => !viKeys.includes(k));
if (missing.length) {
  console.log('Missing VI keys:', missing);
  process.exit(1);
} else {
  console.log('All', enKeys.length, 'keys present in both files');
}
"
```

- [ ] **Step 2: Commit any fixes**

### Task 21: Final verification

- [ ] **Step 1: Start dev server** and manually test:
1. Landing page at `/en` and `/vi`
2. Auth flow
3. Onboarding wizard (Origin first, with language toggle)
4. Logging page
5. Dashboard
6. Settings with language change

- [ ] **Step 2: Verify locale switching** preserves state in onboarding

- [ ] **Step 3: Final lint check**

```bash
bunx @biomejs/biome check .
```

- [ ] **Step 4: Final commit if needed**

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | 1 | Worktree cleanup |
| 2 | 2-7 | i18n infrastructure (deps, config, middleware, route restructuring) |
| 3 | 8 | DB migration (preferred_locale column) |
| 4 | 9-12 | Onboarding reorder + language picker |
| 5 | 13-18 | Full app translation wiring |
| 6 | 19-21 | Testing and verification |

**Total tasks:** 21
**Estimated commits:** ~15
