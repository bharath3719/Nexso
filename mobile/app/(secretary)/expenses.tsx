/**
 * Income and expenses — monthly summary.
 *
 * Read-only on purpose. The web SecretaryExpenses page is a full ledger with an
 * editable expense sheet, category rows and an annual table; that is a
 * spreadsheet, and a spreadsheet on a 6-inch screen is worse than no
 * spreadsheet. What is genuinely useful away from a desk is the answer to "are
 * we up or down this month, and on what" — so that is what this shows, with
 * entry left to the web portal.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Banner, Button, Card } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, SPACING } from '../../src/theme/tokens';
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

            <Banner tone="info">
              Adding and editing entries, the monthly expense sheet and the annual audit table live in
              the web portal — they need a wider screen than this.
            </Banner>
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
});
