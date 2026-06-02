import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '~/theme/text';
import { colors, fonts, radii, shadow, space } from '~/theme/tokens';

// Animated Pressable so the sheet itself swallows taps (a no-op onPress keeps a
// tap on the sheet's padding from bubbling to the backdrop and closing it).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * RN port of web `components/settings/custom-select.tsx` — a dropdown that
 * opens a centered modal list (replacing the web's portal panel), with a check
 * on the selected option.
 */
export function CustomSelect({ options, value, onChange }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  // Chevron rotates 180° over 300ms on open (mirrors web's
  // `transition-transform duration-300 rotate-180`).
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withTiming(open ? 180 : 0, {
      duration: 300,
      reduceMotion: ReduceMotion.System,
    });
  }, [open, rot]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  // Sheet scales 0.98→1 on open alongside the fade (web's motion.div
  // scale-0.98→1 over 0.15s). Reset to 0.98 each open so it re-animates.
  const scale = useSharedValue(0.98);
  useEffect(() => {
    if (open) {
      scale.value = 0.98;
      scale.value = withTiming(1, {
        duration: 150,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [open, scale]);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.trigger, open && styles.triggerOpen]}
      >
        <Text numberOfLines={1} style={styles.triggerLabel}>
          {selected?.label ?? ''}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={16} color={colors.textWarm} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <AnimatedPressable
            entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
            style={[styles.sheet, sheetStyle]}
            onPress={() => {}}
          >
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected ? <Check size={16} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </AnimatedPressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  // Web open state adds shadow-sm + a faint accent ring; approximate the ring
  // with a 2px accent-tinted border atop the existing accent border color.
  triggerOpen: {
    borderColor: colors.accent,
    borderWidth: 2,
    ...shadow.sm,
  },
  triggerLabel: {
    flexShrink: 1,
    paddingRight: space[2],
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.text,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 22, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    paddingVertical: space[1],
    ...shadow.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingVertical: 10,
  },
  optionPressed: { backgroundColor: colors.track },
  optionLabel: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.text },
  optionLabelSelected: { fontFamily: fonts.sansMedium },
});
