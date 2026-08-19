/**
 * Resident complaints — the tickets raised from this unit.
 *
 * Statuses come from the ticket lifecycle enforced by a DB CHECK constraint:
 * OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { CATEGORY_ICON } from '../../src/constants';
import { COLORS, PRIORITY, RADIUS, SPACING, TICKET_STATUS } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatRelative } from '../../src/utils/format';

type Complaint = {
  id: number;
  ticket_id: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  vendor_name: string | null;
};

export default function Complaints() {
  const router = useRouter();
  const state = useApi<{ complaints: Complaint[] }>((signal) => api.resident.complaints.list(signal), []);

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.complaints ?? []).length === 0}
      empty={{
        icon: 'checkmark-done-circle-outline',
        title: 'No complaints raised',
        message: 'Something broken in your flat or the common areas? Raise it here and it goes straight to your society.',
        action: <Button title="Raise a complaint" icon="add" onPress={() => router.push('/(resident)/new-complaint')} />,
      }}
      header={
        <Button
          title="Raise a complaint"
          icon="add"
          onPress={() => router.push('/(resident)/new-complaint')}
          fullWidth
        />
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.complaints ?? []).map((c) => (
            <Card key={c.id}>
              <View style={s.head}>
                <View style={[s.icon, c.priority === 'URGENT' && { backgroundColor: COLORS.dangerTint }]}>
                  <Ionicons
                    name={(CATEGORY_ICON[c.category] ?? 'help-circle-outline') as never}
                    size={19}
                    color={c.priority === 'URGENT' ? COLORS.danger : COLORS.textSecondary}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle} numberOfLines={1}>
                    {c.category}
                  </Text>
                  <Text style={TYPE.caption}>
                    {c.ticket_id} · raised {formatRelative(c.created_at)}
                  </Text>
                </View>
                <StatusPill status={c.status} map={TICKET_STATUS} />
              </View>

              <Text style={[TYPE.body, s.description]}>{c.description}</Text>

              <View style={s.footer}>
                {c.priority === 'URGENT' ? <StatusPill status="URGENT" map={PRIORITY} /> : null}
                {c.vendor_name ? (
                  <View style={s.vendor}>
                    <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
                    <Text style={TYPE.caption}>Assigned to {c.vendor_name}</Text>
                  </View>
                ) : null}
                {c.status === 'RESOLVED' || c.status === 'CLOSED' ? (
                  <Text style={TYPE.caption}>Updated {formatRelative(c.updated_at)}</Text>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
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

  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  vendor: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
