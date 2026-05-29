import { StyleSheet, View } from 'react-native';
import type { EducationCardData } from '@/lib/nutrition/types';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';

interface PullQuoteProps {
  card: EducationCardData;
}

/** RN port of web `components/nutrition/sections/pull-quote.tsx`. */
export function PullQuote({ card }: PullQuoteProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();

  return (
    <View style={styles.aside}>
      <Text style={styles.eyebrow}>{t('pullQuote.eyebrow')}</Text>
      <Text style={styles.heading}>{tRoot(card.titleKey)}</Text>
      <Text style={styles.body}>{tRoot(card.bodyKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aside: {
    borderLeftWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.accent60,
    paddingLeft: space[5],
    gap: space[3],
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  heading: {
    fontFamily: fonts.serifItalic,
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.09,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textMuted,
  },
});
