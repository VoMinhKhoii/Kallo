import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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

// Required so the in-app browser dismisses correctly after the OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const t = useTranslations('auth.signIn');
  const tDialog = useTranslations('auth.dialog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithEmail = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/logging');
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error(tDialog('googleError'));

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return; // user cancelled

      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.code;
      if (typeof code !== 'string') throw new Error(tDialog('googleError'));

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      router.replace('/logging');
    } catch (e) {
      setError(e instanceof Error ? e.message : tDialog('googleError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text variant="h1" style={styles.center}>
            Nhẩm
          </Text>
          <Text variant="lead" style={styles.subtitle}>
            {tDialog('signInSubtitle')}
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
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text variant="small" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button title={t('submit')} onPress={signInWithEmail} loading={busy} />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text variant="small" style={styles.dividerText}>
              {tCommon('or')}
            </Text>
            <View style={styles.divider} />
          </View>

          <Button
            title={tDialog('continueWithGoogle')}
            variant="secondary"
            onPress={signInWithGoogle}
            disabled={busy}
          />

          <View style={styles.footerRow}>
            <Text variant="small">{t('noAccount')} </Text>
            <Link href="/sign-up" style={styles.link}>
              {t('signUpLink')}
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
  subtitle: { textAlign: 'center', marginBottom: space[5] },
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginVertical: space[1],
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.stone },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: space[4] },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent },
});
