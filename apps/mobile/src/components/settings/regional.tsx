import { Globe, MapPin } from 'lucide-react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';
import { CountrySelect } from './country-select';
import type { ProfileFormValues } from './profile';

/** RN port of web `components/settings/profile/regional.tsx`. */
export function Regional() {
  const tOrigin = useTranslations('onboarding.origin');
  const tRegional = useTranslations('settings.regionalPanel');
  const { control } = useFormContext<ProfileFormValues>();

  return (
    <View style={styles.root}>
      <Text style={styles.desc}>{tRegional('description')}</Text>
      <View style={styles.fields}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Globe size={16} color={colors.accent} />
            <Text style={styles.label}>{tOrigin('countryOfOrigin')}</Text>
          </View>
          <Controller
            control={control}
            name="countryOfOrigin"
            render={({ field }) => (
              <CountrySelect value={field.value} onChange={field.onChange} />
            )}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <MapPin size={16} color={colors.accent} />
            <Text style={styles.label}>{tOrigin('countryOfResidence')}</Text>
          </View>
          <Controller
            control={control}
            name="countryOfResidence"
            render={({ field }) => (
              <CountrySelect value={field.value} onChange={field.onChange} />
            )}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[5] },
  desc: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textWarm,
  },
  fields: { gap: space[4] },
  field: { gap: space[2] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
});
