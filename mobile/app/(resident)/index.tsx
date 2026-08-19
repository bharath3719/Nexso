/**
 * Resident home.
 *
 * Same four data sources as the web ResidentDashboard, but reorganised for a
 * phone: what is owed comes first because it is the thing residents open the app
 * for, then anything urgent, then the counts.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenScroll } from '../../src/components/Screen';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chevron,
  ErrorNotice,
  Loading,
  Row,
  SectionTitle,
  StatTile,
  StatusPill,
} from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/auth';
import { COLORS, DUE_STATUS, PRIORITY, RADIUS, SPACING, toneFor } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { firstName, formatINRShort, formatMonth, formatRelative } from '../../src/utils/format';

type Due = { id: number; due_month: string; amount: string; status: string; due_date: string };
type Announcement = { id: number; title: string; body: string; priority: string; pinned: boolean; created_at: string };
type Pass = { id: number };
type Complaint = { id: number; status: string };

export default function ResidentHome() {
  const session = useSession();
  const router = useRouter();

  const state = useApi(async (signal) => {
    // Four independent widgets — one failing endpoint should dim its own tile,
    // not blank the whole screen, so each settles to an empty result.
    const [announcements, passes, dues, complaints] = await Promise.all([
      api.resident.announcements(signal).catch(() => ({ announcements: [] })),
      api.resident.visitorPasses.list({ status: 'ACTIVE' }, signal).catch(() => ({ passes: [] })),
      api.resident.maintenance.dues('pending', signal).catch(() => ({ dues: [] })),
      api.resident.complaints.list(signal).catch(() => ({ complaints: [] })),
    ]);
    return {
      announcements: (announcements.announcements ?? []) as Announcement[],
      passes: (passes.passes ?? []) as Pass[],
      dues: (dues.dues ?? []) as Due[],
      complaints: (complaints.complaints ?? []) as Complaint[],
    };
  }, []);

  const { data, loading, refreshing, error, refresh, reload } = state;

  if (loading && !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Loading />
      </SafeAreaView>
    );
  }

  const dues = data?.dues ?? [];
  const announcements = data?.announcements ?? [];
  const complaints = data?.complaints ?? [];

  const outstanding = dues.filter((d) => d.status !== 'PENDING_VERIFICATION');
  const outstandingTotal = outstanding.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const overdueCount = dues.filter((d) => d.status === 'OVERDUE').length;
  const awaitingConfirmation = dues.filter((d) => d.status === 'PENDING_VERIFICATION').length;
  const openComplaints = complaints.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
  const urgent = announcements.filter((a) => a.priority === 'URGENT' || a.pinned);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenScroll refreshing={refreshing} onRefresh={refresh}>
        {error ? <ErrorNotice message={error} onRetry={reload} /> : null}

        {/* Greeting */}
        <View style={s.greeting}>
          <View style={s.greetingText}>
            <Text style={TYPE.pageTitle} numberOfLines={1}>
              Hi {firstName(session.name) || 'there'}
            </Text>
            <Text style={TYPE.pageSubtitle} numberOfLines={1}>
              {[session.societyName, session.unitNumber && `Unit ${session.unitNumber}`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <Avatar name={session.name} size={46} />
        </View>

        {/* Amount due — the reason most residents open the app */}
        <Card padded={false}>
          <View style={s.dueHeader}>
            <View style={s.flex}>
              <Text style={TYPE.overline}>Amount due</Text>
              <Text style={[s.dueAmount, outstandingTotal > 0 && overdueCount > 0 && { color: COLORS.danger }]}>
                {formatINRShort(outstandingTotal)}
              </Text>
              <Text style={TYPE.rowMeta}>
                {outstanding.length === 0
                  ? 'You are all settled — nothing pending'
                  : `${outstanding.length} unpaid ${outstanding.length === 1 ? 'bill' : 'bills'}${
                      overdueCount > 0 ? ` · ${overdueCount} overdue` : ''
                    }`}
              </Text>
            </View>
            <View style={[s.dueIcon, { backgroundColor: overdueCount > 0 ? COLORS.dangerTint : COLORS.successTint }]}>
              <Ionicons
                name={overdueCount > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={26}
                color={overdueCount > 0 ? COLORS.danger : COLORS.success}
              />
            </View>
          </View>

          {outstanding.length > 0 ? (
            <View style={s.dueFooter}>
              <Button title="View and pay" onPress={() => router.push('/(resident)/billing')} fullWidth />
            </View>
          ) : null}
        </Card>

        {awaitingConfirmation > 0 ? (
          <Banner tone="info">
            {awaitingConfirmation} payment{awaitingConfirmation === 1 ? '' : 's'} awaiting confirmation from
            your secretary. Nothing more to do — you will not be marked overdue.
          </Banner>
        ) : null}

        {/* Urgent notices */}
        {urgent.length > 0 ? (
          <View>
            <SectionTitle>Needs your attention</SectionTitle>
            <Card padded={false}>
              {urgent.slice(0, 3).map((a, i, arr) => (
                <Row
                  key={a.id}
                  last={i === arr.length - 1}
                  onPress={() => router.push('/(resident)/announcements')}
                >
                  <View style={s.flex}>
                    <View style={s.noticeTop}>
                      {a.pinned ? <StatusPill tone={{ bg: '#fef3c7', fg: '#92400e', label: 'Pinned' }} /> : null}
                      {a.priority === 'URGENT' ? <StatusPill status="URGENT" map={PRIORITY} /> : null}
                      <Text style={TYPE.caption}>{formatRelative(a.created_at)}</Text>
                    </View>
                    <Text style={TYPE.rowTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={TYPE.rowMeta} numberOfLines={2}>
                      {a.body}
                    </Text>
                  </View>
                  <Chevron />
                </Row>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Counts */}
        <View>
          <SectionTitle>At a glance</SectionTitle>
          <View style={s.tiles}>
            <StatTile
              label="Active passes"
              value={data?.passes.length ?? 0}
              icon="qr-code-outline"
              tint={COLORS.successTint}
              accent={COLORS.success}
              onPress={() => router.push('/(resident)/visitors')}
            />
            <StatTile
              label="Open complaints"
              value={openComplaints}
              icon="construct-outline"
              tint="#ede9fe"
              accent="#6d28d9"
              onPress={() => router.push('/(resident)/complaints')}
            />
            <StatTile
              label="Notices"
              value={announcements.length}
              icon="megaphone-outline"
              tint={COLORS.infoTint}
              accent={COLORS.info}
              onPress={() => router.push('/(resident)/announcements')}
            />
          </View>
        </View>

        {/* Next bills */}
        {outstanding.length > 0 ? (
          <View>
            <SectionTitle>Your bills</SectionTitle>
            <Card padded={false}>
              {outstanding.slice(0, 3).map((d, i, arr) => (
                <Row key={d.id} last={i === arr.length - 1} onPress={() => router.push('/(resident)/billing')}>
                  <View style={s.flex}>
                    <Text style={TYPE.rowTitle}>{formatMonth(d.due_month)}</Text>
                    <Text style={TYPE.rowMeta}>Maintenance</Text>
                  </View>
                  <View style={s.dueRowRight}>
                    <Text style={TYPE.amount}>{formatINRShort(d.amount)}</Text>
                    <StatusPill status={d.status} map={DUE_STATUS} />
                  </View>
                </Row>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Quick actions */}
        <View>
          <SectionTitle>Quick actions</SectionTitle>
          <Card padded={false}>
            {QUICK_ACTIONS.map((action, i, arr) => (
              <Row key={action.href} last={i === arr.length - 1} onPress={() => router.push(action.href as never)}>
                <View style={[s.actionIcon, { backgroundColor: action.tint }]}>
                  <Ionicons name={action.icon as never} size={18} color={action.accent} />
                </View>
                <Text style={[TYPE.rowTitle, s.flex]}>{action.label}</Text>
                <Chevron />
              </Row>
            ))}
          </Card>
        </View>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const QUICK_ACTIONS = [
  {
    label: 'Invite a visitor',
    href: '/(resident)/new-pass',
    icon: 'person-add-outline',
    tint: COLORS.successTint,
    accent: COLORS.success,
  },
  {
    label: 'Raise a complaint',
    href: '/(resident)/new-complaint',
    icon: 'construct-outline',
    tint: '#ede9fe',
    accent: '#6d28d9',
  },
  {
    label: 'Society events',
    href: '/(resident)/events',
    icon: 'calendar-outline',
    tint: COLORS.warningTint,
    accent: COLORS.warning,
  },
  {
    label: 'Polls and voting',
    href: '/(resident)/polls',
    icon: 'stats-chart-outline',
    tint: COLORS.infoTint,
    accent: COLORS.info,
  },
] as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.screen },
  flex: { flex: 1 },

  greeting: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  greetingText: { flex: 1, gap: 2 },

  dueHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg },
  dueAmount: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: COLORS.textPrimary, marginVertical: 2 },
  dueIcon: { width: 52, height: 52, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  dueFooter: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  dueRowRight: { alignItems: 'flex-end', gap: SPACING.xs },

  tiles: { flexDirection: 'row', gap: SPACING.md },

  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs },

  actionIcon: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
});
