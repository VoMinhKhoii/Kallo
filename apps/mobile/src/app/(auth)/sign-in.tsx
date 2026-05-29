import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '~/lib/supabase';

// Required so the in-app browser dismisses correctly after the OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
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
    router.replace('/(app)');
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
      if (!data?.url) throw new Error('Could not start Google sign-in.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return; // user cancelled

      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.code;
      if (typeof code !== 'string') throw new Error('No authorization code returned.');

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.wordmark}>Nhẩm</Text>
          <Text style={styles.subtitle}>What did you eat?</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#a8a29e"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#a8a29e"
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            disabled={busy}
            onPress={signInWithEmail}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            disabled={busy}
            onPress={signInWithGoogle}
          >
            <Text style={styles.secondaryText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.muted}>New here? </Text>
            <Link href="/(auth)/sign-up" style={styles.link}>
              Create an account
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#fefbf6' },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  wordmark: {
    fontSize: 40,
    color: '#2c2416',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b7355',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e8d5b5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2c2416',
    backgroundColor: '#ffffff',
  },
  error: { color: '#d37b69', fontSize: 14, paddingHorizontal: 4 },
  primary: {
    backgroundColor: '#695e4e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: '#e8d5b5' },
  dividerText: { color: '#a8a29e', fontSize: 13 },
  secondary: {
    borderWidth: 1,
    borderColor: '#e8d5b5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryText: { color: '#2c2416', fontSize: 16, fontWeight: '500' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: '#8b7355', fontSize: 14 },
  link: { color: '#c9a87c', fontSize: 14, fontWeight: '600' },
});
