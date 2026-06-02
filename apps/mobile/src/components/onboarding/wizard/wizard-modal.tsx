import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CookingHabits } from '@/lib/onboarding/types';
import { type AppLocale, useLocale, useTranslations } from '~/i18n';
import { WIZARD_DEFAULTS } from '~/lib/onboarding/data/constants';
import {
  buildStepOneDefaults,
  type StepOneData,
} from '~/lib/onboarding/logic/step-one-defaults';
import type { ProfileRow } from '~/lib/onboarding/hooks/use-profile';
import { useSaveScreen } from '~/lib/onboarding/hooks/use-save-screen';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { type ScreenOneData, ScreenBodyMetrics } from '../screens/screen-body-metrics';
import { ScreenCooking } from '../screens/screen-cooking';
import { ScreenOrigin } from '../screens/screen-origin';
import { StepIndicator } from './step-indicator';

const TOTAL_STEPS = 3;

interface WizardModalProps {
  initialStep: number;
  initialProfile: ProfileRow | null;
  onClose: () => void;
  onComplete: () => void;
}

function parseAggression(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

function buildScreenTwoDefaults(
  profile: ProfileRow | null
): Partial<ScreenOneData> {
  return {
    biologicalSex: (profile?.biologicalSex as 'male' | 'female') ?? undefined,
    weightKg: profile?.weightKg ? Number(profile.weightKg) : undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: profile?.age ?? undefined,
    activityLevel:
      (profile?.activityLevel as ScreenOneData['activityLevel']) ??
      WIZARD_DEFAULTS.activityLevel,
    goal: (profile?.goal as ScreenOneData['goal']) ?? WIZARD_DEFAULTS.goal,
    aggression: parseAggression(profile?.aggression, WIZARD_DEFAULTS.aggression),
    carbSplit:
      (profile?.carbSplit as ScreenOneData['carbSplit']) ??
      WIZARD_DEFAULTS.carbSplit,
    deficitOverride: WIZARD_DEFAULTS.deficitOverride,
  };
}

function buildScreenThreeDefaults(
  profile: ProfileRow | null
): Partial<CookingHabits> {
  return {
    oilUsage: (profile?.oilUsage as CookingHabits['oilUsage']) ?? undefined,
    defaultRicePortion:
      (profile?.defaultRicePortion as CookingHabits['defaultRicePortion']) ??
      undefined,
    sugarBraised:
      (profile?.sugarBraised as CookingHabits['sugarBraised']) ?? undefined,
    defaultProteinPortion:
      (profile?.defaultProteinPortion as CookingHabits['defaultProteinPortion']) ??
      undefined,
    brothConsumption:
      (profile?.brothConsumption as CookingHabits['brothConsumption']) ??
      undefined,
  };
}

/** RN port of web `components/onboarding/wizard-shell.tsx` — a full-screen
 *  modal holding per-step state; Next/Skip save the step then advance. */
export function WizardModal({
  initialStep,
  initialProfile,
  onClose,
  onComplete,
}: WizardModalProps) {
  const locale = useLocale();
  const t = useTranslations('common');
  const tOnboarding = useTranslations('onboarding');
  const insets = useSafeAreaInsets();
  const saveScreen = useSaveScreen();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [screenData, setScreenData] = useState<
    Record<number, Record<string, unknown>>
  >({});

  const handleScreenChange = (step: number, data: Record<string, unknown>) => {
    setScreenData((prev) => ({ ...prev, [step]: data }));
  };

  const advance = () => {
    if (currentStep >= TOTAL_STEPS) onComplete();
    else setCurrentStep((s) => s + 1);
  };

  const handleNext = () => {
    const data = screenData[currentStep];
    if (!data) return;
    saveScreen.mutate(
      { step: currentStep, data },
      { onSuccess: advance }
    );
  };

  const handleSkip = () => {
    saveScreen.mutate(
      { step: currentStep, data: {} },
      { onSuccess: advance }
    );
  };

  const handleBack = () => setCurrentStep((s) => Math.max(1, s - 1));

  const isPending = saveScreen.isPending;
  const isNextDisabled = isPending || !screenData[currentStep];
  const isFirstStep = currentStep <= 1;

  const screenOneDefaults: StepOneData = screenData[1]
    ? {
        countryOfOrigin: (screenData[1].countryOfOrigin as string | null) ?? null,
        countryOfResidence:
          (screenData[1].countryOfResidence as string | null) ?? null,
        preferredLocale:
          (screenData[1].preferredLocale as AppLocale) ?? locale,
      }
    : buildStepOneDefaults({
        activeLocale: locale,
        countryOfOrigin: initialProfile?.countryOfOrigin ?? null,
        countryOfResidence: initialProfile?.countryOfResidence ?? null,
        profilePreferredLocale: initialProfile?.preferredLocale ?? null,
      });

  const screenTwoDefaults: Partial<ScreenOneData> = screenData[2]
    ? { ...buildScreenTwoDefaults(initialProfile), ...(screenData[2] as Partial<ScreenOneData>) }
    : buildScreenTwoDefaults(initialProfile);

  const screenThreeDefaults: Partial<CookingHabits> = screenData[3]
    ? (screenData[3] as Partial<CookingHabits>)
    : buildScreenThreeDefaults(initialProfile);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + space[3] }]}>
        <Animated.View
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          accessibilityViewIsModal
          style={[styles.dialog, { marginBottom: insets.bottom + space[3] }]}
        >
          <View style={styles.header}>
            <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={colors.textHelp} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              key={currentStep}
              entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
            >
              {currentStep === 1 ? (
                <ScreenOrigin
                  defaultValues={screenOneDefaults}
                  onChange={(d) =>
                    handleScreenChange(1, d as unknown as Record<string, unknown>)
                  }
                />
              ) : currentStep === 2 ? (
                <ScreenBodyMetrics
                  defaultValues={screenTwoDefaults}
                  onChange={(d) =>
                    handleScreenChange(2, d as unknown as Record<string, unknown>)
                  }
                />
              ) : (
                <ScreenCooking
                  defaultValues={screenThreeDefaults}
                  onChange={(d) =>
                    handleScreenChange(3, d as unknown as Record<string, unknown>)
                  }
                />
              )}
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isFirstStep || isPending}
              onPress={handleBack}
              style={[styles.backBtn, isFirstStep && styles.hidden]}
            >
              <ArrowLeft size={16} color={colors.textHelp} />
              <Text style={styles.backLabel}>{t('back')}</Text>
            </Pressable>

            <View style={styles.footerRight}>
              <Pressable
                accessibilityRole="button"
                disabled={isPending}
                onPress={handleSkip}
                style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
              >
                <Text style={styles.skipLabel}>{t('skip')}</Text>
                <SkipForward size={14} color={colors.textHelp} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isNextDisabled}
                onPress={handleNext}
                style={[styles.nextBtn, isNextDisabled && styles.nextDisabled]}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color={colors.cream} />
                ) : (
                  <Text style={styles.nextLabel}>
                    {currentStep >= TOTAL_STEPS ? t('finish') : t('next')}
                  </Text>
                )}
                <ArrowRight size={16} color={colors.cream} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 22, 0.2)',
    paddingHorizontal: space[3],
  },
  dialog: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  closeBtn: { marginRight: -space[2], padding: space[2], borderRadius: radii.pill },
  content: { flex: 1 },
  contentInner: { padding: space[5] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.track,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  hidden: { opacity: 0 },
  backLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textHelp },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.xl,
    paddingHorizontal: space[4],
    paddingVertical: 10,
  },
  pressed: { opacity: 0.7 },
  skipLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textHelp },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radii.xl,
    backgroundColor: colors.text,
    paddingHorizontal: space[5],
    paddingVertical: 10,
  },
  nextDisabled: { opacity: 0.5 },
  nextLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.cream },
});
