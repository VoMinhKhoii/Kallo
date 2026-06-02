import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { colors, radii } from '~/theme/tokens';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

/**
 * RN port of web `components/onboarding/step-indicator.tsx` — active pill is
 * wide (24px), completed/active are dark, future is faint. The width change
 * animates (web `transition-all duration-300`) via a Reanimated layout tween.
 */
export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
        const active = step === currentStep;
        const done = step < currentStep;
        return (
          <Animated.View
            key={step}
            layout={LinearTransition.duration(300).reduceMotion(ReduceMotion.System)}
            style={[
              styles.pill,
              {
                width: active ? 24 : 8,
                backgroundColor: active || done ? colors.text : colors.inputBorder,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  pill: { height: 6, borderRadius: radii.pill },
});
