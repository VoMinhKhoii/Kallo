import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslations } from '~/i18n';
import { supabase } from '~/lib/supabase';
import { Button, Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

export default function SignUp() {
  const t = useTranslations('auth.signUp');
  const tDialog = useTranslations('auth.dialog');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signUp = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace('/logging');
      return;
    }
    setNotice(t('success'));
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text variant="h2" style={styles.center}>
            {t('title')}
          </Text>
          <Text variant="lead" style={styles.subtitle}>
            {tDialog('signUpSubtitle')}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={t('email')}
            placeholderTextColor={colors.stone}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder={t('password')}
            placeholderTextColor={colors.stone}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text variant="small" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text variant="small" style={styles.notice}>
              {notice}
            </Text>
          ) : null}

          <Button title={t('submit')} onPress={signUp} loading={busy} />

          <View style={styles.footerRow}>
            <Text variant="small">{`${t('hasAccount')} `}</Text>
            <Link href="/sign-in" style={styles.link}>
              {t('signInLink')}
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: space[3] },
  center: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: space[4] },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    fontSize: 16,
    fontFamily: fonts.sansRegular,
    color: colors.text,
    backgroundColor: colors.elev,
  },
  error: { color: colors.danger, paddingHorizontal: space[1] },
  notice: { color: colors.success, paddingHorizontal: space[1] },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: space[4] },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent },
});
