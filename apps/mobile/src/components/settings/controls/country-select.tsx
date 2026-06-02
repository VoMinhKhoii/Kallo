import { X } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslations } from '~/i18n';
import { COUNTRIES } from '~/lib/onboarding/data/countries';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

interface CountrySelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * RN port of the web inline `CountrySelect` (regional.tsx). A searchable
 * bottom-sheet over `COUNTRIES`, filtering on English + Vietnamese name,
 * displaying `"{value} ({vi})"`, clearable.
 */
export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const tOrigin = useTranslations('onboarding.origin');
  const tRegional = useTranslations('settings.regionalPanel');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.value.toLowerCase().includes(search.toLowerCase()) ||
          c.vi.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;
  const selected = COUNTRIES.find((c) => c.value === value);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text
          numberOfLines={1}
          style={[styles.triggerLabel, !value && styles.placeholder]}
        >
          {value
            ? selected
              ? `${value} (${selected.vi})`
              : value
            : tOrigin('selectCountry')}
        </Text>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tRegional('clearLabel')}
            hitSlop={8}
            onPress={() => onChange(null)}
            style={styles.clear}
          >
            <X size={16} color={colors.textWarm} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          {/* No-op Pressable swallows taps on the sheet so only the backdrop closes. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.searchWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={tOrigin('searchCountry')}
                placeholderTextColor={colors.textWarm}
                autoFocus
                style={styles.searchInput}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>{tOrigin('noCountries')}</Text>
              }
              renderItem={({ item }) => {
                const isSelected = value === item.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      isSelected && styles.rowSelected,
                      pressed && !isSelected && styles.rowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        isSelected && styles.rowLabelSelected,
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text style={styles.rowVi}>{item.vi}</Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
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
    borderRadius: radii.buttonXl,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cream,
    paddingVertical: space[2] + 2,
    paddingLeft: space[4],
    paddingRight: space[2],
    gap: space[2],
  },
  triggerLabel: {
    flexShrink: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.text,
  },
  placeholder: { color: colors.textWarm },
  clear: { padding: space[1] },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 22, 0.2)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radii['3xl'],
    borderTopRightRadius: radii['3xl'],
    backgroundColor: colors.elev,
    paddingTop: space[3],
    paddingBottom: space[6],
  },
  searchWrap: {
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    borderBottomWidth: 1,
    borderColor: colors.inputBorder,
  },
  searchInput: {
    borderRadius: radii.md,
    backgroundColor: colors.track,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.text,
  },
  empty: {
    paddingVertical: space[4],
    textAlign: 'center',
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textWarm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  rowSelected: { backgroundColor: colors.accent10 },
  rowPressed: { backgroundColor: colors.track },
  rowLabel: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.text },
  rowLabelSelected: { fontFamily: fonts.sansMedium },
  rowVi: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textWarm },
});
