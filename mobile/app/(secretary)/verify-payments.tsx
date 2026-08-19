/**
 * Confirm UPI payments.
 *
 * The UPI rail has no webhook — a plain VPA does not reliably echo back the
 * reference we set, so a resident declares their UTR on the /pay page and the
 * due parks at PENDING_VERIFICATION until a human confirms it. This screen is
 * that human's queue, and it is the single best reason for a secretary to have
 * the app: confirming a payment stops being a desk task.
 *
 * Confirming sets the due to PAID with the UTR as the payment reference;
 * rejecting sends it back to PENDING with a reason.
 */

import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Banner, Button, Card, Field } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatINR, formatMonth, formatRelative } from '../../src/utils/format';

type PendingDue = {
  id: number;
  amount: string;
  due_month: string;
  due_date: string;
  claimed_utr: string | null;
  claimed_at: string | null;
  payment_mode: string | null;
  resident_name: string;
  resident_phone: string | null;
  unit_number: string | null;
  tower_name: string | null;
};

export default function VerifyPayments() {
  const state = useApi<{ dues: PendingDue[] }>(
    (signal) => api.secretary.maintenance.pendingVerification(signal),
    [],
  );

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.dues ?? []).length === 0}
      empty={{
        icon: 'checkmark-done-circle-outline',
        title: 'Nothing to confirm',
        message: 'When a resident reports a UPI payment, it will appear here for you to check against your bank statement.',
      }}
      header={
        <Banner tone="info">
          Check each reference against your society bank statement before confirming. Confirming marks
          the due paid and records the UTR as the payment reference.
        </Banner>
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.dues ?? []).map((due) => (
            <PendingCard key={due.id} due={due} onDone={state.refresh} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PendingCard({ due, onDone }: { due: PendingDue; onDone: () => void }) {
  const [busy, setBusy] = useState<'verify' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function confirm() {
    setBusy('verify');
    try {
      await api.secretary.maintenance.verifyPayment(due.id);
      onDone();
    } catch (err) {
      Alert.alert('Could not confirm', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) return;
    setBusy('reject');
    try {
      await api.secretary.maintenance.rejectPayment(due.id, reason.trim());
      setRejecting(false);
      setReason('');
      onDone();
    } catch (err) {
      Alert.alert('Could not reject', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function call() {
    if (due.resident_phone) Linking.openURL(`tel:${due.resident_phone}`).catch(() => {});
  }

  return (
    <Card padded={false}>
      <View style={s.head}>
        <View style={s.flex}>
          <Text style={TYPE.sectionHeader} numberOfLines={1}>
            {due.unit_number ?? 'Unit —'}
            {due.tower_name ? ` · ${due.tower_name}` : ''}
          </Text>
          <Text style={TYPE.rowMeta} numberOfLines={1}>
            {due.resident_name}
          </Text>
        </View>
        <Text style={s.amount}>{formatINR(due.amount)}</Text>
      </View>

      <View style={s.utrBox}>
        <Text style={TYPE.overline}>Reference / UTR</Text>
        <Text style={s.utr} selectable>
          {due.claimed_utr ?? 'Not provided'}
        </Text>
        <Text style={TYPE.caption}>
          Reported {formatRelative(due.claimed_at)}
          {due.payment_mode ? ` · ${due.payment_mode}` : ''}
        </Text>
      </View>

      <View style={s.meta}>
        <MetaRow icon="calendar-outline" text={`For ${formatMonth(due.due_month)}`} />
        {due.resident_phone ? <MetaRow icon="call-outline" text={due.resident_phone} /> : null}
      </View>

      {rejecting ? (
        <View style={s.rejectForm}>
          <Field
            label="Why are you rejecting this?"
            required
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. No matching credit in the bank statement"
            multiline
            numberOfLines={3}
            hint="The resident sees this, and the due goes back to Pending."
            editable={busy === null}
          />
          <View style={s.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setRejecting(false);
                setReason('');
              }}
              style={s.flex}
            />
            <Button
              title="Reject"
              variant="danger"
              onPress={reject}
              loading={busy === 'reject'}
              disabled={!reason.trim()}
              style={s.flex}
            />
          </View>
        </View>
      ) : (
        <View style={s.actions}>
          {due.resident_phone ? (
            <Button title="" icon="call-outline" variant="secondary" onPress={call} />
          ) : null}
          <Button title="Reject" variant="secondary" onPress={() => setRejecting(true)} style={s.flex} />
          <Button title="Confirm paid" onPress={confirm} loading={busy === 'verify'} style={s.flex} />
        </View>
      )}
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
  amount: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },

  utrBox: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.cardMuted,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  // Selectable and monospaced so a secretary can compare it against a bank
  // statement character by character, and copy it if they need to search.
  utr: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },

  meta: { padding: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  rejectForm: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  actions: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
});
