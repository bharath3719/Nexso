/**
 * Resident billing.
 *
 * "Pay now" opens `due.payment_link` in an in-app browser. That column is
 * written by services/paymentLinks.js and is either a Razorpay payment link or
 * the society's own /pay/:token page, depending on PAYMENT_PROVIDER — the app
 * neither knows nor needs to know which rail is in use.
 *
 * The bill PDF is downloaded with the session token and handed to the OS share
 * sheet, which is how "save this file" works on a phone.
 */

import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Banner, Button, Card, ChipGroup, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { DUES_FILTERS } from '../../src/constants';
import { COLORS, DUE_STATUS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateShort, formatINR, formatMonth } from '../../src/utils/format';

type Due = {
  id: number;
  due_month: string;
  amount: string;
  due_date: string;
  status: string;
  payment_link: string | null;
  payment_date: string | null;
  payment_reference: string | null;
  claimed_utr: string | null;
  invoice_number: string | null;
  base_amount: string | null;
  expense_share: string | null;
  previously_due: string | null;
  interest_amount: string | null;
};

type Filter = (typeof DUES_FILTERS)[number]['value'];

export default function Billing() {
  const [filter, setFilter] = useState<Filter>('pending');

  const state = useApi<{ dues: Due[] }>(
    (signal) => api.resident.maintenance.dues(filter, signal),
    [filter],
  );

  const dues = state.data?.dues ?? [];
  const outstanding = dues.filter((d) => d.status !== 'PENDING_VERIFICATION');
  const total = outstanding.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.dues ?? []).length === 0}
      empty={{
        icon: filter === 'pending' ? 'checkmark-done-circle-outline' : 'receipt-outline',
        title: filter === 'pending' ? 'Nothing outstanding' : 'No payment history yet',
        message:
          filter === 'pending'
            ? 'You have no unpaid maintenance bills. Nice.'
            : 'Bills you have paid will appear here.',
      }}
      header={
        <>
          <ChipGroup options={DUES_FILTERS} value={filter} onChange={setFilter} />
          {filter === 'pending' && total > 0 ? (
            <Card>
              <Text style={TYPE.overline}>Total outstanding</Text>
              <Text style={s.total}>{formatINR(total)}</Text>
              <Text style={TYPE.rowMeta}>
                across {outstanding.length} {outstanding.length === 1 ? 'bill' : 'bills'}
              </Text>
            </Card>
          ) : null}
        </>
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.dues ?? []).map((due) => (
            <DueCard key={due.id} due={due} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function DueCard({ due }: { due: Due }) {
  const [busy, setBusy] = useState<'pay' | 'pdf' | null>(null);

  const isPaid = due.status === 'PAID' || due.status === 'WAIVED';
  const isConfirming = due.status === 'PENDING_VERIFICATION';
  const canPay = Boolean(due.payment_link) && !isPaid && !isConfirming;

  async function handlePay() {
    if (!due.payment_link) return;
    setBusy('pay');
    try {
      // An in-app browser keeps the user inside Nexso and, unlike a raw
      // Linking.openURL, returns control here when the payment page closes.
      await WebBrowser.openBrowserAsync(due.payment_link, {
        toolbarColor: COLORS.card,
        controlsColor: COLORS.primary,
      });
    } catch {
      // Some devices have no browser the custom-tab API can bind to; fall back
      // to whatever handles http.
      await Linking.openURL(due.payment_link).catch(() =>
        Alert.alert('Cannot open payment page', 'No browser is available on this device.'),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy('pdf');
    try {
      await api.resident.maintenance.downloadInvoicePdf(due.id, due.invoice_number ?? due.due_month);
    } catch (err) {
      Alert.alert('Could not open the bill', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  // Only shown when the society itemises bills; a flat-rate society sends
  // amount alone and every component is null.
  const breakdown = [
    { label: 'Maintenance', value: due.base_amount },
    { label: 'Expense share', value: due.expense_share },
    { label: 'Previous balance', value: due.previously_due },
    { label: 'Interest', value: due.interest_amount },
  ].filter((r) => r.value != null && Number(r.value) !== 0);

  return (
    <Card padded={false}>
      <View style={s.cardTop}>
        <View style={s.flex}>
          <Text style={TYPE.sectionHeader}>{formatMonth(due.due_month)}</Text>
          <Text style={TYPE.rowMeta}>
            {isPaid && due.payment_date
              ? `Paid on ${formatDateShort(due.payment_date)}`
              : `Due by ${formatDateShort(due.due_date)}`}
          </Text>
          {due.invoice_number ? (
            <Text style={TYPE.caption}>Invoice {due.invoice_number}</Text>
          ) : null}
        </View>
        <View style={s.cardTopRight}>
          <Text style={s.amount}>{formatINR(due.amount)}</Text>
          <StatusPill status={due.status} map={DUE_STATUS} />
        </View>
      </View>

      {breakdown.length > 0 ? (
        <View style={s.breakdown}>
          {breakdown.map((row) => (
            <View key={row.label} style={s.breakdownRow}>
              <Text style={TYPE.rowMeta}>{row.label}</Text>
              <Text style={[TYPE.rowMeta, s.breakdownValue]}>{formatINR(row.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isConfirming ? (
        <View style={s.notice}>
          <Banner tone="info">
            Your payment has been reported{due.claimed_utr ? ` (UTR ${due.claimed_utr})` : ''} and is waiting
            for your secretary to confirm it.
          </Banner>
        </View>
      ) : null}

      {isPaid && due.payment_reference ? (
        <View style={s.notice}>
          <View style={s.refRow}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={TYPE.caption}>Reference {due.payment_reference}</Text>
          </View>
        </View>
      ) : null}

      <View style={s.actions}>
        {canPay ? (
          <Button
            title="Pay now"
            icon="card-outline"
            onPress={handlePay}
            loading={busy === 'pay'}
            style={s.flex}
          />
        ) : null}
        <Button
          title="Bill PDF"
          icon="download-outline"
          variant="secondary"
          onPress={handleDownload}
          loading={busy === 'pdf'}
          style={s.flex}
        />
      </View>

      {!canPay && !isPaid && !isConfirming ? (
        <View style={s.notice}>
          <Text style={TYPE.caption}>
            Online payment is not set up for your society yet. Please pay your secretary directly.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },

  total: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: COLORS.textPrimary, marginVertical: 2 },

  cardTop: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.md },
  cardTopRight: { alignItems: 'flex-end', gap: SPACING.xs },
  amount: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },

  breakdown: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.cardMuted,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  breakdownValue: { fontVariant: ['tabular-nums'], color: COLORS.textBody },

  notice: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },

  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.xs,
  },
});
