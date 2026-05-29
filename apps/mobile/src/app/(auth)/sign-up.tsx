import { Link, useRouter } from 'expo-router';
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
      // Email confirmation disabled — straight into the app.
      router.replace('/(app)');
      return;
    }
    // Email confirmation required.
    setNotice('Check your email to confirm your account, then sign in.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.wordmark}>Create your account</Text>
          <Text style={styles.subtitle}>Track Vietnamese meals, the way you describe them.</Text>

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
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            disabled={busy}
            onPress={signUp}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  wordmark: { fontSize: 30, color: '#2c2416', textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: '#8b7355',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
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
  notice: { color: '#7ca368', fontSize: 14, paddingHorizontal: 4 },
  primary: {
    backgroundColor: '#695e4e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: '#8b7355', fontSize: 14 },
  link: { color: '#c9a87c', fontSize: 14, fontWeight: '600' },
});
