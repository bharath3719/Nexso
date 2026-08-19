/**
 * Annual Income & Expenditure — the AGM / auditor view.
 *
 * The web renders this as a 12 × 6 table. That is the one part of the ledger
 * that genuinely does not narrow: six money columns cannot be squeezed to a
 * phone without either truncating figures or scrolling sideways through the
 * numbers you are trying to compare.
 *
 * So it is transposed instead — the year totals on top, then one row per month
 * that expands into the six figures. Reading a single month is a tap; comparing
 * the year is the surplus column, which stays visible on every collapsed row.
 */

import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, InfoRow } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { currentYear, formatINR, formatMonth } from '../../src/utils/format';

// LayoutAnimation is opt-in on Android and a no-op without this call.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MonthRow = {
  month: string;
  maintenance: number;
  other_income: number;
  expenses: number;
  surplus: number;
};

export default function Annual() {
  const [year, setYear] = useState(currentYear());
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const state = useApi<{ year: string; months: MonthRow[] }>(
    (signal) => api.secretary.expenses.annual(year, signal),
    [year],
  );

  const thisYear = year === currentYear();

  function shiftYear(by: number) {
    setOpenMonth(null);
    setYear(String(Number(year) + by));
  }

  return (
    <Screen
      state={state}
      header={
        <Card padded={false}>
          <View style={s.yearBar}>
            <Button title="" icon="chevron-back" variant="ghost" onPress={() => shiftYear(-1)} />
            <Text style={[TYPE.sectionHeader, s.yearLabel]}>{year}</Text>
            <Button
              title=""
              icon="chevron-forward"
              variant="ghost"
              disabled={thisYear}
              onPress={() => shiftYear(1)}
            />
          </View>
        </Card>
      }
    >
      {(data) => {
        const totals = data.months.reduce(
          (acc, m) => ({
            maintenance: acc.maintenance + m.maintenance,
            other_income: acc.other_income + m.other_income,
            expenses: acc.expenses + m.expenses,
          }),
          { maintenance: 0, other_income: 0, expenses: 0 },
        );
        const totalIncome = totals.maintenance + totals.other_income;
        const netSurplus = totalIncome - totals.expenses;
        const inSurplus = netSurplus >= 0;

        return (
          <>
            {/* Year totals — the tfoot of the web table, promoted to the top
                because on a phone it is the first thing worth seeing. */}
            <Card>
              <Text style={TYPE.overline}>{inSurplus ? `Net surplus ${year}` : `Net deficit ${year}`}</Text>
              <Text style={[s.headline, { color: inSurplus ? COLORS.success : COLORS.danger }]}>
                {formatINR(Math.abs(netSurplus))}
              </Text>

              <View style={s.totalsSplit}>
                <View style={s.flex}>
                  <Text style={TYPE.caption}>Income</Text>
                  <Text style={[TYPE.amount, { color: COLORS.success }]}>{formatINR(totalIncome)}</Text>
                  <Text style={TYPE.caption}>
                    {formatINR(totals.maintenance)} dues · {formatINR(totals.other_income)} other
                  </Text>
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.caption}>Expenditure</Text>
                  <Text style={[TYPE.amount, { color: COLORS.danger }]}>{formatINR(totals.expenses)}</Text>
                </View>
              </View>
            </Card>

            <Card padded={false}>
              {data.months.map((m, i) => (
                <MonthCard
                  key={m.month}
                  row={m}
                  open={openMonth === m.month}
                  last={i === data.months.length - 1}
                  onToggle={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setOpenMonth((cur) => (cur === m.month ? null : m.month));
                  }}
                />
              ))}
            </Card>

            <Text style={[TYPE.caption, s.footnote]}>
              Figures in brackets are a deficit. This statement is for internal management use — share it
              with your chartered accountant along with the supporting vouchers and bank statements.
            </Text>
          </>
        );
      }}
    </Screen>
  );
}

function MonthCard({
  row,
  open,
  last,
  onToggle,
}: {
  row: MonthRow;
  open: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  const income = row.maintenance + row.other_income;
  const hasActivity = income > 0 || row.expenses > 0;
  const inSurplus = row.surplus >= 0;

  // A month with nothing in it is still listed — its absence from the year is
  // information — but dimmed, and it does not open onto six zeroes.
  return (
    <View style={[!last && s.divided, !hasActivity && s.idle]}>
      <Pressable
        onPress={hasActivity ? onToggle : undefined}
        disabled={!hasActivity}
        accessibilityRole={hasActivity ? 'button' : undefined}
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${formatMonth(row.month)}, ${
          hasActivity ? `${inSurplus ? 'surplus' : 'deficit'} ${formatINR(Math.abs(row.surplus))}` : 'no activity'
        }`}
        style={({ pressed }) => [s.monthRow, pressed && hasActivity && { backgroundColor: COLORS.cardMuted }]}
      >
        <Text style={[TYPE.rowTitle, s.flex]}>{formatMonth(row.month)}</Text>

        {hasActivity ? (
          <>
            <Text style={[s.surplus, { color: inSurplus ? COLORS.success : COLORS.danger }]}>
              {inSurplus ? formatINR(row.surplus) : `(${formatINR(Math.abs(row.surplus))})`}
            </Text>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textDisabled}
            />
          </>
        ) : (
          <Text style={TYPE.caption}>No activity</Text>
        )}
      </Pressable>

      {open && hasActivity ? (
        <View style={s.detail}>
          <InfoRow label="Maintenance dues" value={row.maintenance > 0 ? formatINR(row.maintenance) : '—'} />
          <InfoRow label="Other income" value={row.other_income > 0 ? formatINR(row.other_income) : '—'} />
          <InfoRow
            label="Total income"
            value={formatINR(income)}
            valueStyle={{ fontWeight: '700', color: COLORS.success }}
          />
          <InfoRow label="Expenditure" value={row.expenses > 0 ? formatINR(row.expenses) : '—'} />
          <InfoRow
            label={inSurplus ? 'Surplus' : 'Deficit'}
            value={formatINR(Math.abs(row.surplus))}
            valueStyle={{ fontWeight: '700', color: inSurplus ? COLORS.success : COLORS.danger }}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  yearBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs },
  yearLabel: { flex: 1, textAlign: 'center' },

  headline: { fontSize: 32, lineHeight: 38, fontWeight: '700', marginVertical: 2 },
  totalsSplit: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  idle: { opacity: 0.5 },
  surplus: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  detail: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.cardMuted,
  },

  footnote: { textAlign: 'center' },
});
