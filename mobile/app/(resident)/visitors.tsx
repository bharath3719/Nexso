/**
 * Visitor passes.
 *
 * The pass code is the product here: the resident shares it with their visitor,
 * who shows it at the gate for the guard to verify. So the code is the largest
 * thing on each card and sharing it is one tap.
 */

import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, ChipGroup, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, API_BASE, errorMessage } from '../../src/lib/api';
import { COLORS, PASS_STATUS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateTime } from '../../src/utils/format';

type Pass = {
  id: number;
  pass_code: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string | null;
  vehicle: string | null;
  valid_from: string;
  valid_until: string;
  status: string;
};

const FILTERS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ALL', label: 'All' },
] as const;

export default function Visitors() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ACTIVE');

  const state = useApi<{ passes: Pass[] }>(
    (signal) => api.resident.visitorPasses.list({ status: filter }, signal),
    [filter],
  );

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.passes ?? []).length === 0}
      empty={{
        icon: 'qr-code-outline',
        title: filter === 'ACTIVE' ? 'No active passes' : 'No passes yet',
        message: 'Create a pass and share the code with your visitor to speed them through the gate.',
        action: <Button title="Create a pass" icon="add" onPress={() => router.push('/(resident)/new-pass')} />,
      }}
      header={
        <>
          <ChipGroup options={FILTERS} value={filter} onChange={setFilter} />
          <Button title="New visitor pass" icon="add" onPress={() => router.push('/(resident)/new-pass')} fullWidth />
        </>
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.passes ?? []).map((pass) => (
            <PassCard key={pass.id} pass={pass} onChanged={state.refresh} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PassCard({ pass, onChanged }: { pass: Pass; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const isActive = pass.status === 'ACTIVE';

  // The public pass page is served by the backend, not the SPA — see
  // routes/passes.js and the /pass/:passCode route on the web.
  const passUrl = `${API_BASE}/pass/${pass.pass_code}`;

  async function handleShare() {
    const message =
      `Your visitor pass for ${pass.visitor_name}\n\n` +
      `Code: ${pass.pass_code}\n` +
      `Valid: ${formatDateTime(pass.valid_from)} to ${formatDateTime(pass.valid_until)}\n\n` +
      `Show this code at the gate.\n${passUrl}`;

    // The OS share sheet covers WhatsApp, SMS and email in one action — the web
    // portal needs a separate button per channel.
    await Share.share({ message, title: 'Visitor Pass' }).catch(() => {});
  }

  function handleRevoke() {
    Alert.alert(
      'Revoke this pass?',
      `${pass.visitor_name} will no longer be able to enter with code ${pass.pass_code}.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api.resident.visitorPasses.revoke(pass.id);
              onChanged();
            } catch (err) {
              Alert.alert('Could not revoke', errorMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Card padded={false}>
      <View style={s.head}>
        <View style={s.flex}>
          <Text style={TYPE.sectionHeader} numberOfLines={1}>
            {pass.visitor_name}
          </Text>
          <Text style={TYPE.rowMeta} numberOfLines={1}>
            {[pass.purpose, pass.visitor_phone].filter(Boolean).join(' · ') || 'Visitor'}
          </Text>
        </View>
        <StatusPill status={pass.status} map={PASS_STATUS} />
      </View>

      <Pressable
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel={`Pass code ${pass.pass_code.split('').join(' ')}. Tap to share.`}
        style={({ pressed }) => [s.codeBox, !isActive && s.codeBoxMuted, pressed && { opacity: 0.7 }]}
      >
        <Text style={TYPE.overline}>Pass code</Text>
        <Text style={[s.code, !isActive && { color: COLORS.textMuted }]}>{pass.pass_code}</Text>
        <View style={s.tapHint}>
          <Ionicons name="share-social-outline" size={13} color={COLORS.textMuted} />
          <Text style={TYPE.caption}>Tap to share</Text>
        </View>
      </Pressable>

      <View style={s.meta}>
        <MetaRow icon="time-outline" text={`From ${formatDateTime(pass.valid_from)}`} />
        <MetaRow icon="hourglass-outline" text={`Until ${formatDateTime(pass.valid_until)}`} />
        {pass.vehicle ? <MetaRow icon="car-outline" text={pass.vehicle} /> : null}
      </View>

      {isActive ? (
        <View style={s.actions}>
          <Button title="Share" icon="share-social-outline" variant="secondary" onPress={handleShare} style={s.flex} />
          <Button title="Revoke" variant="danger" onPress={handleRevoke} loading={busy} style={s.flex} />
        </View>
      ) : null}
    </Card>
  );
}

function MetaRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.metaRow}>
      <Ionicons name={icon} size={15} color={COLORS.textMuted} />
      <Text style={[TYPE.rowMeta, s.flex]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.md },

  codeBox: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.primaryTint,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bfdbfe',
  },
  codeBoxMuted: { backgroundColor: COLORS.cardMuted, borderColor: COLORS.border },
  code: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: 3, color: COLORS.primaryDark },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 },

  meta: { padding: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  actions: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
});
