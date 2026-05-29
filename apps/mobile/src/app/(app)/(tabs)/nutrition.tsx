import { View } from 'react-native';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { space } from '~/theme/tokens';

export default function NutritionScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] }}>
        <Text variant="eyebrow">Nutrition</Text>
        <Text variant="lead" style={{ textAlign: 'center' }}>
          Your long-term macro and micronutrient patterns arrive in Phase 5.
        </Text>
      </View>
    </Screen>
  );
}
