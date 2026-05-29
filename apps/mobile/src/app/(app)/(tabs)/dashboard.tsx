import { View } from 'react-native';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { space } from '~/theme/tokens';

export default function DashboardScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] }}>
        <Text variant="eyebrow">Dashboard</Text>
        <Text variant="lead" style={{ textAlign: 'center' }}>
          Your calorie ring, weight trend, and consistency heatmap arrive in Phase 4.
        </Text>
      </View>
    </Screen>
  );
}
