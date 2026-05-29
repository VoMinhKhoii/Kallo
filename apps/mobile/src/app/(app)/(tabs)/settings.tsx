import { View } from 'react-native';
import { AppHeader } from '~/components/app/app-header';
import { useTranslations } from '~/i18n';
import { Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { space } from '~/theme/tokens';

/** Settings — placeholder until the Phase 5 port (mirrors the web settings form). */
export default function SettingsScreen() {
  const t = useTranslations('app.mainSidebar');
  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[3] }}>
        <AppHeader />
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space[6],
          gap: space[2],
        }}
      >
        <Text variant="eyebrow">{t('settings')}</Text>
        <Text variant="lead" style={{ textAlign: 'center' }}>
          Coming in Phase 5.
        </Text>
      </View>
    </Screen>
  );
}
