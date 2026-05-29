import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '~/lib/supabase';
import { Button, Screen } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

export default function SignUp() {
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
      router.replace('/(app)');
      return;
    }
    setNotice('Check your email to confirm your account, then sign in.');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text variant="h2" style={styles.center}>
            Create your account
          </Text>
          <Text variant="lead" style={styles.subtitle}>
            Track Vietnamese meals, the way you describe them.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.stone}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
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

          <Button title="Create account" onPress={signUp} loading={busy} />

          <View style={styles.footerRow}>
            <Text variant="small">Already have an account? </Text>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
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
