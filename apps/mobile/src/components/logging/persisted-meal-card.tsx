import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PersistedMeal } from '@/lib/api/contracts/meals';
import { fmtG, fmtKcal } from '~/lib/logging/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, space } from '~/theme/tokens';

/** A saved meal in the day's feed — collapsed by default, expandable. */
export function PersistedMealCard({ meal }: { meal: PersistedMeal }) {
  const [collapsed, setCollapsed] = useState(true);
  const n = meal.nutrition;
  const time = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card style={styles.card}>
      <Text variant="meta">{time}</Text>
      <Pressable style={styles.headerRow} onPress={() => setCollapsed((c) => !c)}>
        <Text variant="mealQuote" style={styles.quote}>
          {meal.rawInput}
        </Text>
        <ChevronDown
          color={colors.stone}
          size={18}
          style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }}
        />
      </Pressable>

      <View style={styles.macroRow}>
        <Text variant="small" style={styles.macros}>
          {`P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}`}
        </Text>
        <Text variant="numInline">{fmtKcal(n.caloriesKcal)}</Text>
      </View>

      {!collapsed ? (
        <View style={styles.details}>
          {meal.mealItemGroups.map((group) => (
            <View key={`${group.order}-${group.name}`} style={styles.groupRow}>
              <Text variant="small" style={styles.groupName}>
                {group.name}
              </Text>
              <Text variant="meta">{fmtKcal(group.nutrition.caloriesKcal)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[3], gap: space[1] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  quote: { flex: 1 },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  macros: { color: colors.textMuted },
  details: {
    marginTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space[2],
    gap: space[1],
  },
  groupRow: { flexDirection: 'row', justifyContent: 'space-between' },
  groupName: { color: colors.text, flex: 1 },
});
