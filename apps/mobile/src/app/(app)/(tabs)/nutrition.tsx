import { View } from 'react-native';
import { AppHeader } from '~/components/app/app-header';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { space } from '~/theme/tokens';

export default function NutritionScreen() {
  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[3] }}>
        <AppHeader />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] }}>
        <Text variant="eyebrow">Nutrition</Text>
        <Text variant="lead" style={{ textAlign: 'center' }}>
          Your long-term macro and micronutrient patterns arrive in Phase 5.
        </Text>
      </View>
    </Screen>
  );
}
