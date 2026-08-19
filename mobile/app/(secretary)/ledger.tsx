/**
 * The month's ledger — every expense and other-income entry, with add/edit.
 *
 * This is the web's Expenses and Other Income tabs. Those are tables; a table
 * does not survive being narrowed to a phone, so each entry is a row that opens
 * for editing instead. The columns a table would show (fund, mode, payee, ref)
 * move into the row's second line and the edit screen.
 *
 * Other income has no PATCH endpoint, so its rows delete rather than edit.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, CardHeader, ChipGroup, EmptyState, Row } from '../../src/components/ui';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { EXPENSE_TYPES, FUND_SOURCES_SHORT, expenseCategoryLabel, labelFor, INCOME_CATEGORIES } from '../../src/constants';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { addMonths, currentMonth, formatDayMonth, formatINR, formatMonth } from '../../src/utils/format';

type ExpenseRow = {
  id: number;
  date: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: string;
  fund_source: string;
  expense_type: string;
  payee_name: string | null;
};

type IncomeRow = {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: string;
  payer_name: string | null;
};

const TABS = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'income', label: 'Other income' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export default function Ledger() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<Tab>('expenses');

  const isCurrentMonth = month === currentMonth();

  const expenses = useApi<{ expenses: ExpenseRow[] }>(
    (signal) => api.secretary.expenses.list({ month }, signal),
    [month],
    { enabled: tab === 'expenses' },
  );
  const income = useApi<{ income: IncomeRow[] }>(
    (signal) => api.secretary.otherIncome.list({ month }, signal),
    [month],
    { enabled: tab === 'income' },
  );

  const header = (
    <>
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
      </Card>

      <ChipGroup options={TABS} value={tab} onChange={setTab} />
    </>
  );

  return tab === 'expenses' ? (
    <ExpenseList
      state={expenses}
      header={header}
      month={month}
      onAdd={() => router.push(`/(secretary)/new-expense?month=${month}`)}
      onEdit={(id) => router.push(`/(secretary)/new-expense?id=${id}&month=${month}`)}
    />
  ) : (
    <IncomeList
      state={income}
      header={header}
      month={month}
      onAdd={() => router.push('/(secretary)/new-income')}
    />
  );
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

function ExpenseList({
  state,
  header,
  month,
  onAdd,
  onEdit,
}: {
  state: ReturnType<typeof useApi<{ expenses: ExpenseRow[] }>>;
  header: React.ReactNode;
  month: string;
  onAdd: () => void;
  onEdit: (id: number) => void;
}) {
  return (
    <Screen
      state={state}
      header={header}
      isEmpty={(d) => d.expenses.length === 0}
      empty={{
        icon: 'receipt-outline',
        title: `Nothing recorded for ${formatMonth(month)}`,
        message: 'Add the first entry as soon as you pay it — it is far easier than reconstructing the month later.',
        action: <Button title="Add expense" icon="add" onPress={onAdd} />,
      }}
    >
      {(data) => {
        const total = data.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        return (
          <>
            <Button title="Add expense" icon="add" onPress={onAdd} fullWidth />

            <Card padded={false}>
              <CardHeader
                title={`${data.expenses.length} ${data.expenses.length === 1 ? 'entry' : 'entries'}`}
                action={<Text style={[TYPE.amount, { color: COLORS.danger }]}>{formatINR(total)}</Text>}
              />
              {data.expenses.map((e, i) => (
                <Row key={e.id} onPress={() => onEdit(e.id)} last={i === data.expenses.length - 1}>
                  <View style={s.dateChip}>
                    <Text style={s.dateChipText}>{formatDayMonth(e.date)}</Text>
                  </View>

                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle} numberOfLines={1}>
                      {e.description}
                    </Text>
                    <Text style={TYPE.rowMeta} numberOfLines={1}>
                      {expenseCategoryLabel(e.category)}
                      {e.subcategory ? ` · ${e.subcategory}` : ''}
                      {e.payee_name ? ` · ${e.payee_name}` : ''}
                    </Text>
                    <View style={s.tagRow}>
                      <Tag
                        label={labelFor(EXPENSE_TYPES, e.expense_type)}
                        tone={e.expense_type === 'CAPEX' ? 'capex' : 'opex'}
                      />
                      <Tag label={labelFor(FUND_SOURCES_SHORT, e.fund_source)} tone="fund" />
                    </View>
                  </View>

                  <Text style={s.amount}>{formatINR(e.amount)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} />
                </Row>
              ))}
            </Card>
          </>
        );
      }}
    </Screen>
  );
}

// ─── Other income ─────────────────────────────────────────────────────────────

function IncomeList({
  state,
  header,
  month,
  onAdd,
}: {
  state: ReturnType<typeof useApi<{ income: IncomeRow[] }>>;
  header: React.ReactNode;
  month: string;
  onAdd: () => void;
}) {
  const remove = useMutation((id: number) => api.secretary.otherIncome.delete(id));

  function confirmDelete(row: IncomeRow) {
    Alert.alert('Delete this entry?', `${row.description} — ${formatINR(row.amount)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const done = await remove.mutate(row.id);
          if (done) await state.refresh();
        },
      },
    ]);
  }

  return (
    <Screen
      state={state}
      header={header}
      isEmpty={(d) => d.income.length === 0}
      empty={{
        icon: 'cash-outline',
        title: `No other income in ${formatMonth(month)}`,
        message: 'Hall bookings, parking, NOC fees and bank interest go here. Maintenance dues are counted automatically.',
        action: <Button title="Add income" icon="add" onPress={onAdd} />,
      }}
    >
      {(data) => {
        const total = data.income.reduce((sum, r) => sum + Number(r.amount), 0);

        return (
          <>
            <Button title="Add income" icon="add" onPress={onAdd} fullWidth />

            <Card padded={false}>
              <CardHeader
                title={`${data.income.length} ${data.income.length === 1 ? 'entry' : 'entries'}`}
                action={<Text style={[TYPE.amount, { color: COLORS.success }]}>{formatINR(total)}</Text>}
              />
              {data.income.map((r, i) => (
                <Row key={r.id} onPress={() => confirmDelete(r)} last={i === data.income.length - 1}>
                  <View style={s.dateChip}>
                    <Text style={s.dateChipText}>{formatDayMonth(r.date)}</Text>
                  </View>

                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle} numberOfLines={1}>
                      {r.description}
                    </Text>
                    <Text style={TYPE.rowMeta} numberOfLines={1}>
                      {labelFor(INCOME_CATEGORIES, r.category)}
                      {r.payer_name ? ` · ${r.payer_name}` : ''}
                    </Text>
                  </View>

                  <Text style={[s.amount, { color: COLORS.success }]}>{formatINR(r.amount)}</Text>
                </Row>
              ))}
            </Card>

            <Text style={[TYPE.caption, s.footnote]}>
              Other income has no edit endpoint — tap an entry to delete it, then add it again.
            </Text>
          </>
        );
      }}
    </Screen>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Tag({ label, tone }: { label: string; tone: 'opex' | 'capex' | 'fund' }) {
  const palette = {
    opex: { bg: COLORS.cardMuted, fg: COLORS.textSecondary },
    capex: { bg: '#ede9fe', fg: '#6d28d9' },
    fund: { bg: COLORS.infoTint, fg: '#1d4ed8' },
  }[tone];

  return (
    <View style={[s.tag, { backgroundColor: palette.bg }]}>
      <Text style={[s.tagText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  monthBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs },
  monthLabel: { flex: 1, textAlign: 'center' },

  dateChip: {
    width: 52,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardMuted,
    alignItems: 'center',
  },
  dateChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  tagRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  tag: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  amount: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },

  footnote: { textAlign: 'center' },
});
