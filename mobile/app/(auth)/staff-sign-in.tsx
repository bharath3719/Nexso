/**
 * Secretary sign-in — username and password against /api/auth/login.
 *
 * Vendor, guard and admin accounts authenticate successfully here too; the root
 * layout turns them away at /(auth)/unsupported-role rather than this screen
 * pre-judging the role, because the role is only known after the token is issued.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenScroll } from '../../src/components/Screen';
import { Button, ErrorNotice, Field } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { errorMessage } from '../../src/lib/api';
import { COLORS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

export default function StaffSignIn() {
  const router = useRouter();
  const { signInWithPassword } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(username, password);
      // The root auth gate routes from here — to the secretary tabs, to
      // /change-password on a temporary password, or to unsupported-role.
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenScroll keyboardAware contentStyle={s.content}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={s.back}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Pressable>

        <View style={s.header}>
          <Text style={TYPE.pageTitle}>Secretary sign-in</Text>
          <Text style={TYPE.pageSubtitle}>
            Use the username and password issued when your society was set up.
          </Text>
        </View>

        <View style={s.form}>
          <Field
            label="Username"
            required
            value={username}
            onChangeText={setUsername}
            placeholder="secretary.greenwood"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            editable={!busy}
          />

          <Field
            label="Password"
            required
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!busy}
          />

          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showPassword }}
            hitSlop={8}
            style={s.toggle}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color={COLORS.textSecondary}
            />
            <Text style={TYPE.rowMeta}>{showPassword ? 'Hide password' : 'Show password'}</Text>
          </Pressable>

          {error ? <ErrorNotice message={error} /> : null}

          <Button title="Sign in" onPress={handleSubmit} loading={busy} disabled={!canSubmit} fullWidth />
        </View>

        <View style={s.footer}>
          <Text style={[TYPE.caption, { textAlign: 'center' }]}>
            Forgot your password? Ask your Nexso administrator to reset it — they can issue a new
            temporary password from the admin portal.
          </Text>
        </View>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  content: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.xl, gap: SPACING.xl, flexGrow: 1 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { gap: SPACING.xs },
  form: { gap: SPACING.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start' },
  footer: { marginTop: 'auto', paddingTop: SPACING.xl },
});
