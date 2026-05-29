import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { StreamStatus } from '@/lib/ai/streaming/types';
import type { MealItem } from '@/lib/types/meal';
import { fmtKcal } from '~/lib/logging/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, space } from '~/theme/tokens';

const PHASE_LABELS: Record<string, string> = {
  connecting: 'Connecting…',
  decomposing: 'Breaking down your meal…',
  matching: 'Matching ingredients…',
  estimating: 'Estimating nutrition…',
  assembling: 'Putting it all together…',
};

/** Live preview while the SSE analysis streams: completed items, then names
 * still awaiting macros (the waterfall). */
export function StreamingEntry({
  status,
  items,
  completedItems,
}: {
  status: StreamStatus;
  items: string[];
  completedItems: MealItem[];
}) {
  const completedNames = new Set(completedItems.map((i) => i.name.toLowerCase()));
  const pendingNames = items.filter((n) => !completedNames.has(n.toLowerCase()));

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text variant="small" style={{ color: colors.textMuted }}>
          {PHASE_LABELS[status] ?? 'Analyzing…'}
        </Text>
      </View>
      {completedItems.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text variant="small" style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="meta">{fmtKcal(item.macros.calories)}</Text>
        </View>
      ))}
      {pendingNames.map((name) => (
        <View key={name} style={styles.row}>
          <Text variant="small" style={styles.pendingName} numberOfLines={1}>
            {name}
          </Text>
          <Text variant="meta">…</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[3], gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, flex: 1 },
  pendingName: { color: colors.textMuted, flex: 1 },
});
