/**
 * Secretary overview.
 *
 * Leads with the two things that need a decision — payments waiting to be
 * confirmed, and open tickets — because those are what a secretary opens their
 * phone for. Collection progress for the current month follows.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenScroll } from '../../src/components/Screen';
import {
  Avatar,
  Button,
  Card,
  Chevron,
  ErrorNotice,
  Loading,
  Row,
  SectionTitle,
  StatTile,
} from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/auth';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { currentMonth, formatINRShort, formatMonth } from '../../src/utils/format';

type Stats = {
  residents: { total: number; pendingInvites: number };
  units: { total: number };
  tickets: { total: number; open: number; inProgress: number; resolved: number };
};

type DueStats = {
  total: number;
  paid: number;
  pending: number;
  pendingVerification: number;
  overdue: number;
  waived: number;
  totalAmount: number;
  collectedAmount: number;
};

export default function SecretaryHome() {
  const session = useSession();
  const router = useRouter();
  const month = currentMonth();

  const state = useApi(async (signal) => {
    const [stats, maintenance] = await Promise.all([
      api.secretary.stats(signal).catch(() => null),
      api.secretary.maintenance.list({ month, status: 'ALL' }, signal).catch(() => null),
    ]);
    return {
      stats: stats as Stats | null,
      dueStats: (maintenance?.stats ?? null) as DueStats | null,
    };
  }, [month]);

  const { data, loading, refreshing, error, refresh, reload } = state;

  if (loading && !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Loading />
      </SafeAreaView>
    );
  }

  const stats = data?.stats;
  const dues = data?.dueStats;

  const collectionPct =
    dues && dues.totalAmount > 0 ? Math.round((dues.collectedAmount / dues.totalAmount) * 100) : 0;
  const toVerify = dues?.pendingVerification ?? 0;
  const openTickets = stats?.tickets.open ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenScroll refreshing={refreshing} onRefresh={refresh}>
        {error ? <ErrorNotice message={error} onRetry={reload} /> : null}

        <View style={s.greeting}>
          <View style={s.greetingText}>
            <Text style={TYPE.pageTitle} numberOfLines={1}>
              {session.societyName ?? 'Your society'}
            </Text>
            <Text style={TYPE.pageSubtitle} numberOfLines={1}>
              Secretary · {session.username}
            </Text>
          </View>
          <Avatar name={session.societyName ?? session.username} size={46} />
        </View>

        {/* Things waiting on a decision */}
        {toVerify > 0 || openTickets > 0 ? (
          <View>
            <SectionTitle>Needs you</SectionTitle>
            <Card padded={false}>
              {toVerify > 0 ? (
                <Row last={openTickets === 0} onPress={() => router.push('/(secretary)/verify-payments')}>
                  <View style={[s.icon, { backgroundColor: COLORS.infoTint }]}>
                    <Ionicons name="checkmark-done-outline" size={19} color={COLORS.info} />
                  </View>
                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle}>
                      {toVerify} payment{toVerify === 1 ? '' : 's'} to confirm
                    </Text>
                    <Text style={TYPE.rowMeta}>Residents reported a UPI transfer</Text>
                  </View>
                  <Chevron />
                </Row>
              ) : null}

              {openTickets > 0 ? (
                <Row last onPress={() => router.push('/(secretary)/tickets')}>
                  <View style={[s.icon, { backgroundColor: COLORS.dangerTint }]}>
                    <Ionicons name="alert-circle-outline" size={19} color={COLORS.danger} />
                  </View>
                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle}>
                      {openTickets} open ticket{openTickets === 1 ? '' : 's'}
                    </Text>
                    <Text style={TYPE.rowMeta}>Not yet assigned to a vendor</Text>
                  </View>
                  <Chevron />
                </Row>
              ) : null}
            </Card>
          </View>
        ) : (
          <Card>
            <View style={s.allClear}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={[TYPE.body, s.flex]}>
                Nothing waiting on you — no unconfirmed payments, no unassigned tickets.
              </Text>
            </View>
          </Card>
        )}

        {/* Collection progress */}
        <View>
          <SectionTitle>{formatMonth(month)} collection</SectionTitle>
          <Card>
            <View style={s.collectionTop}>
              <View style={s.flex}>
                <Text style={s.collected}>{formatINRShort(dues?.collectedAmount ?? 0)}</Text>
                <Text style={TYPE.rowMeta}>collected of {formatINRShort(dues?.totalAmount ?? 0)}</Text>
              </View>
              <Text style={s.pct}>{collectionPct}%</Text>
            </View>

            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.min(100, collectionPct)}%` }]} />
            </View>

            <View style={s.legend}>
              <Legend label="Paid" value={dues?.paid ?? 0} color={COLORS.success} />
              <Legend label="Pending" value={dues?.pending ?? 0} color={COLORS.warning} />
              <Legend label="Overdue" value={dues?.overdue ?? 0} color={COLORS.danger} />
              <Legend label="To verify" value={toVerify} color={COLORS.info} />
            </View>

            <Button
              title="Open maintenance"
              variant="secondary"
              onPress={() => router.push('/(secretary)/maintenance')}
              fullWidth
              style={s.collectionAction}
            />
          </Card>
        </View>

        {/* Society at a glance */}
        <View>
          <SectionTitle>Your society</SectionTitle>
          <View style={s.tiles}>
            <StatTile
              label="Residents"
              value={stats?.residents.total ?? 0}
              icon="people-outline"
              tint={COLORS.primaryTint}
              accent={COLORS.primary}
              onPress={() => router.push('/(secretary)/residents')}
            />
            <StatTile
              label="Units"
              value={stats?.units.total ?? 0}
              icon="business-outline"
              tint="#ede9fe"
              accent="#6d28d9"
            />
            <StatTile
              label="Tickets in progress"
              value={stats?.tickets.inProgress ?? 0}
              icon="hourglass-outline"
              tint={COLORS.warningTint}
              accent={COLORS.warning}
              onPress={() => router.push('/(secretary)/tickets')}
            />
          </View>
        </View>

        {stats && stats.residents.pendingInvites > 0 ? (
          <Card>
            <View style={s.allClear}>
              <Ionicons name="mail-unread-outline" size={20} color={COLORS.warning} />
              <Text style={[TYPE.body, s.flex]}>
                {stats.residents.pendingInvites} resident
                {stats.residents.pendingInvites === 1 ? ' has' : 's have'} not activated their account yet.
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Shortcuts */}
        <View>
          <SectionTitle>Quick actions</SectionTitle>
          <Card padded={false}>
            {QUICK_ACTIONS.map((a, i, arr) => (
              <Row key={a.href} last={i === arr.length - 1} onPress={() => router.push(a.href as never)}>
                <View style={[s.icon, { backgroundColor: a.tint }]}>
                  <Ionicons name={a.icon as never} size={18} color={a.accent} />
                </View>
                <Text style={[TYPE.rowTitle, s.flex]}>{a.label}</Text>
                <Chevron />
              </Row>
            ))}
          </Card>
        </View>
      </ScreenScroll>
    </SafeAreaView>
  );
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={TYPE.caption}>
        {label} {value}
      </Text>
    </View>
  );
}

const QUICK_ACTIONS = [
  {
    label: 'Post an announcement',
    href: '/(secretary)/new-announcement',
    icon: 'megaphone-outline',
    tint: COLORS.infoTint,
    accent: COLORS.info,
  },
  {
    label: 'Send a WhatsApp broadcast',
    href: '/(secretary)/broadcast',
    icon: 'paper-plane-outline',
    tint: COLORS.successTint,
    accent: COLORS.success,
  },
  {
    label: 'Income and expenses',
    href: '/(secretary)/expenses',
    icon: 'pie-chart-outline',
    tint: COLORS.warningTint,
    accent: COLORS.warning,
  },
] as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.screen },
  flex: { flex: 1 },

  greeting: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  greetingText: { flex: 1, gap: 2 },

  icon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  collectionTop: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.md },
  collected: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: COLORS.textPrimary },
  pct: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: COLORS.success, fontVariant: ['tabular-nums'] },

  track: {
    height: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.divider,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  fill: { height: '100%', backgroundColor: COLORS.success, borderRadius: RADIUS.pill },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },

  collectionAction: { marginTop: SPACING.lg },

  tiles: { flexDirection: 'row', gap: SPACING.md },
});
