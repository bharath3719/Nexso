/**
 * Secretary tickets — read-only, matching the web portal.
 *
 * There is no PATCH under /api/secretary/tickets: assignment and status changes
 * go through the admin portal and the vendor portal, and the transitions are
 * gated by role in utils/stateMachine.js. So this screen deliberately offers no
 * actions rather than showing buttons that would 404.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Card, ChipGroup, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { CATEGORY_ICON, TICKET_FILTERS } from '../../src/constants';
import { COLORS, PRIORITY, RADIUS, SPACING, TICKET_STATUS } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatRelative } from '../../src/utils/format';

type Ticket = {
  id: number;
  ticket_id: string | null;
  category: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  raised_by_name: string | null;
  vendor_name: string | null;
  unit_id: number | null;
};

export default function Tickets() {
  const [status, setStatus] = useState<(typeof TICKET_FILTERS)[number]['value']>('ALL');

  const state = useApi<{ tickets: Ticket[] }>(
    (signal) => api.secretary.tickets({ status, limit: '100' }, signal),
    [status],
  );

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.tickets ?? []).length === 0}
      empty={{
        icon: 'checkmark-done-circle-outline',
        title: 'No tickets',
        message:
          status === 'ALL'
            ? 'No service tickets have been raised in your society.'
            : 'No tickets with this status. Try another filter.',
      }}
      // Six statuses do not fit one row at phone width; ChipGroup wraps them.
      header={<ChipGroup options={TICKET_FILTERS} value={status} onChange={setStatus} />}
    >
      {(data) => (
        <View style={s.list}>
          {(data.tickets ?? []).map((t) => (
            <Card key={t.id}>
              <View style={s.head}>
                <View style={[s.icon, t.priority === 'URGENT' && { backgroundColor: COLORS.dangerTint }]}>
                  <Ionicons
                    name={(CATEGORY_ICON[t.category] ?? 'help-circle-outline') as never}
                    size={19}
                    color={t.priority === 'URGENT' ? COLORS.danger : COLORS.textSecondary}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle} numberOfLines={1}>
                    {t.category}
                  </Text>
                  <Text style={TYPE.caption}>
                    {t.ticket_id ?? `#${t.id}`} · {formatRelative(t.created_at)}
                  </Text>
                </View>
                <StatusPill status={t.status} map={TICKET_STATUS} />
              </View>

              {t.description ? (
                <Text style={[TYPE.body, s.description]} numberOfLines={4}>
                  {t.description}
                </Text>
              ) : null}

              <View style={s.footer}>
                {t.priority === 'URGENT' ? <StatusPill status="URGENT" map={PRIORITY} /> : null}
                <FooterMeta icon="person-outline" text={t.raised_by_name ?? 'Resident'} />
                {t.vendor_name ? <FooterMeta icon="briefcase-outline" text={t.vendor_name} /> : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function FooterMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.footerMeta}>
      <Ionicons name={icon} size={14} color={COLORS.textMuted} />
      <Text style={TYPE.caption} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },

  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  description: { marginTop: SPACING.md },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.md },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
