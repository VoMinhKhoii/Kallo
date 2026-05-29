import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PersistedMeal } from '@/lib/api/contracts/meals';
import { useTranslations } from '~/i18n';
import { fmtG, fmtKcal } from '~/lib/logging/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fontSize, leading, radii, shadow, space } from '~/theme/tokens';

const r = Math.round;

/** A saved meal in the day's feed — collapsed by default, expandable. */
export function PersistedMealCard({ meal }: { meal: PersistedMeal }) {
  const t = useTranslations('logging.mealEntry');
  const [collapsed, setCollapsed] = useState(true);
  const n = meal.nutrition;
  const time = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card style={styles.card}>
      <Text variant="timeLabel" style={styles.time}>
        {time}
      </Text>
      <Pressable style={styles.headerRow} onPress={() => setCollapsed((c) => !c)}>
        <Text variant="mealQuote" style={styles.quote}>
          {meal.rawInput}
        </Text>
        <View style={styles.chevronButton}>
          <ChevronDown
            color={colors.textMuted}
            size={16}
            style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }}
          />
        </View>
      </Pressable>

      <View style={styles.macroRow}>
        <Text variant="captionTabular">
          {`P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}`}
        </Text>
        <Text variant="numStrong" style={styles.summaryCalories}>
          {fmtKcal(n.caloriesKcal)}
        </Text>
      </View>

      {!collapsed ? (
        <View style={styles.details}>
          <View style={styles.itemList}>
            {meal.mealItemGroups.map((group) => (
              <View key={`${group.order}-${group.name}`} style={styles.groupRow}>
                <Text
                  variant="itemName"
                  style={styles.groupName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {group.name}
                </Text>
                <View style={styles.groupRight}>
                  <View style={styles.groupMacros}>
                    <Text variant="macroTiny">{`P:${fmtG(group.nutrition.proteinG)}`}</Text>
                    <Text variant="macroTiny">{`C:${fmtG(group.nutrition.carbohydrateG)}`}</Text>
                    <Text variant="macroTiny">{`F:${fmtG(group.nutrition.fatG)}`}</Text>
                  </View>
                  <Text variant="calorieBold">{fmtKcal(group.nutrition.caloriesKcal)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.totalsRow}>
            <Text variant="calorieBold">{t('total')}</Text>
            <View style={styles.totalsRight}>
              <Text variant="captionTabular">
                {`P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}`}
              </Text>
              <Text variant="numStrong">{fmtKcal(n.caloriesKcal)}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: space[3],
    borderColor: colors.borderSoft,
    ...shadow.sm,
  },
  time: { marginBottom: space[2] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[2],
  },
  quote: {
    flex: 1,
    fontSize: 17,
    lineHeight: r(17 * leading.relaxed),
  },
  chevronButton: {
    flexShrink: 0,
    padding: space[1],
    borderRadius: radii.pill,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[2],
  },
  summaryCalories: { fontSize: fontSize.sm },
  details: {
    marginTop: space[5],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    paddingTop: space[4],
  },
  itemList: {
    marginBottom: space[4],
    gap: space[1],
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  groupName: { flex: 1, minWidth: 0 },
  groupRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  groupMacros: {
    flexDirection: 'row',
    gap: space[2],
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderHalf,
    borderStyle: 'dashed',
    paddingTop: space[3],
  },
  totalsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
});
