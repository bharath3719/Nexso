/**
 * Income and expenses — the monthly summary, and the way in to the rest.
 *
 * This screen answers "are we up or down this month, and on what". The entries
 * behind it live in `ledger.tsx` and the 12-month statement in `annual.tsx`;
 * both used to be web-only, on the reasoning that a ledger is a spreadsheet.
 * The entry form is not a spreadsheet though — recording a payment is exactly
 * the thing you do away from a desk — and the annual table transposes to a
 * month-per-card rather than needing the width.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, Row } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { addMonths, currentMonth, formatINR, formatMonth } from '../../src/utils/format';

type CategoryRow = { category: string; total: string; count: string; expense_type?: string };

type Summary = {
  month: string;
  income: { maintenance_collected: number; other_income: number; total: number };
  expenses: { by_category: CategoryRow[]; total: number };
  other_income_by_category: CategoryRow[];
  surplus_deficit: number;
};

export default function Expenses() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const state = useApi<Summary>((signal) => api.secretary.expenses.summary(month, signal), [month]);

  const isCurrentMonth = month === currentMonth();

  return (
    <Screen
      state={state}
      header={
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
      }
    >
      {(data) => {
        const surplus = Number(data.surplus_deficit ?? 0);
        const inSurplus = surplus >= 0;
        const expenseRows = data.expenses?.by_category ?? [];
        const incomeRows = data.other_income_by_category ?? [];
        const expenseTotal = Number(data.expenses?.total ?? 0);

        return (
          <View style={s.body}>
            {/* Bottom line */}
            <Card>
              <Text style={TYPE.overline}>{inSurplus ? 'Surplus' : 'Deficit'}</Text>
              <Text style={[s.surplus, { color: inSurplus ? COLORS.success : COLORS.danger }]}>
                {formatINR(Math.abs(surplus))}
              </Text>
              <Text style={TYPE.rowMeta}>
                {formatINR(data.income?.total ?? 0)} in · {formatINR(expenseTotal)} out
              </Text>
            </Card>

            {/* Income */}
            <Card padded={false}>
              <View style={s.sectionHead}>
                <Ionicons name="arrow-down-circle" size={18} color={COLORS.success} />
                <Text style={[TYPE.sectionHeader, s.flex]}>Income</Text>
                <Text style={[TYPE.amount, { color: COLORS.success }]}>{formatINR(data.income?.total ?? 0)}</Text>
              </View>

              <LineItem label="Maintenance collected" value={data.income?.maintenance_collected ?? 0} />
              {incomeRows.length > 0 ? (
                incomeRows.map((row) => (
                  <LineItem
                    key={row.category}
                    label={row.category}
                    sublabel={`${row.count} ${Number(row.count) === 1 ? 'entry' : 'entries'}`}
                    value={row.total}
                  />
                ))
              ) : (
                <LineItem label="Other income" value={data.income?.other_income ?? 0} last />
              )}
            </Card>

            {/* Expenses */}
            <Card padded={false}>
              <View style={s.sectionHead}>
                <Ionicons name="arrow-up-circle" size={18} color={COLORS.danger} />
                <Text style={[TYPE.sectionHeader, s.flex]}>Expenses</Text>
                <Text style={[TYPE.amount, { color: COLORS.danger }]}>{formatINR(expenseTotal)}</Text>
              </View>

              {expenseRows.length === 0 ? (
                <View style={s.emptyRow}>
                  <Text style={TYPE.rowMeta}>No expenses recorded for {formatMonth(month)}.</Text>
                </View>
              ) : (
                expenseRows.map((row, i) => {
                  const amount = Number(row.total);
                  const share = expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0;
                  return (
                    <LineItem
                      key={`${row.category}-${row.expense_type ?? ''}`}
                      label={row.category}
                      sublabel={`${row.count} ${Number(row.count) === 1 ? 'entry' : 'entries'} · ${share}% of spend`}
                      value={amount}
                      share={share}
                      last={i === expenseRows.length - 1}
                    />
                  );
                })
              )}
            </Card>

            {/* Where the numbers above come from, and where they roll up to. */}
            <Card padded={false}>
              <Row onPress={() => router.push('/(secretary)/ledger')}>
                <View style={[s.linkIcon, { backgroundColor: COLORS.primaryTint }]}>
                  <Ionicons name="list-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle}>Entries for {formatMonth(month)}</Text>
                  <Text style={TYPE.caption}>Add, edit or remove an expense or other income</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </Row>
              <Row onPress={() => router.push('/(secretary)/annual')} last>
                <View style={[s.linkIcon, { backgroundColor: COLORS.successTint }]}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.success} />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle}>Annual statement</Text>
                  <Text style={TYPE.caption}>Month-by-month I&E for the AGM and your auditor</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </Row>
            </Card>
          </View>
        );
      }}
    </Screen>
  );
}

function LineItem({
  label,
  sublabel,
  value,
  share,
  last = false,
}: {
  label: string;
  sublabel?: string;
  value: number | string;
  /** Draws a proportional bar behind the row. */
  share?: number;
  last?: boolean;
}) {
  return (
    <View style={[s.lineItem, !last && s.divided]}>
      {share !== undefined ? <View style={[s.shareBar, { width: `${share}%` }]} /> : null}
      <View style={s.flex}>
        <Text style={TYPE.rowTitle} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? <Text style={TYPE.caption}>{sublabel}</Text> : null}
      </View>
      <Text style={s.lineValue}>{formatINR(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: SPACING.lg },

  monthBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs },
  monthLabel: { flex: 1, textAlign: 'center' },

  surplus: { fontSize: 32, lineHeight: 38, fontWeight: '700', marginVertical: 2 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },

  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    overflow: 'hidden',
  },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  shareBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.cardMuted },
  lineValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },

  emptyRow: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },

  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
