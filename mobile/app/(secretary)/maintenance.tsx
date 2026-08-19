/**
 * Secretary maintenance — dues for one month.
 *
 * Month is navigated with prev/next arrows rather than a picker: secretaries
 * work in the current month and occasionally step back one.
 *
 * A due whose month has been formally closed cannot be edited — the backend
 * returns 403 month_closed. That is surfaced as the message it sends rather
 * than being pre-empted here, since the closure state is not in this response.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, ChipGroup, Row, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { DUE_FILTERS } from '../../src/constants';
import { COLORS, DUE_STATUS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { addMonths, currentMonth, formatINR, formatINRShort, formatMonth } from '../../src/utils/format';

type Due = {
  id: number;
  resident_name: string;
  resident_phone: string | null;
  unit_number: string;
  tower_name: string | null;
  amount: string;
  due_month: string;
  due_date: string;
  status: string;
  claimed_utr: string | null;
};

type Stats = {
  total: number;
  paid: number;
  pending: number;
  pendingVerification: number;
  overdue: number;
  totalAmount: number;
  collectedAmount: number;
};

export default function Maintenance() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<(typeof DUE_FILTERS)[number]['value']>('ALL');
  const [busy, setBusy] = useState<number | null>(null);

  const state = useApi<{ dues: Due[]; stats: Stats }>(
    (signal) => api.secretary.maintenance.list({ month, status }, signal),
    [month, status],
  );

  const stats = state.data?.stats;
  const isCurrentMonth = month === currentMonth();

  function markPaid(due: Due) {
    Alert.alert(
      'Mark as paid?',
      `${due.resident_name} · ${due.unit_number} · ${formatINR(due.amount)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            setBusy(due.id);
            try {
              await api.secretary.maintenance.updateDue(due.id, { status: 'PAID' });
              await state.refresh();
            } catch (err) {
              Alert.alert('Could not update', errorMessage(err));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  async function sendReminders() {
    Alert.alert(
      'Send reminders?',
      `Every resident with an unpaid due for ${formatMonth(month)} will get a WhatsApp message.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await api.secretary.maintenance.sendReminders(month);
              Alert.alert('Reminders sent', 'Residents with unpaid dues have been messaged.');
            } catch (err) {
              Alert.alert('Could not send reminders', errorMessage(err));
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.dues ?? []).length === 0}
      empty={{
        icon: 'receipt-outline',
        title: `No dues for ${formatMonth(month)}`,
        message:
          status === 'ALL'
            ? 'Dues for this month have not been generated yet. They are created automatically on the society due day.'
            : 'No dues match this filter. Try another one.',
      }}
      header={
        <>
          {/* Month stepper */}
          <Card padded={false}>
            <View style={s.monthBar}>
              <Button title="" icon="chevron-back" variant="ghost" onPress={() => setMonth(addMonths(month, -1))} />
              <Text style={[TYPE.sectionHeader, s.monthLabel]}>{formatMonth(month)}</Text>
              <Button
                title=""
                icon="chevron-forward"
                variant="ghost"
                disabled={isCurrentMonth}
                onPress={() => setMonth(addMonths(month, 1))}
              />
            </View>

            {stats ? (
              <View style={s.summary}>
                <Summary label="Collected" value={formatINRShort(stats.collectedAmount)} tone={COLORS.success} />
                <Summary label="Billed" value={formatINRShort(stats.totalAmount)} tone={COLORS.textPrimary} />
                <Summary label="Unpaid" value={String(stats.pending + stats.overdue)} tone={COLORS.danger} />
              </View>
            ) : null}
          </Card>

          {stats && stats.pendingVerification > 0 ? (
            <Card padded={false}>
              <Row last onPress={() => router.push('/(secretary)/verify-payments')}>
                <View style={[s.icon, { backgroundColor: COLORS.infoTint }]}>
                  <Ionicons name="checkmark-done-outline" size={19} color={COLORS.info} />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle}>
                    {stats.pendingVerification} payment{stats.pendingVerification === 1 ? '' : 's'} to confirm
                  </Text>
                  <Text style={TYPE.rowMeta}>Residents reported a UPI transfer</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </Row>
            </Card>
          ) : null}

          <ChipGroup options={DUE_FILTERS} value={status} onChange={setStatus} />

          <Button
            title="Send WhatsApp reminders"
            icon="paper-plane-outline"
            variant="secondary"
            onPress={sendReminders}
            fullWidth
          />
        </>
      }
    >
      {(data) => (
        <Card padded={false}>
          {(data.dues ?? []).map((due, i, arr) => {
            const settled = due.status === 'PAID' || due.status === 'WAIVED';
            const canMarkPaid = !settled && due.status !== 'PENDING_VERIFICATION';

            return (
              <View key={due.id} style={i < arr.length - 1 ? s.divided : undefined}>
                <View style={s.dueRow}>
                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle} numberOfLines={1}>
                      {due.unit_number}
                      {due.tower_name ? ` · ${due.tower_name}` : ''}
                    </Text>
                    <Text style={TYPE.rowMeta} numberOfLines={1}>
                      {due.resident_name}
                    </Text>
                    {due.claimed_utr ? <Text style={TYPE.caption}>UTR {due.claimed_utr}</Text> : null}
                  </View>
                  <View style={s.dueRight}>
                    <Text style={TYPE.amount}>{formatINR(due.amount)}</Text>
                    <StatusPill status={due.status} map={DUE_STATUS} />
                  </View>
                </View>

                {canMarkPaid ? (
                  <View style={s.dueActions}>
                    <Button
                      title="Mark as paid"
                      variant="secondary"
                      loading={busy === due.id}
                      onPress={() => markPaid(due)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={s.summaryItem}>
      <Text style={[s.summaryValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={TYPE.caption}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  monthBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs },
  monthLabel: { flex: 1, textAlign: 'center' },

  summary: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    paddingVertical: SPACING.md,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: SPACING.xs },
  summaryValue: { fontSize: 17, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },

  icon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },

  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  dueRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  dueRight: { alignItems: 'flex-end', gap: SPACING.xs },
  dueActions: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, alignItems: 'flex-start' },
});
