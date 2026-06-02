import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors, fonts, radii, shadow, space } from '~/theme/tokens';

interface Tab {
  id: string;
  label: string;
}

interface TabStripProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

/** RN port of the web settings `TabsList` — a pill segmented control. */
export function TabStrip({ tabs, active, onChange }: TabStripProps) {
  return (
    <View style={styles.list}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    gap: space[1],
    borderRadius: radii.buttonXl,
    backgroundColor: colors.inputBorder40,
    padding: space[1],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  tabActive: { backgroundColor: colors.elev, ...shadow.xs },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14 },
  labelActive: { color: colors.text },
  labelInactive: { color: colors.textWarm },
});
