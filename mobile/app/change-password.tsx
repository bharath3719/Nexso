/**
 * Forced password change.
 *
 * Reached when /api/auth/login returns forcePasswordReset — a secretary account
 * still on the temporary password issued at society onboarding. The root layout
 * pins the user here until the change succeeds.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, ErrorNotice, Field } from '../src/components/ui';
import { ScreenScroll } from '../src/components/Screen';
import { useAuth } from '../src/lib/auth';
import { api, errorMessage } from '../src/lib/api';
import { COLORS, SPACING } from '../src/theme/tokens';
import { TYPE } from '../src/theme/type';

/** Mirrors the backend's own check in routes/auth.js change-password. */
const MIN_LENGTH = 8;

export default function ChangePassword() {
  const { patchSession, signOut } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && confirm === next && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.changePassword(current, next);
      // The server has cleared force_password_reset; mirror that locally so the
      // auth gate lets go and routes on to the secretary tabs.
      await patchSession({ forcePasswordReset: false });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScreenScroll keyboardAware contentStyle={s.content}>
        <View style={s.header}>
          <Text style={TYPE.pageTitle}>Set a new password</Text>
          <Text style={TYPE.pageSubtitle}>
            Your account is on a temporary password. Choose your own before continuing.
          </Text>
        </View>

        <Banner tone="info">
          Pick something you do not use elsewhere — at least {MIN_LENGTH} characters.
        </Banner>

        <View style={s.form}>
          <Field
            label="Temporary password"
            required
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!busy}
          />

          <Field
            label="New password"
            required
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={tooShort ? `Use at least ${MIN_LENGTH} characters` : null}
            editable={!busy}
          />

          <Field
            label="Confirm new password"
            required
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={mismatch ? 'The two passwords do not match' : null}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!busy}
          />

          {error ? <ErrorNotice message={error} /> : null}

          <Button title="Save and continue" onPress={handleSubmit} loading={busy} disabled={!canSubmit} fullWidth />
          <Button title="Sign out instead" variant="ghost" onPress={() => void signOut()} fullWidth />
        </View>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  content: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.xl, gap: SPACING.xl },
  header: { gap: SPACING.xs, paddingTop: SPACING.md },
  form: { gap: SPACING.lg },
});
