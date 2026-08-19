/**
 * Secretary account.
 *
 * Society details are read-only — they belong to the admin portal's onboarding
 * flow. What a secretary can do here is change their own password and see the
 * society's payment configuration, which explains why residents do or do not
 * see a "Pay now" button.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, Card, ErrorNotice, Field, InfoRow, Loading } from '../../src/components/ui';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { useAuth, useSession } from '../../src/lib/auth';
import { COLORS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

const MIN_LENGTH = 8;

type MaintenanceConfig = {
  maintenance_enabled?: boolean;
  maintenance_upi_id?: string | null;
  maintenance_payee_name?: string | null;
};

export default function SecretaryProfile() {
  const session = useSession();
  const { signOut } = useAuth();

  const state = useApi<{ account: Record<string, unknown> }>((signal) => api.auth.me(signal), []);
  const config = useApi<MaintenanceConfig>((signal) => api.secretary.maintenance.getConfig(signal), []);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const { mutate, pending, error } = useMutation(api.auth.changePassword);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canChange = current.length > 0 && next.length >= MIN_LENGTH && confirm === next && !pending;

  async function changePassword() {
    if (!canChange) return;
    const done = await mutate(current, next);
    if (done) {
      setCurrent('');
      setNext('');
      setConfirm('');
      Alert.alert('Password changed', 'Use your new password the next time you sign in.');
    }
  }

  if (state.loading && !state.data) return <Loading />;

  const account = (state.data?.account ?? {}) as Record<string, string | null>;
  const cfg = config.data ?? {};
  const collectionOn = Boolean(cfg.maintenance_enabled);

  return (
    <ScreenScroll keyboardAware refreshing={state.refreshing} onRefresh={state.refresh}>
      {state.error ? <ErrorNotice message={state.error} onRetry={state.reload} /> : null}

      <Card>
        <Text style={TYPE.sectionHeader}>Society</Text>
        <View style={s.info}>
          <InfoRow label="Name" value={session.societyName ?? account.society_name} />
          <InfoRow label="Building ID" value={account.building_id} />
          <InfoRow label="Type" value={account.society_type} />
          <InfoRow label="Address" value={account.address} />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Maintenance collection</Text>
        <View style={s.info}>
          <InfoRow label="Status" value={collectionOn ? 'Enabled' : 'Not enabled'} />
          <InfoRow label="UPI ID" value={cfg.maintenance_upi_id || 'Not set'} />
          <InfoRow label="Payee name" value={cfg.maintenance_payee_name || 'Not set'} />
        </View>
        {!collectionOn || !cfg.maintenance_upi_id ? (
          <Banner tone="warning">
            Without a UPI ID, residents see their bills but get no "Pay now" button. Set one up in the
            web portal under Maintenance.
          </Banner>
        ) : null}
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Your account</Text>
        <View style={s.info}>
          <InfoRow label="Username" value={session.username} />
          <InfoRow label="Role" value="Secretary" />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Change password</Text>
        <View style={s.form}>
          <Field
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!pending}
          />
          <Field
            label="New password"
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={tooShort ? `Use at least ${MIN_LENGTH} characters` : null}
            editable={!pending}
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={mismatch ? 'The two passwords do not match' : null}
            editable={!pending}
          />

          {error ? <ErrorNotice message={error} /> : null}

          <Button title="Change password" onPress={changePassword} loading={pending} disabled={!canChange} fullWidth />
        </View>
      </Card>

      <Button
        title="Sign out"
        variant="secondary"
        fullWidth
        onPress={() =>
          Alert.alert('Sign out?', 'You will need your username and password to sign back in.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  info: { marginTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  form: { gap: SPACING.lg, marginTop: SPACING.md },
});
