/**
 * Society announcements.
 *
 * The API already sorts pinned first, then priority, then newest — so the list
 * is rendered in the order it arrives.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, PRIORITY, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatRelative } from '../../src/utils/format';

type Announcement = {
  id: number;
  title: string;
  body: string;
  category: string | null;
  priority: string;
  pinned: boolean;
  created_at: string;
};

export default function Announcements() {
  const state = useApi<{ announcements: Announcement[] }>(
    (signal) => api.resident.announcements(signal),
    [],
  );

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.announcements ?? []).length === 0}
      empty={{
        icon: 'megaphone-outline',
        title: 'No announcements',
        message: 'Notices from your society committee will appear here.',
      }}
    >
      {(data) => (
        <View style={s.list}>
          {(data.announcements ?? []).map((a) => {
            const urgent = a.priority === 'URGENT';
            return (
              <Card key={a.id} style={urgent ? s.urgentCard : undefined}>
                <View style={s.tags}>
                  {a.pinned ? <StatusPill tone={{ bg: '#fef3c7', fg: '#92400e', label: 'Pinned' }} /> : null}
                  {urgent ? <StatusPill status="URGENT" map={PRIORITY} /> : null}
                  {a.category ? (
                    <StatusPill tone={{ bg: COLORS.cardMuted, fg: COLORS.textSecondary, label: a.category }} />
                  ) : null}
                  <View style={s.spacer} />
                  <Text style={TYPE.caption}>{formatRelative(a.created_at)}</Text>
                </View>

                <Text style={[TYPE.sectionHeader, s.title]}>{a.title}</Text>
                <Text style={TYPE.body}>{a.body}</Text>

                {urgent ? (
                  <View style={s.urgentFoot}>
                    <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                    <Text style={[TYPE.caption, { color: COLORS.danger }]}>
                      Marked urgent by your society
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { gap: SPACING.md },
  urgentCard: { borderColor: '#fecaca', borderWidth: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.xs },
  spacer: { flex: 1 },
  title: { marginTop: SPACING.sm, marginBottom: SPACING.xs },
  urgentFoot: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },
});
